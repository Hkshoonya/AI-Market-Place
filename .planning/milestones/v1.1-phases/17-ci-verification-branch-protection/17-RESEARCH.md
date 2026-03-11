# Phase 17: CI Pipeline Verification + Branch Protection - Research

**Researched:** 2026-03-11
**Domain:** GitHub Actions CI verification, GitHub branch protection rules, private repository constraints
**Confidence:** HIGH

## Summary

Phase 17 is a gap-closure phase with two distinct work streams: (1) writing a VERIFICATION.md for Phase 10 that formally documents CI job evidence, and (2) configuring GitHub branch protection rules for the main branch. The CI functionality (CICD-01, CICD-02, CICD-03) is fully delivered — all four jobs (Lint, Typecheck, Test, E2E) run and pass in GitHub Actions. The gap is purely documentary: Phase 10 never produced a VERIFICATION.md file.

The branch protection work (CICD-04) has a material constraint: the repository is **private and on GitHub Free**. The GitHub Free plan does not support branch protection rules for private repositories. This requires a decision from the user: upgrade to GitHub Pro (~$4/month), make the repo public, or document the limitation and satisfy the intent of CICD-04 through an alternative process signal (e.g., verified manual workflow discipline). This decision must be made before planning Task 2.

The verification document itself (Task 1) can be written immediately and autonomously — all evidence is available from GitHub Actions API and local file inspection. It follows the same structure as the existing `09-VERIFICATION.md`.

**Primary recommendation:** Task 1 (VERIFICATION.md) is fully automatable. Task 2 (branch protection) requires a human decision on the GitHub Free plan constraint before it can be executed; the plan must present options and a human-action checkpoint.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CICD-01 | GitHub Actions workflow runs lint on every PR | CI Lint job confirmed passing in run 22938106579 (2026-03-11); `npm run lint` exits 0 locally |
| CICD-02 | GitHub Actions workflow runs `tsc --noEmit` on every PR | CI Typecheck job confirmed passing in run 22938106579; `npx tsc --noEmit` exits 0 locally |
| CICD-03 | GitHub Actions workflow runs `vitest run` on every PR | CI Test job confirmed passing in run 22938106579; `npm test` passes 222 tests locally |
| CICD-04 | PR merges blocked unless all CI checks pass | GitHub branch protection NOT configured; repo is private + GitHub Free — paid plan required for private repo branch protection |
</phase_requirements>

## Factual State of CI Pipeline (Pre-Phase Evidence)

### What is delivered and working

The CI workflow at `.github/workflows/ci.yml` was created in Phase 10 and has run successfully. Verified via GitHub Actions API (`gh run view 22938106579`):

| Job | Status | Run ID | Date |
|-----|--------|--------|------|
| Lint | success | 22938106579 | 2026-03-11 |
| Typecheck | success | 22938106579 | 2026-03-11 |
| Test | success | 22938106579 | 2026-03-11 |
| E2E | success | 22938106579 | 2026-03-11 |

Timing from that run: Lint ~1 min, Typecheck ~1 min, Test ~52s, E2E ~4 min. All parallel.

Current local state (2026-03-11): `npm run lint` exits 0 (0 errors), `npx tsc --noEmit` exits 0 (clean), `npm test` passes 222 tests across 22 test files.

The CI workflow was also triggered by a pull_request event on `test-ci` branch on 2026-03-07 (runs 22807885290 and 22807925192, both success, ~1 min each). This confirms the pull_request trigger fires correctly.

### What is NOT delivered

1. **VERIFICATION.md for Phase 10** — the only v1.1 phase without a formal verification report. All other phases (9, 11-16) have one.
2. **GitHub branch protection on main** — Task 2 in the original 10-01-PLAN.md was a human-action checkpoint that was never completed. The audit confirms `gh api repos/.../branches/main/protection` returns 403.

### CI workflow structure (current)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:     # name: Lint     — runs npm run lint
  typecheck: # name: Typecheck — runs npx tsc --noEmit
  test:     # name: Test     — runs npm test
  e2e:      # name: E2E      — runs npx playwright test (added in Phase 15)
