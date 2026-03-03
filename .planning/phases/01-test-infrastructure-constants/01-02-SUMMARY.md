---
phase: 01-test-infrastructure-constants
plan: 02
subsystem: scoring
tags: [constants, refactor, scoring, market-cap, quality, expert, coverage-penalty]

# Dependency graph
requires: [01-01]
provides:
  - All scoring calculators importing named constants from @/lib/constants/scoring (CONST-01, CONST-02, CONST-03)
  - No inline magic numbers in market cap formula, coverage penalties, or provider MAU
affects: [02-scoring-refactor, 03-api-test-coverage]

# Tech tracking
tech-stack:
  added: []
  patterns: [single-source-of-truth constants, re-export for backward compat, getCoveragePenalty lookup table]

key-files:
  modified:
    - src/lib/scoring/market-cap-calculator.ts
    - src/lib/scoring/quality-calculator.ts
    - src/lib/scoring/expert-calculator.ts
    - src/app/api/cron/compute-scores/route.ts

key-decisions:
  - "market-cap-calculator re-exports PROVIDER_USAGE_ESTIMATES and getProviderUsageEstimate from constants for backward compat during transition"
  - "Import-only pattern used: PROVIDER_USAGE_ESTIMATES/getProviderUsageEstimate removed from market-cap-calculator body; re-exported via separate export statement"
  - "agent-score-calculator.ts intentionally NOT modified: its 0.5+0.5*sqrt coverage is an algorithmic formula, not a lookup table"
  - "TOTAL_POSSIBLE_SIGNALS local const in market-cap-calculator intentionally left as-is: it counts signal types defined in that function, not an extractable constant"

requirements-completed: [CONST-01, CONST-02, CONST-03]

# Metrics
duration: 8min
completed: 2026-03-03
---

# Phase 01 Plan 02: Wire Scoring Calculators to Constants Summary

**All scoring calculator magic numbers externalized: market-cap, quality, and expert calculators now import named constants from @/lib/constants/scoring with zero behavior change**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-03T22:40:00Z
- **Completed:** 2026-03-03T22:48:00Z
- **Tasks:** 3 of 3
- **Files modified:** 4

## Accomplishments

- Removed 53 lines of duplicated PROVIDER_USAGE_ESTIMATES + getProviderUsageEstimate from market-cap-calculator.ts, replaced with import + re-export from @/lib/constants/scoring
- Replaced inline 1300, 1.2, 0.10, 20 literals in computeMarketCap() with MARKET_CAP_SCALE_FACTOR, USAGE_EXPONENT, MIN_EFFECTIVE_PRICE, MAX_PRICE_NORMALIZATION
- Replaced coverage if/else chain (4 branches) in computePopularityScore() with getCoveragePenalty(POPULARITY_COVERAGE_PENALTY, signals.length)
- Added EVIDENCE_COVERAGE_PENALTY + getCoveragePenalty import to quality-calculator.ts; replaced 5-branch if/else with single lookup call
- Added EVIDENCE_COVERAGE_PENALTY + getCoveragePenalty import to expert-calculator.ts; replaced 5-branch if/else with single lookup call
- Updated compute-scores route.ts to import getProviderUsageEstimate from @/lib/constants/scoring (canonical source)
- npx tsc --noEmit passes with zero errors throughout

## Task Commits

Each task was committed atomically:

1. **Task 1: Update market-cap-calculator** - `d8f7290` (refactor)
2. **Task 2: Update quality-calculator and expert-calculator** - `1131b6f` (refactor)
3. **Task 3: Update compute-scores route** - `d836776` (refactor)

## Files Created/Modified

- `src/lib/scoring/market-cap-calculator.ts` - Removed 53 lines of inline constants/function; added import from @/lib/constants/scoring; added re-export; replaced magic numbers with named constants; replaced coverage if/else with getCoveragePenalty lookup
- `src/lib/scoring/quality-calculator.ts` - Added import; replaced coverage if/else chain with getCoveragePenalty lookup
- `src/lib/scoring/expert-calculator.ts` - Added import; replaced coverage if/else chain with getCoveragePenalty lookup
- `src/app/api/cron/compute-scores/route.ts` - Split import: getProviderUsageEstimate now from @/lib/constants/scoring

## Decisions Made

- Re-exported PROVIDER_USAGE_ESTIMATES and getProviderUsageEstimate from market-cap-calculator.ts via `export { ... } from "@/lib/constants/scoring"` to ensure backward compatibility during transition. The route.ts Task 3 then migrates to the canonical import, but the re-export remains as a safety net for any other consumers.
- agent-score-calculator.ts was intentionally not modified. Its coverage penalty uses a continuous formula (`0.5 + 0.5 * Math.sqrt(coverageFraction)`) rather than a discrete lookup table — it is algorithmically different from the other calculators and has no equivalent constant to extract.
- TOTAL_POSSIBLE_SIGNALS local const in computePopularityScore() was intentionally left as-is. It counts the number of signal types defined in that function body, making it a local derived count rather than an extractable magic number.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript compilation passed clean after each task.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All scoring calculators now have zero inline magic numbers for coverage penalties and market cap formula
- Constants are the single source of truth in @/lib/constants/scoring
- Build is green: npx tsc --noEmit passes clean
- Ready for Phase 1 Plan 03 (test authoring for scoring calculators) or Phase 2 (scoring refactor)

---
*Phase: 01-test-infrastructure-constants*
*Completed: 2026-03-03*
