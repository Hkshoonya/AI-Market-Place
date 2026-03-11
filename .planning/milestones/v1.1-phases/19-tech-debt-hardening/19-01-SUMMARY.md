---
phase: 19-tech-debt-hardening
plan: 01
subsystem: infra
tags: [msw, eslint, typescript, ci, devDependencies, tech-debt]

# Dependency graph
requires:
  - phase: 18-e2e-model-detail-ci-fixture
    provides: MSW-based E2E fixture infrastructure that depends on msw package
  - phase: 16-code-simplification
    provides: Zero-warning ESLint baseline established for CI enforcement
provides:
  - msw as a direct devDependency (explicit, pinned, not transitive)
  - lint script enforces --max-warnings 0 for CI zero-warning gate
  - orphaned schemas barrel file removed (no callers)
affects: [ci-pipeline, future-phases, e2e-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct devDependency declaration for all packages used in test/CI infrastructure"
    - "--max-warnings 0 lint enforcement for hard zero-warning CI gate"

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
  deleted:
    - src/lib/schemas/index.ts

key-decisions:
  - "msw pinned to ^2.12.10 matching existing lockfile version to avoid unintended upgrades"
  - "lint script changed from 'eslint' to 'eslint --max-warnings 0' — CI already runs npm run lint so no CI YAML change needed"
  - "schemas barrel deleted without replacement — all 40+ callers already use sub-path imports; barrel was dead code"
  - "listing-reviews.tsx useEffect audit confirmed pre-resolved in Phase 14 SWR conversion — no action needed"

patterns-established:
  - "All E2E/test infrastructure packages must be explicit devDependencies, not relying on transitive resolution"

requirements-completed: [E2E-03, E2E-06, CICD-01, SIMP-01, SIMP-02]

# Metrics
duration: 8min
completed: 2026-03-11
---

# Phase 19 Plan 01: Tech Debt Hardening Summary

**msw promoted to direct devDependency, ESLint --max-warnings 0 enforced in lint script, and orphaned schemas barrel deleted — four v1.1 audit items closed**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-11T13:00:00Z
- **Completed:** 2026-03-11T13:08:00Z
- **Tasks:** 2
- **Files modified:** 3 (package.json, package-lock.json, deleted src/lib/schemas/index.ts)

## Accomplishments

- msw@^2.12.10 added to devDependencies — closes INT-MSW-DEP; E2E infrastructure no longer depends on transitive resolution via shadcn/vitest
- Lint script updated to `eslint --max-warnings 0` — closes INT-LINT-GATE; CI now hard-fails on any ESLint warning
- Deleted `src/lib/schemas/index.ts` barrel — closes SIMP-02; confirmed zero callers use this path (all 40+ imports use sub-paths like `@/lib/schemas/parse`)
- Confirmed `listing-reviews.tsx` has no `useEffect` import — closes SIMP-01; pre-resolved during Phase 14 SWR conversion

## Task Commits

Each task was committed atomically:

1. **Task 1: Promote msw to direct devDep and enforce zero-warning lint** - `40cd4b4` (chore)
2. **Task 2: Delete orphaned schemas barrel and confirm useEffect pre-resolution** - `f9f142a` (chore)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `package.json` - Added `msw: ^2.12.10` to devDependencies; changed lint script to `eslint --max-warnings 0`
- `package-lock.json` - Updated lockfile to reflect msw as direct dependency
- `src/lib/schemas/index.ts` - **Deleted** (orphaned barrel re-exporting sub-modules; zero callers)

## Decisions Made

- Pinned msw to `^2.12.10` (caret range matching lockfile version) to avoid unintended upgrades while staying compatible with future patch releases
- No change to `.github/workflows/ci.yml` needed — CI already invokes `npm run lint`, so the script-level flag change is sufficient
- Barrel deleted rather than kept as empty stub — all callers already import from sub-paths, confirmed via grep across entire `src/` tree

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm install -D msw@2.12.10` output said "up to date" on first run (msw was already in node_modules as transitive dep), but the `--save-dev` flag correctly added it to package.json devDependencies as `^2.12.10`. Verified via `node -p "require('./package.json').devDependencies.msw"`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four v1.1 audit items from the milestone re-audit are now closed
- CI is hardened: explicit deps, zero-warning lint gate, clean TypeScript, 222 passing tests
- Phase 19 plan 01 complete; ready for remaining tech-debt hardening plans if any

---
*Phase: 19-tech-debt-hardening*
*Completed: 2026-03-11*
