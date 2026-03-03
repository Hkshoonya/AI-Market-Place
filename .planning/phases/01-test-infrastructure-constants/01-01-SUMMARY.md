---
phase: 01-test-infrastructure-constants
plan: 01
subsystem: testing
tags: [vitest, typescript, constants, scoring, path-alias]

# Dependency graph
requires: []
provides:
  - Vitest 4 test runner configured with TypeScript and @/* path alias (TEST-01)
  - src/lib/constants/scoring.ts with all scoring magic numbers as named exports (CONST-01, CONST-02, CONST-03)
affects: [02-scoring-refactor, 03-api-test-coverage, 08-final-test-coverage]

# Tech tracking
tech-stack:
  added: [vitest@4]
  patterns: [colocated test files src/**/*.test.ts, UPPER_SNAKE_CASE constants, named exports only]

key-files:
  created:
    - vitest.config.ts
    - src/lib/constants/scoring.ts
  modified:
    - package.json

key-decisions:
  - "passWithNoTests: true added to vitest config so runner exits 0 when no test files exist yet"
  - "Two separate coverage penalty tables: POPULARITY_COVERAGE_PENALTY (market-cap) and EVIDENCE_COVERAGE_PENALTY (quality/expert)"
  - "DEFAULT_PROVIDER_MAU exported as named constant so fallback value is a single source of truth"

patterns-established:
  - "Constants: UPPER_SNAKE_CASE named exports, no default exports, clear section headers with comment dividers"
  - "Tests: colocated in src/**/*.test.ts, node environment (no DOM), explicit imports (globals: false)"

requirements-completed: [TEST-01, CONST-01, CONST-02, CONST-03]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 01 Plan 01: Test Infrastructure + Constants Summary

**Vitest 4 configured with TypeScript/path-alias support and scoring magic numbers centralized into src/lib/constants/scoring.ts with 10 named exports**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-03T22:32:47Z
- **Completed:** 2026-03-03T22:36:34Z
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

- Installed Vitest 4 and created vitest.config.ts with @/* path alias matching tsconfig, node environment, and passWithNoTests for clean exit before any tests exist
- Added "test" and "test:watch" npm scripts to package.json
- Created src/lib/constants/scoring.ts exporting all 10 scoring constants: MARKET_CAP_SCALE_FACTOR, USAGE_EXPONENT, MAX_PRICE_NORMALIZATION, MIN_EFFECTIVE_PRICE, POPULARITY_COVERAGE_PENALTY, EVIDENCE_COVERAGE_PENALTY, getCoveragePenalty, PROVIDER_USAGE_ESTIMATES, DEFAULT_PROVIDER_MAU, getProviderUsageEstimate

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure Vitest with TypeScript and path aliases** - `3016af5` (chore)
2. **Task 2: Create scoring constants file with all extracted magic numbers** - `6eb5692` (feat)

## Files Created/Modified

- `vitest.config.ts` - Vitest configuration with @/* alias, node env, src/**/*.test.ts include pattern, passWithNoTests
- `src/lib/constants/scoring.ts` - All scoring magic numbers as named exports (CONST-01/02/03)
- `package.json` - Added vitest devDependency, test and test:watch scripts

## Decisions Made

- Added `passWithNoTests: true` to vitest config because Vitest 4 exits with code 1 when no test files match the include pattern. The plan spec says "exits cleanly" and "0 test files is OK", so this option is required.
- Exported TWO separate coverage penalty tables (POPULARITY_COVERAGE_PENALTY and EVIDENCE_COVERAGE_PENALTY) to accurately represent the distinct penalty logic in market-cap-calculator vs quality/expert calculators.
- Exported DEFAULT_PROVIDER_MAU as a named constant (1_000_000) rather than keeping it as an inline magic number in getProviderUsageEstimate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added passWithNoTests: true to vitest config**
- **Found during:** Task 1 (Configure Vitest)
- **Issue:** Vitest 4 exits with code 1 when no test files are found, making the required "exits cleanly" verification fail even though the plan explicitly says "0 test files is OK"
- **Fix:** Added `passWithNoTests: true` to vitest.config.ts test options
- **Files modified:** vitest.config.ts
- **Verification:** `npx vitest run` exits with code 0 and prints "No test files found, exiting with code 0"
- **Committed in:** 3016af5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (missing critical config for correct operation)
**Impact on plan:** Required for correct operation per plan spec. No scope creep.

## Issues Encountered

None beyond the passWithNoTests config adjustment documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Vitest runner ready for test authoring in any future phase
- All scoring magic numbers centralized in scoring.ts, ready for Plan 02 to wire into market-cap-calculator, quality-calculator, and expert-calculator
- Zero behavior changes: npx tsc --noEmit passes clean, scoring calculators still import their own constants (wiring happens in Plan 02)

---
*Phase: 01-test-infrastructure-constants*
*Completed: 2026-03-03*
