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
- GitHub Actions uses the Graphite CI Optimizer (`withgraphite/graphite-ci-action`) to skip redundant runs—set the repo secret `GRAPHITE_CI_TOKEN` so the optimizer can authenticate; otherwise the `ci.yml` workflow fails early.

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
1. Install the CLI (`brew install withgraphite/tap/graphite`), run `gt auth login`, then `gt init` inside the repo root.
2. Keep `main` current with `gt checkout main` followed by `gt sync` (pulls trunk, restacks open PRs, prunes merged branches).
3. After editing files, run `gt create --all --message "feat(...)"` to stage changes, commit, and spin up a new branch/PR seed in a single command.
4. Visualize or jump between branches with `gt checkout` (interactive picker) or `gt top` to hop to the newest branch in your stack.
5. Push work with `gt submit` (single PR) or `gt submit --stack --reviewers <handle>` when sending an entire stack for review.
6. Stack more changes by repeating `gt checkout` ➝ edit ➝ `gt create --all --message "..."` on top of the previous branch.
7. Respond to review feedback using `gt modify -a` (amend in place) or `gt modify -cam "Respond to review"` to add a follow-up commit—Graphite restacks upstack branches automatically.
8. Run `gt sync` whenever `main` moves or after merges to refresh every branch and clean up merged work locally.

### Common Commands
- `gt sync` — pull latest trunk, restack open PRs, and delete merged/closed branches.
- `gt checkout` — interactively select any branch in your stack (or use `gt top` to jump upstack).
- `gt create --all --message "feat: ..."` — stage all changes, create a branch, and commit with one command.
- `gt submit --stack [--reviewers alice]` — push PRs (single or stacked) and request reviewers.
- `gt modify -a` / `gt modify -cam "message"` — amend existing commits or add review-response commits while restacking dependents.
- `gt log short` / `gt ls` — visualize the stack and confirm ordering before submitting.
- `gt restack` — re-run restacking manually after resolving conflicts.
- `gt pr` — open the active branch’s PR in Graphite/GitHub to review or merge.
