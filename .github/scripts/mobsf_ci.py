#!/usr/bin/env python3
"""
MobSF CI helper to drive MASVS compliance checks from GitHub Actions.

The script talks to a running MobSF instance (local or remote), uploads the
provided mobile binary (APK/IPA/AAB), triggers analysis, requests the MASVS
compliance report, and fails if violations are found (when requested).
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import os
import sys
import time
from collections.abc import Iterable
from pathlib import Path
from typing import Any, Optional

import requests
from requests import Response, Session


DEFAULT_BASE_URL = os.environ.get("MOBSF_URL", "http://127.0.0.1:8000")
DEFAULT_API_KEY = os.environ.get("MOBSF_API_KEY", "mobsf_default_api_key")
DEFAULT_POLL_DELAY_SECONDS = 5
DEFAULT_POLL_TIMEOUT_SECONDS = 600
PASS_TOKENS = {"pass", "passed", "compliant"}


def _get_positive_int_env(env_name: str, default: int) -> int:
    raw_value = os.environ.get(env_name)
    if raw_value is None:
        return default
    try:
        parsed = int(raw_value)
    except ValueError:
        print(f"Warning: Could not parse {env_name!r} value {raw_value!r} as an integer; using default {default}.", file=sys.stderr)
        return default
    if parsed <= 0:
        print(f"Warning: {env_name!r} must be a positive integer; received {parsed}. Using default {default}.", file=sys.stderr)
        return default
    return parsed


POLL_DELAY_SECONDS = _get_positive_int_env("MOBSF_POLL_DELAY_SECONDS", DEFAULT_POLL_DELAY_SECONDS)
POLL_TIMEOUT_SECONDS = _get_positive_int_env("MOBSF_POLL_TIMEOUT_SECONDS", DEFAULT_POLL_TIMEOUT_SECONDS)


class MobSFError(RuntimeError):
    """Raised when the MobSF API call fails."""


def _append_step_summary(summary: str) -> None:
    if not summary:
        return
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    try:
        with Path(summary_path).open("a", encoding="utf-8") as handle:
            handle.write(summary)
            if not summary.endswith("\n"):
                handle.write("\n")
    except OSError:
        pass


@dataclasses.dataclass
class MASVSResult:
    level: str
    passed: int
    failed: list[dict[str, Any]]

    @property
    def is_compliant(self) -> bool:
        return not self.failed


def _raise_for_status(response: Response, context: str) -> None:
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        msg = f"{context} failed with status {response.status_code}: {response.text}"
        raise MobSFError(msg) from exc


def wait_for_server(session: Session, base_url: str, timeout: int = 120) -> None:
    start = time.monotonic()
    while time.monotonic() - start < timeout:
        try:
            response = session.get(base_url, timeout=10)
            if response.status_code == 200:
                return
        except requests.RequestException:
            pass
        time.sleep(3)
    raise MobSFError(f"MobSF server at {base_url} did not become ready within {timeout} seconds.")


def upload_app(session: Session, base_url: str, app_path: Path) -> dict[str, Any]:
    with app_path.open("rb") as file_handle:
        files = {"file": (app_path.name, file_handle)}
        response = session.post(f"{base_url}/api/v1/upload", files=files, timeout=120)
    _raise_for_status(response, "Upload")
    payload = response.json()
    required = {"hash", "scan_type", "file_name"}
    missing = required - payload.keys()
    if missing:
        raise MobSFError(f"Upload response missing keys: {', '.join(sorted(missing))}")
    return payload


def trigger_scan(session: Session, base_url: str, upload_meta: dict[str, Any]) -> dict[str, Any]:
    scan_payload = {
        "scan_type": upload_meta["scan_type"],
        "file_name": upload_meta["file_name"],
        "hash": upload_meta["hash"],
    }
    response = session.post(f"{base_url}/api/v1/scan", json=scan_payload, timeout=120)
    if response.status_code == 415:
        # Some MobSF versions expect form-encoded bodies.
        response = session.post(f"{base_url}/api/v1/scan", data=scan_payload, timeout=120)
    _raise_for_status(response, "Scan")
    return response.json()


def wait_for_scan_completion(session: Session, base_url: str, upload_meta: dict[str, Any]) -> None:
    """
    Poll the report endpoint until the analysis artefacts are ready.
    MobSF returns the report once analysis is complete.
    """
    deadline = time.monotonic() + POLL_TIMEOUT_SECONDS
    report_endpoint = f"{base_url}/api/v1/report_json"
    payload = {"hash": upload_meta["hash"]}

    while time.monotonic() < deadline:
        try:
            response = session.post(report_endpoint, json=payload, timeout=30)
            if response.status_code == 200:
                # If the report is available, we can exit. The MASVS call will run afterwards.
                return
        except requests.RequestException:
            pass
        time.sleep(POLL_DELAY_SECONDS)

    raise MobSFError(
        "Timed out waiting for MobSF to finish analysis; "
        "consider increasing MOBSF_POLL_TIMEOUT_SECONDS if binaries are large."
    )


def request_masvs_report(
    session: Session,
    base_url: str,
    upload_meta: dict[str, Any],
    level: str,
) -> dict[str, Any]:
    endpoint = f"{base_url}/api/v1/masvs"
    payload = {
        "scan_type": upload_meta["scan_type"],
        "file_name": upload_meta["file_name"],
        "hash": upload_meta["hash"],
        "masvs_level": level,
    }
    response = session.post(endpoint, json=payload, timeout=60)
    if response.status_code in (400, 415):
        # Fall back to form-encoded for older MobSF releases.
        response = session.post(endpoint, data=payload, timeout=60)
    _raise_for_status(response, "MASVS report")
    return response.json()


def parse_masvs(data: dict[str, Any], level: str) -> MASVSResult:
    controls = data.get("controls") or data.get("masvs_controls") or []
    failed: list[dict[str, Any]] = []
    passed = 0

    for entry in controls:
        status_raw = entry.get("status") or entry.get("value") or ""
        status = str(status_raw).strip().lower()
        if status in PASS_TOKENS:
            passed += 1
        elif status:
            failed.append(entry)
        else:
            # Assume failure if status is missing or unknown.
            failed.append(entry)

    # Some MobSF versions return an aggregate dictionary instead.
    aggregate = data.get("summary") or data.get("masvs_summary") or {}
    if not controls and aggregate:
        failed_controls = aggregate.get("failed") or aggregate.get("non_compliant") or []
        passed = aggregate.get("pass", 0) or aggregate.get("passed", 0)
        failed = failed_controls if isinstance(failed_controls, list) else []

    return MASVSResult(level=level, passed=passed, failed=failed)


def render_failures(failures: Iterable[dict[str, Any]]) -> str:
    lines = []
    for entry in failures:
        requirement = entry.get("control") or entry.get("id") or entry.get("title") or "Unknown control"
        description = entry.get("description") or entry.get("details") or ""
        guidance = entry.get("remediation") or entry.get("remedy") or ""
        lines.append(f"- {requirement}\n  Description: {description}\n  Guidance: {guidance}")
    return "\n".join(lines)


def run_masvs_audit(
    app_path: Path,
    level: str,
    *,
    fail_on_violation: bool,
    base_url: str,
    api_key: str,
    output_path: Optional[Path] = None,
) -> MASVSResult:
    if not app_path.exists():
        raise MobSFError(f"App binary not found at {app_path}")

    session = requests.Session()
    session.headers.update({"Authorization": api_key})

    wait_for_server(session, base_url)
    print(f"✅ MobSF server is reachable at {base_url}")

    upload_meta = upload_app(session, base_url, app_path)
    print(f"⬆️  Uploaded {upload_meta['file_name']} (hash: {upload_meta['hash']})")

    trigger_scan(session, base_url, upload_meta)
    print("🔍 MobSF analysis started, waiting for completion...")
    wait_for_scan_completion(session, base_url, upload_meta)

    masvs_raw = request_masvs_report(session, base_url, upload_meta, level)
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(masvs_raw, indent=2))
        print(f"📝 Raw MASVS report saved to {output_path}")
    result = parse_masvs(masvs_raw, level)

    print(f"📋 MASVS level {result.level} summary: {result.passed} controls passed, {len(result.failed)} controls failed.")

    if result.failed:
        print("❌ Non-compliant controls detected:")
        print(render_failures(result.failed))
        if fail_on_violation:
            raise MobSFError("MASVS compliance check failed due to policy violations.")
    else:
        print("✅ All MASVS controls passed.")
    return result


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run MobSF MASVS compliance checks.")
    parser.add_argument(
        "--app",
        required=True,
        help="Path to the mobile binary (APK, AAB, or IPA) to analyse.",
    )
    parser.add_argument(
        "--masvs-level",
        default="L2",
        help="Required MASVS level (e.g. L1, L2, RL2). Defaults to L2.",
    )
    parser.add_argument(
        "--fail-on-violation",
        type=lambda value: str(value).lower() in {"1", "true", "yes"},
        default=True,
        help="Fail with a non-zero exit code if any MASVS controls are violated.",
    )
    parser.add_argument(
        "--mobsf-url",
        default=DEFAULT_BASE_URL,
        help=f"MobSF base URL (default: {DEFAULT_BASE_URL}).",
    )
    parser.add_argument(
        "--api-key",
        default=DEFAULT_API_KEY,
        help="MobSF API key (defaults to MOBSF_API_KEY env or MobSF default).",
    )
    parser.add_argument(
        "--output",
        help="Optional path to write the raw MASVS JSON output.",
    )
    return parser.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)
    app_path = Path(args.app).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve() if args.output else None
    try:
        result = run_masvs_audit(
            app_path=app_path,
            level=args.masvs_level,
            fail_on_violation=args.fail_on_violation,
            base_url=args.mobsf_url,
            api_key=args.api_key,
            output_path=output_path,
        )
    except MobSFError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        summary = "\n".join(
            [
                "## MobSF MASVS scan",
                "- Status: ❌ Failed",
                f"- Error: {exc}",
            ]
        )
        _append_step_summary(summary)
        return 1
    except requests.RequestException as exc:
        print(f"[ERROR] Networking failure while communicating with MobSF: {exc}", file=sys.stderr)
        summary = "\n".join(
            [
                "## MobSF MASVS scan",
                "- Status: ❌ Failed",
                f"- Error: Networking failure while communicating with MobSF: {exc}",
            ]
        )
        _append_step_summary(summary)
        return 1
    status_line = "- Status: ✅ Success"
    if result.failed:
        status_line = "- Status: ⚠️ Completed with warnings"
    summary_lines = [
        "## MobSF MASVS scan",
        status_line,
        f"- MASVS level: {result.level}",
        f"- Passed controls: {result.passed}",
        f"- Failed controls: {len(result.failed)}",
    ]
    if output_path:
        summary_lines.append(f"- Report: `{output_path}`")
    _append_step_summary("\n".join(summary_lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