```

Status check names that appear on PRs: `CI / Lint`, `CI / Typecheck`, `CI / Test`, `CI / E2E`

## The Branch Protection Constraint (CICD-04)

### What the API told us

```
gh api repos/Hkshoonya/AI-Market-Place/branches/main/protection
→ {"message":"Upgrade to GitHub Pro or make this repository public
   to enable this feature.","status":"403"}
```

```
gh api repos/Hkshoonya/AI-Market-Place --jq '{private: .private, visibility: .visibility}'
→ {"private": true, "visibility": "private"}
```

### The rule (HIGH confidence — official GitHub docs)

Branch protection rules are available for:
- Public repositories: ALL plans (GitHub Free, Pro, Team, Enterprise)
- Private repositories: GitHub Pro, Team, Enterprise Cloud, Enterprise Server ONLY

GitHub Free plan does NOT support branch protection rules for private repositories. Repository rulesets have the same restriction for private repos.

Source: [GitHub docs — About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

### Options for CICD-04

| Option | Cost | Impact | Tradeoff |
|--------|------|--------|----------|
| Upgrade to GitHub Pro | ~$4/month | Full branch protection available | Ongoing cost; enables full protection immediately |
| Make repo public | Free | Full branch protection available | Codebase, issues, PRs become public |
| Document limitation + process discipline | Free | CICD-04 satisfied by evidence trail | No enforcement — relies on developer discipline |
| GitHub Free Organizations | Free tier exists | Some features, but branch rules still blocked for private repos | Not applicable here — user account, not org |

**Recommendation:** Present all options to user as a human-action checkpoint. The plan cannot autonomously resolve this. However, the CICD-04 requirement can be satisfied by documenting the constraint clearly in VERIFICATION.md along with the chosen mitigation strategy, and noting that enforcement relies on developer practice if the free plan is retained.

## What the VERIFICATION.md Must Document

Phase 17's primary artifact is `10-VERIFICATION.md`. It must follow the same structure as `09-VERIFICATION.md` (the reference example). Key sections:

### Observable Truths to Verify

| # | Truth | Evidence Available |
|---|-------|--------------------|
| 1 | CI Lint job runs and passes on PR to main | GitHub Actions run history; `.github/workflows/ci.yml` lint job definition |
| 2 | CI Typecheck job runs and passes on PR to main | GitHub Actions run history; typecheck job definition |
| 3 | CI Test job runs and passes on PR to main | GitHub Actions run history; test job definition; 222 tests pass locally |
| 4 | CI E2E job runs and passes on PR to main (added Phase 15) | GitHub Actions run history; e2e job definition |
| 5 | PR with failing check shows red status (enforcement) | Historical evidence from test-ci PR runs; workflow_dispatch runs |

### Required Artifacts to Verify

| Artifact | Verification Method |
|----------|---------------------|
| `.github/workflows/ci.yml` | File exists, read structure, verify 4 jobs |
| GitHub Actions run history | `gh run list --workflow=ci.yml` |
| Branch protection status | `gh api .../branches/main/protection` (returns 403 = not configured) |

### CICD-04 Handling

The VERIFICATION.md must honestly document that branch protection is NOT configured and explain why (GitHub Free + private repo constraint). It must also document the status — whether the user has decided to: (a) upgrade plan, (b) make repo public, or (c) accept the limitation. This is the only truth that cannot be verified autonomously.

## Architecture Patterns

### Pattern 1: VERIFICATION.md as Evidence Document

The Phase 9 VERIFICATION.md is the canonical reference. Structure:
- Frontmatter with status/score/date
- Observable Truths table (what must be true → evidence found)
- Required Artifacts table (expected files → verification status)
- Key Link Verification (wiring checks)
- Requirements Coverage table (requirement IDs → SATISFIED/UNSATISFIED)
- Human Verification Required section (for items needing live environment)

Key principle: Evidence is specific. Not "the workflow runs" but "run 22938106579 on 2026-03-11 shows Lint/Typecheck/Test/E2E all succeeded."

### Pattern 2: Honest Gap Documentation

Where evidence is absent (branch protection not configured), the VERIFICATION.md must say UNSATISFIED or BLOCKED with clear reasoning. Not "pending" — that is vague. Include the specific API response and the plan constraint as evidence.

### Pattern 3: Human-Action Checkpoint for Branch Protection

The 10-01-PLAN.md already documents the manual steps for branch protection. Phase 17 planning should reference those steps and present them as a conditional task:
- IF user upgrades to Pro or makes repo public → follow the documented steps
- IF user keeps free plan + private → document the limitation as accepted constraint

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CI check evidence | Manual text assertions | GitHub Actions API (`gh run view`, `gh run list`) | API provides timestamps, job names, conclusions — authoritative source |
| Branch protection check | Scripted check | `gh api .../branches/main/protection` | Returns definitive 200/404/403 |
| VERIFICATION.md format | New structure | Copy Phase 9 VERIFICATION.md structure | Already established pattern for this project |

## Common Pitfalls

### Pitfall 1: Conflating "CI works" with "CICD-04 satisfied"
**What goes wrong:** Marking all four CICD requirements as SATISFIED because the workflow runs and passes.
**Why it happens:** CICD-01/02/03 are about running checks; CICD-04 is about blocking merges. These are distinct.
**How to avoid:** VERIFICATION.md must separately verify branch protection. If not configured, CICD-04 stays UNSATISFIED until the user takes action.
**Warning signs:** VERIFICATION.md shows status: passed for all 4 without GitHub branch protection evidence.

### Pitfall 2: Assuming branch protection can be configured via API
**What goes wrong:** Plan includes a task to configure branch protection via `gh api PATCH` — this will fail with 403.
**Why it happens:** Free plan + private repo restriction not understood upfront.
**How to avoid:** The plan must treat branch protection as a human-action checkpoint with conditional options, not an autonomous task.

### Pitfall 3: Status check names drifting after Phase 15
**What goes wrong:** Plan documents only 3 required status checks (from Phase 10 scope) but the workflow now has 4 jobs including E2E (added Phase 15).
**Why it happens:** The original CICD-04 requirement was written before Phase 15 added the E2E job.
**How to avoid:** VERIFICATION.md and any branch protection setup should reference the CURRENT 4 check names: `CI / Lint`, `CI / Typecheck`, `CI / Test`, `CI / E2E`. E2E-06 requirement says "E2E tests integrated into CI pipeline" — the E2E check should also be a required status check.

### Pitfall 4: VERIFICATION.md written with wrong score
**What goes wrong:** Score reported as "4/4 must-haves verified" when branch protection is absent.
**Why it happens:** Author conflates "functionality delivered" with "formally verified."
**How to avoid:** CICD-04 must be scored separately. Possible scoring: "3/4 CI checks verified + 1 blocked (CICD-04: branch protection not configured)"

## Code Examples

### Fetching CI run evidence via gh CLI
```bash
# List recent CI runs
gh run list --workflow=ci.yml --limit=10

# Get full job details for a specific run
gh run view 22938106579 --json jobs,conclusion,status,workflowName

# Check branch protection status
gh api repos/Hkshoonya/AI-Market-Place/branches/main/protection
```

### VERIFICATION.md frontmatter pattern (from Phase 9)
```yaml
---
phase: 10-ci-pipeline
verified: 2026-03-11T00:00:00Z
status: passed  # or: partial (if CICD-04 unresolved)
score: 3/4 must-haves verified (CICD-04 blocked pending user decision)
re_verification: true  # This is gap-closure verification, not initial
---
```

### Branch protection setup steps (if user upgrades or makes public)
```
1. Ensure the CI workflow has run at least once on a PR (already done — test-ci PR 2026-03-07)
2. Go to https://github.com/Hkshoonya/AI-Market-Place/settings/branches
3. Click "Add branch protection rule" (or "Add ruleset" if repo is now under Pro)
4. Branch name pattern: main
5. CHECK: "Require status checks to pass before merging"
6. CHECK: "Require branches to be up to date before merging"
7. Add these 4 status checks:
   - CI / Lint
   - CI / Typecheck
   - CI / Test
   - CI / E2E (added in Phase 15)
8. LEAVE UNCHECKED: "Require pull request reviews before merging"
9. Click "Create" / "Save changes"
```

## State of the Art

| Old Understanding | Current Reality | Impact |
|-------------------|-----------------|--------|
| Phase 10 had 3 CI jobs | Phase 10 has 4 CI jobs (E2E added in Phase 15) | VERIFICATION.md and branch protection must reference 4 checks |
| Branch protection was pending human action | Branch protection is blocked by GitHub Free + private repo | Task 2 requires user decision on plan/visibility |
| 170 tests passing | 222 tests passing | VERIFICATION.md should reflect current test count |
| Node 22 in workflow | Node 24 in workflow (upgraded at some point) | Minor — cosmetic difference from Phase 10 plan spec |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CICD-01 | Lint job runs and passes | smoke | `npm run lint` | N/A (workflow file) |
| CICD-02 | Typecheck job runs and passes | smoke | `npx tsc --noEmit` | N/A (workflow file) |
| CICD-03 | Test job runs and passes | smoke | `npm test` | N/A (workflow file) |
| CICD-04 | PR merges blocked on CI failure | manual-only | Manual: configure branch protection, open PR with type error, verify merge blocked | N/A (GitHub settings) |

### Sampling Rate
- **Per task commit:** `npm run lint && npx tsc --noEmit && npm test`
- **Per wave merge:** Same
- **Phase gate:** VERIFICATION.md written and committed; CICD-04 human decision documented

### Wave 0 Gaps
None — this phase creates documentation artifacts only, not application code or tests. No new test infrastructure needed.

## Open Questions

1. **Does the user want to upgrade to GitHub Pro or make the repo public?**
   - What we know: GitHub Free + private repo = no branch protection; API confirmed 403
   - What's unclear: User's preference (cost vs. public vs. accepted limitation)
   - Recommendation: Present all options as a blocking human-action checkpoint; do not default to any choice. The plan should describe each option and its tradeoff.

2. **Should CICD-04 be re-scoped or kept as written?**
   - What we know: The intent of CICD-04 is to prevent bad code from merging; branch protection is the standard mechanism
   - What's unclear: Whether a process-based solution (documented manual discipline) satisfies the spirit of the requirement
   - Recommendation: Let the user decide. If they choose not to enable branch protection, mark CICD-04 as ACKNOWLEDGED LIMITATION with documented rationale rather than SATISFIED.

3. **Should the E2E check be added to required status checks?**
   - What we know: CICD-04 was written before Phase 15 added the E2E job; the Phase 15 audit notes "E2E-06 branch protection not confirmed for e2e job"
   - Recommendation: Yes — if branch protection is configured, include `CI / E2E` as a required check to satisfy E2E-06 as well. This costs nothing additional.

## Sources

### Primary (HIGH confidence)
- `gh run view 22938106579` — GitHub Actions API, verified all 4 jobs passed 2026-03-11
- `gh run list --workflow=ci.yml --limit=5` — confirms PR trigger fired 2026-03-07 (runs 22807885290, 22807925192)
- `gh api repos/Hkshoonya/AI-Market-Place/branches/main/protection` — confirmed 403 (branch protection not configured, Free plan + private)
- `gh api repos/Hkshoonya/AI-Market-Place --jq '{private, visibility}'` — confirmed private, user plan
- `.github/workflows/ci.yml` — read directly, confirmed 4 jobs, current structure
- `.planning/phases/10-ci-pipeline/10-01-SUMMARY.md` — Task 2 confirmed as PENDING
- `.planning/phases/09-observability/09-VERIFICATION.md` — canonical VERIFICATION.md format reference
- `.planning/v1.1-MILESTONE-AUDIT.md` — gap analysis, confirmed CICD-01/02/03 orphaned, CICD-04 unsatisfied

### Secondary (MEDIUM confidence)
- [GitHub Docs — About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) — confirmed plan requirements for branch protection on private repos
- [GitHub Community Discussion #72725](https://github.com/orgs/community/discussions/72725) — confirmed "GitHub Free for organizations — branch rules cannot be assigned to private repositories"

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- CI pipeline state (CICD-01/02/03): HIGH — verified via GitHub Actions API, local execution, file inspection
- Branch protection constraint (CICD-04): HIGH — confirmed via API 403, cross-referenced with official docs and community discussions
- VERIFICATION.md format: HIGH — reference example exists (09-VERIFICATION.md), same project, same tooling

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (branch protection constraint is structural; CI workflow is stable)
