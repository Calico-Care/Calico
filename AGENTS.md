# Repository Guidelines

## Project Structure & Module Organization
- `app/` houses Expo Router routes; group screens and layouts by flow (caregiver, patient, admin).
- Reusable UI lives in `components/` (PascalCase); shared context, Zustand stores, and hooks live in `providers/`, `store/`, and `hooks/`.
- `lib/` contains Supabase/Terra/VAPI helpers; env and alert logic sit in `config/`; styling tokens stay in `theme/` and `global.css`.
- `locales/` holds i18n JSON; static assets live in `assets/`; native scaffolds remain in `android/` and `ios/`.
- Maestro flows belong in `.maestro/flows`; `app.json` and `eas.json` capture runtime metadata.

## Platform Scope & Integrations
- BodyTrace CHF/COPD kits stream via Terra webhooks into Supabase Realtime for trend math and green/yellow/red alerts.
- VAPI (HIPAA mode) runs daily questionnaires, urgent callbacks, and PDF summaries surfaced inside our caregiver dashboard.
- Stych delivers org onboarding, SSO, and SCIM; Expo + NativeWind power caregiver, patient/family, and admin experiences from one React Native codebase with web support.

## Environment & Supabase Setup
- Copy `.env.example` to `.env` and add `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project (Expo requires the `EXPO_PUBLIC_` prefix).
- Use `supabase login` followed by `supabase link --project-ref <project-ref>` to connect migrations, then `supabase db push` to sync schema.
- Keep service-role and other privileged keys in EAS/Edge secrets, never in the Expo bundle.

## Build, Test, and Development Commands
- `bun install` manages dependencies; `bun run start` (plus `ios`/`android`/`web`) launches the dev client.
- `bun run lint` and `bun run format` invoke Biome; `bun run type-check` calls `tsc`; `bun run build:prod` triggers an EAS production build.

## Coding Style & Naming Conventions
- Biome enforces two-space indentation, LF endings, single quotes, `es5` trailing commas, and semicolons.
- Reference shared modules through `@/`, prefer NativeWind tokens over inline styles, and keep strict TypeScript coverage.
- Screens/components use PascalCase files; hooks follow `useName`; Zustand slices stay in `store/` with camelCase exports.

## Testing Guidelines
- Before a PR, run at least one Maestro flow (e.g., `maestro test .maestro/flows/navigation.yaml`) alongside `bun run lint` and `bun run type-check`.
- Add new flows in `.maestro/flows` using kebab-case; document coverage for Supabase logic, Terra ingestion, VAPI voice paths, and caregiver dashboard workflows.
- Attach simulator screenshots or PDF artifacts when altering dashboards, alerts, or report generation.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat:`, `fix:`, `chore:`); Husky + lint-staged will format staged files.
- PRs must explain user and clinical impact, list executed tests, link Supabase issues or Terraform tickets, and describe config changes (env vars, HIPAA modes, EAS profiles).
- Update `locales/` for new copy and call out follow-on steps such as BAA reviews or Stych provisioning updates.

## Graphite.dev Workflow
- Install the CLI (`brew install withgraphite/tap/graphite`), run `gt auth login`, then `gt init` inside the repo.
- Keep `main` fresh with `gt repo sync` / `gt upstack onto origin/main`; create feature branches via `gt branch create <name>`.
- Stage files normally, then `gt commit` to add to your stack; use `gt status` or `gt stack list` to view pending work.
- Ship changes with `gt stack submit` (or `gt submit` when unstacked); rerun tests before each submit and prefer amending (`gt amend`) + `gt stack submit --update` for review fixes.

### Common Commands
- `gt repo sync` — sync with `origin/main` and clean merged stacks.
- `gt branch create feature/<slug>` — start a stacked branch that will map to a GitHub PR.
- `git add <files>` + `bun run format && bun run type-check` (+ Maestro flows) — stage and verify work.
- `gt commit -m "feat: ..."` — create stack-aware commits (avoid `git commit`).
- `gt status` / `gt stack list` — preview branch order and submission status.
- `gt stack submit` / `gt submit` — open or refresh GitHub PRs.
- `gt amend` + `gt stack submit --update` — fix the latest commit and push review updates.
- `gt downstack <branch>` / `gt upstack` — jump to earlier/later branches to edit.
- `gt branch delete <branch>` — clean up after merges.
