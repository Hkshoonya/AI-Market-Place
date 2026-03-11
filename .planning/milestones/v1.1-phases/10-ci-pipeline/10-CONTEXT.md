# Phase 10: CI Pipeline - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

GitHub Actions workflow enforcing lint, typecheck, and tests on every PR. No PR can merge to main without all three passing. Does not include E2E tests (Phase 15), component tests (Phase 12), or deployment pipelines.

</domain>

<decisions>
## Implementation Decisions

### Workflow structure
- Three parallel jobs: lint, typecheck, test — each runs independently for fast feedback (~2min total)
- Each job shows as a separate status check on the PR
- Single workflow file: `.github/workflows/ci.yml`
- Triggers: `pull_request` to main only + `workflow_dispatch` for manual runs
- PRs only — no push triggers to conserve Actions minutes

### Environment & caching
- Node 22 LTS across all jobs
- `actions/setup-node` with `cache: 'npm'` for dependency caching (keyed on package-lock.json)
- No .next/cache caching — `tsc --noEmit` doesn't use it
- No coverage report upload — defer until Phase 12 expands test suite

### Env vars for tests
- No env vars needed — all 170+ tests are pure unit tests with no Supabase/external dependencies
- No GitHub secrets to configure for CI
- Lint env var needs: Claude's discretion — test whether ESLint needs NEXT_PUBLIC_* vars and configure if needed

### Merge enforcement
- GitHub branch protection on main branch only
- Require all 3 status checks to pass: lint, typecheck, test
- No PR review requirements — solo developer, reviews add friction
- No CODEOWNERS file
- feat/* branches stay unprotected for flexible development
- No conventional commit enforcement on PR titles
- Plan includes step-by-step setup guide for GitHub branch protection (manual UI steps)

### Claude's Discretion
- Whether ESLint needs dummy env vars to run in CI
- Exact actions versions (e.g., actions/checkout@v4, actions/setup-node@v4)
- Timeout values for each job
- Whether to add concurrency groups (cancel in-progress runs on new pushes)

</decisions>

<specifics>
## Specific Ideas

- Existing `cron-sync.yml` shows the team's GitHub Actions conventions (ubuntu-latest, timeout-minutes, env from secrets)
- Scripts already defined in package.json: `lint` (eslint), `test` (vitest run)
- Typecheck command: `npx tsc --noEmit` (not a package.json script — run directly)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json` scripts: `lint`, `test`, `test:watch` — CI uses `lint` and `test` directly
- `eslint.config.mjs`: Flat config with `next/core-web-vitals` + `next/typescript`
- `vitest.config.ts`: Node environment, `src/**/*.test.ts` include pattern, path alias for `@/`
- `.github/workflows/cron-sync.yml`: Existing workflow pattern (ubuntu-latest, env from secrets, timeout-minutes)

### Established Patterns
- GitHub Actions already in use for cron jobs — team is familiar with the platform
- ESLint flat config (v9) — no legacy `.eslintrc` to worry about
- Vitest 4.x with `passWithNoTests: true` — CI won't fail if a test file is empty

### Integration Points
- `.github/workflows/ci.yml`: New workflow file (alongside existing cron-sync.yml)
- GitHub repo settings: Branch protection rules for main (manual configuration)
- No package.json changes needed — existing scripts sufficient

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-ci-pipeline*
*Context gathered: 2026-03-05*
