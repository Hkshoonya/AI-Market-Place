# Phase 10: CI Pipeline - Research

**Researched:** 2026-03-05
**Domain:** GitHub Actions CI, ESLint, TypeScript, Vitest
**Confidence:** HIGH

## Summary

Phase 10 is straightforward: create a single GitHub Actions workflow with three parallel jobs (lint, typecheck, test) that run on every PR to main, plus configure branch protection to block merges when checks fail. The project already has all tooling configured locally -- ESLint 9 flat config, TypeScript strict mode, Vitest 4.x with 170 passing tests. No new dependencies are needed.

The existing `cron-sync.yml` establishes the project's GitHub Actions conventions (ubuntu-latest, timeout-minutes pattern). The CI workflow follows the same conventions but adds checkout + Node setup + npm ci steps since it needs the actual codebase (unlike cron jobs that just curl endpoints).

**Primary recommendation:** Create `.github/workflows/ci.yml` with three parallel jobs sharing a common setup pattern (checkout, Node 22, npm ci with cache), then document the manual GitHub branch protection setup steps.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three parallel jobs: lint, typecheck, test -- each runs independently for fast feedback (~2min total)
- Each job shows as a separate status check on the PR
- Single workflow file: `.github/workflows/ci.yml`
- Triggers: `pull_request` to main only + `workflow_dispatch` for manual runs
- PRs only -- no push triggers to conserve Actions minutes
- Node 22 LTS across all jobs
- `actions/setup-node` with `cache: 'npm'` for dependency caching (keyed on package-lock.json)
- No .next/cache caching
- No coverage report upload
- No env vars needed for tests (pure unit tests)
- No GitHub secrets to configure for CI
- GitHub branch protection on main branch only
- Require all 3 status checks to pass: lint, typecheck, test
- No PR review requirements (solo developer)
- No CODEOWNERS file
- feat/* branches stay unprotected
- No conventional commit enforcement on PR titles
- Plan includes step-by-step setup guide for GitHub branch protection (manual UI steps)

### Claude's Discretion
- Whether ESLint needs dummy env vars to run in CI
- Exact actions versions (e.g., actions/checkout@v4, actions/setup-node@v4)
- Timeout values for each job
- Whether to add concurrency groups (cancel in-progress runs on new pushes)

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CICD-01 | GitHub Actions workflow runs lint on every PR | Lint job using `npm run lint` (ESLint 9 flat config verified working) |
| CICD-02 | GitHub Actions workflow runs `tsc --noEmit` on every PR | Typecheck job using `npx tsc --noEmit` (tsconfig.json already has `noEmit: true`) |
| CICD-03 | GitHub Actions workflow runs `vitest run` on every PR | Test job using `npm test` (170 tests, <1s execution, all passing) |
| CICD-04 | PR merges blocked unless all CI checks pass | Branch protection rules on main requiring all 3 status checks |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| GitHub Actions | N/A (platform) | CI/CD platform | Already used for cron-sync.yml; no additional setup |
| actions/checkout | v4 | Clone repository | Standard action, latest major version |
| actions/setup-node | v4 | Install Node.js + cache deps | Standard action with built-in npm cache support |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| ESLint | ^9 (installed) | Linting | `npm run lint` -- already configured |
| TypeScript | ^5 (installed) | Type checking | `npx tsc --noEmit` -- already configured |
| Vitest | ^4.0.18 (installed) | Unit testing | `npm test` -- already configured |

### Alternatives Considered
None -- all decisions are locked. GitHub Actions is already in use.

**Installation:**
No new packages needed. All tooling is already installed.

## Architecture Patterns

### Recommended Project Structure
```
.github/
  workflows/
    ci.yml          # NEW - lint, typecheck, test on PRs
    cron-sync.yml   # EXISTING - data sync cron jobs
```

### Pattern 1: Parallel Jobs with Shared Setup
**What:** Three independent jobs that each checkout code, install deps, and run one check
**When to use:** When checks are independent and you want separate status checks on PRs

```yaml
# Each job follows this pattern:
jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
```

**Why not a single job with 3 steps?** User decision: each job shows as a separate status check on the PR, giving clearer feedback about what exactly failed. Three parallel jobs also run faster than sequential steps.

### Pattern 2: Concurrency Groups
**What:** Cancel in-progress CI runs when a new commit is pushed to the same PR
**When to use:** Always for PR workflows -- saves Actions minutes and avoids stale results

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Recommendation:** Add this. It is standard practice, saves Actions minutes, and ensures only the latest push is checked. No downside for a solo developer.

### Anti-Patterns to Avoid
- **Sharing node_modules between jobs via artifacts:** Slower than npm ci with cache. The `actions/setup-node` cache mechanism is faster because it caches the npm global store, and `npm ci` with a warm cache takes ~5-10 seconds.
- **Using `npm install` instead of `npm ci`:** CI should always use `npm ci` for deterministic installs from lockfile.
- **Running all checks in one job:** Loses granular status checks on the PR.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dependency caching | Custom cache with actions/cache | `actions/setup-node` with `cache: 'npm'` | Built-in, handles cache key and restore automatically |
| Branch protection | Custom merge checks via webhooks | GitHub branch protection rules (UI) | Native feature, no code needed |

## Common Pitfalls

### Pitfall 1: ESLint Requiring NEXT_PUBLIC Env Vars
**What goes wrong:** ESLint with eslint-config-next may fail if it tries to parse files that reference `process.env.NEXT_PUBLIC_*` during type-aware linting.
**Why it happens:** The eslint-config-next/typescript plugin does type-aware linting which could trigger TypeScript's type resolution.
**How to avoid:** The current ESLint config does NOT use type-aware linting rules (no `parserOptions.project` set). ESLint flat config with `next/core-web-vitals` and `next/typescript` runs pattern-based rules only. No env vars needed.
**Research finding:** Verified that `eslint.config.mjs` has no `process.env` references and no `parserOptions.project` configuration. ESLint will run fine without any environment variables.
**Confidence:** HIGH -- verified by reading the actual config file.

### Pitfall 2: Status Check Names Must Match Exactly
**What goes wrong:** Branch protection rules reference status check names that don't match the job names in the workflow.
**Why it happens:** GitHub derives status check names from the workflow file name and job key. If the workflow name is "CI" and job key is "lint", the check name is "CI / lint".
**How to avoid:** After the first successful workflow run, configure branch protection using the exact check names that appear. Document the expected names in the plan.
**Warning signs:** Merge button stays enabled even when checks fail, or checks show as "Expected" but never run.

### Pitfall 3: Workflow Not Triggering on PRs to Main
**What goes wrong:** PR workflow doesn't run because the PR targets a different branch.
**Why it happens:** `pull_request` trigger with `branches: [main]` only fires when the PR's base branch is main.
**How to avoid:** This is actually the desired behavior -- PRs to feat/* branches should not trigger CI. Just ensure PRs that should be checked target main.

### Pitfall 4: Branch Protection Before First Workflow Run
**What goes wrong:** Cannot configure required status checks because GitHub doesn't know the check names yet.
**Why it happens:** GitHub only shows status checks in the branch protection dropdown after they've run at least once.
**How to avoid:** First merge the workflow file, then create a test PR to trigger it, then configure branch protection with the now-visible check names.

## Code Examples

### Complete CI Workflow
```yaml
name: CI

on:
  pull_request:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  typecheck:
    name: Typecheck
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    name: Test
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm test
```

### Branch Protection Setup (Manual Steps)
```
1. Go to GitHub repo > Settings > Branches
2. Click "Add branch protection rule"
3. Branch name pattern: main
4. Enable "Require status checks to pass before merging"
5. Enable "Require branches to be up to date before merging"
6. Search and add these status checks:
   - "CI / Lint"
   - "CI / Typecheck"
   - "CI / Test"
7. Leave "Require pull request reviews" UNCHECKED
8. Click "Create" / "Save changes"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| actions/checkout@v3 | actions/checkout@v4 | Sep 2023 | Uses Node 20 runtime |
| actions/setup-node@v3 | actions/setup-node@v4 | Oct 2023 | Uses Node 20 runtime |
| `.eslintrc.json` | `eslint.config.mjs` (flat config) | ESLint 9 | Already using flat config |

**Deprecated/outdated:**
- `actions/checkout@v3`: Still works but uses Node 16 which is deprecated on GitHub Actions
- `set-output` command: Replaced by `$GITHUB_OUTPUT` environment file

## Discretion Decisions (Recommendations)

### ESLint Env Vars
**Recommendation:** Not needed. Verified the ESLint config has no env var dependencies and no type-aware linting that would trigger TypeScript project resolution.

### Actions Versions
**Recommendation:** `actions/checkout@v4` and `actions/setup-node@v4` -- both are current latest major versions.

### Timeout Values
**Recommendation:** 5 minutes for all three jobs. Current local execution times: lint ~10s, typecheck ~15s, npm ci ~10-30s. 5 minutes provides generous buffer for CI environment variability without allowing runaway processes.

### Concurrency Groups
**Recommendation:** Yes, add concurrency groups. Cancels in-progress runs when new commits are pushed to the same PR. Saves Actions minutes, standard practice, no downside.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` (same -- all 170 tests run in <1s) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CICD-01 | Lint runs on PR | smoke (CI workflow) | `npm run lint` | N/A -- workflow file |
| CICD-02 | Typecheck runs on PR | smoke (CI workflow) | `npx tsc --noEmit` | N/A -- workflow file |
| CICD-03 | Tests run on PR | smoke (CI workflow) | `npm test` | N/A -- workflow file |
| CICD-04 | Merges blocked on failure | manual-only | Manual: open PR with type error, verify merge blocked | N/A -- GitHub settings |

### Sampling Rate
- **Per task commit:** `npm run lint && npx tsc --noEmit && npm test`
- **Per wave merge:** Same (no separate full suite)
- **Phase gate:** Create test PR, verify all 3 checks pass, verify branch protection blocks bad PR

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. This phase creates CI infrastructure, not application code or tests.

## Open Questions

None -- all questions resolved during research. This is a well-understood, low-risk phase.

## Sources

### Primary (HIGH confidence)
- Local file inspection: `eslint.config.mjs`, `vitest.config.ts`, `tsconfig.json`, `package.json`, `.github/workflows/cron-sync.yml`
- Local test execution: 170 tests passing in <1s

### Secondary (MEDIUM confidence)
- GitHub Actions documentation for actions/checkout@v4 and actions/setup-node@v4 -- standard, well-known actions
- GitHub branch protection documentation -- stable feature, well-documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new tools, all already installed and configured
- Architecture: HIGH -- single workflow file, well-established GitHub Actions patterns
- Pitfalls: HIGH -- verified ESLint config locally, documented status check naming

**Research date:** 2026-03-05
**Valid until:** 2026-06-05 (90 days -- GitHub Actions is stable, no breaking changes expected)
