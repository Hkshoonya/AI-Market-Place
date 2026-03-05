---
phase: 08-regression-testing
plan: 03
subsystem: testing
tags: [vitest, integration-test, compute-scores, supabase-mock, scoring-pipeline]

requires:
  - phase: 03-api-route-decomposition
    provides: decomposed compute-scores pipeline (fetchInputs, computeAllLenses, persistResults)
provides:
  - integration tests for all 3 compute-scores pipeline stages
  - mock Supabase client factory pattern for chained query builders
affects: []

tech-stack:
  added: []
  patterns: [thenable-mock-pattern, proxy-based-supabase-mock]

key-files:
  created:
    - src/lib/compute-scores/fetch-inputs.test.ts
    - src/lib/compute-scores/compute-all-lenses.test.ts
    - src/lib/compute-scores/persist-results.test.ts
  modified: []

key-decisions:
  - "Proxy-based mock Supabase client handles arbitrary chained query patterns (.from().select().eq().gte().not())"
  - "Thenable pattern (Promise.resolve in .then) used for persist mock to match Supabase PostgREST builder behavior"
  - "computeAllLenses test uses 3 models across 2 categories (llm, image_generation) to verify cross-category scoring"

patterns-established:
  - "Mock Supabase factory: createMockSupabase(overrides) with Proxy-based chain handling for test isolation"
  - "Thenable mock: { then: (fn) => Promise.resolve(fn(value)) } for Supabase query builder .then() chains"

requirements-completed: [TEST-04]

duration: 3min
completed: 2026-03-05
---

# Phase 08 Plan 03: Compute-Scores Pipeline Integration Tests Summary

**11 integration tests for fetchInputs, computeAllLenses, and persistResults using mock Supabase clients and fixture data**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T04:17:49Z
- **Completed:** 2026-03-05T04:21:28Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- fetchInputs tested with mock Supabase: success (models + benchmarks + ELO + news), error, and empty data cases
- computeAllLenses tested with 3-model fixture producing complete ScoringResults with all score/rank maps
- persistResults tested with mock Supabase: successful batch updates/snapshots and partial failure error counting
- All functions callable without Next.js server (no request/response objects needed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Integration tests for fetchInputs and persistResults** - `8dd1f49` (test)
2. **Task 2: Integration test for computeAllLenses** - `46ecb01` (test)

## Files Created/Modified
- `src/lib/compute-scores/fetch-inputs.test.ts` - 3 tests: success with populated maps, error throw, empty data edge case
- `src/lib/compute-scores/persist-results.test.ts` - 3 tests: full success, partial failure with error counting, PersistStats shape
- `src/lib/compute-scores/compute-all-lenses.test.ts` - 5 tests: full ScoringResults shape, GPT-4o vs Llama ranking, SD-XL null capability, agent scores, rank map consistency

## Decisions Made
- Proxy-based mock Supabase client handles arbitrary chained query patterns without needing to enumerate every method
- Thenable pattern used for persist mock: `{ then: (fn) => Promise.resolve(fn(value)) }` matches Supabase PostgREST builder's `.then()` chain behavior which is critical for `Promise.all()` batching in persistResults
- computeAllLenses test uses 3 models across 2 categories to verify cross-category scoring behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed persist mock thenable pattern**
- **Found during:** Task 1 (persistResults tests)
- **Issue:** Initial mock used synchronous callback in `.then()` which caused `undefined` results in `Promise.all()` batching
- **Fix:** Changed to proper thenable pattern: `{ then: (fn) => Promise.resolve(fn(value)) }` so Promise.all resolves correctly
- **Files modified:** src/lib/compute-scores/persist-results.test.ts
- **Verification:** All 3 persistResults tests pass
- **Committed in:** 8dd1f49

---

**Total deviations:** 1 auto-fixed (1 bug in test mock)
**Impact on plan:** Necessary fix for correct Promise resolution. No scope creep.

## Issues Encountered
None beyond the mock thenable pattern fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 compute-scores pipeline stages have integration test coverage
- Pipeline functions verified callable without Next.js server context
- Mock Supabase factory pattern established for future test files

---
*Phase: 08-regression-testing*
*Completed: 2026-03-05*
