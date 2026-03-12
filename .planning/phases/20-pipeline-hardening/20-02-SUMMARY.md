---
phase: 20-pipeline-hardening
plan: "02"
subsystem: pipeline
tags: [sentry, logging, cron, orchestrator, monitoring, testing]

# Dependency graph
requires:
  - phase: 20-pipeline-hardening/20-01
    provides: "resolveSecrets() returning { secrets, missing }, pipeline_health table typedef, orchestrator refactored structure"
provides:
  - "Sentry.captureMessage warning at 3+ consecutive adapter failures with adapter/tier tags"
  - "systemLog.error structured entry for every adapter failure (adapter, tier, durationMs, consecutiveFailures, error)"
  - "recordSyncFailure() returns new consecutive failure count (Promise<number>)"
  - "Cron sync route details[].errors as string array (not count)"
  - "Cron sync route overallStatus field: partial/success"
  - "PIPE-05 verified: fetchWithRetry retries on 429/5xx up to 3 times"
  - "PIPE-06 verified: healthCheck() implemented on createAdapterSyncer adapters"
affects: [pipeline-hardening, monitoring, observability, cron-jobs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sentry.captureMessage with level/tags/extra for threshold-based alerting on consecutive failures"
    - "systemLog.error for every failure event (structured failure log per adapter run)"
    - "Cron response body includes overallStatus and error message strings, always HTTP 200"

key-files:
  created:
    - src/lib/data-sources/orchestrator.test.ts
    - src/app/api/cron/sync/route.test.ts
    - src/lib/data-sources/shared/adapter-syncer.test.ts
  modified:
    - src/lib/data-sources/orchestrator.ts
    - src/lib/pipeline-health.ts
    - src/app/api/cron/sync/route.ts

key-decisions:
  - "Cron sync endpoint always returns HTTP 200 (cron job itself succeeded); overallStatus field carries partial/success signal"
  - "recordSyncFailure() return type changed to Promise<number> to avoid extra DB read in orchestrator"

patterns-established:
  - "Threshold alerting pattern: use returned count from recordSyncFailure, fire Sentry at >= 3"
  - "Structured failure log pattern: every adapter failure gets systemLog.error with full context metadata"

requirements-completed: [PIPE-03, PIPE-05, PIPE-06]

# Metrics
duration: 8min
completed: 2026-03-12
---

# Phase 20 Plan 02: Failure Visibility Summary

**Sentry alerting on 3+ consecutive adapter failures, structured systemLog.error per failure, and cron route exposing error message strings instead of counts**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-12T02:49:00Z
- **Completed:** 2026-03-12T02:57:23Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Orchestrator now fires `Sentry.captureMessage` at warning level when any adapter hits 3+ consecutive failures, with adapter slug, adapter_type, and tier as Sentry tags
- Every adapter failure writes a structured `systemLog.error` entry including adapter, tier, durationMs, consecutiveFailures count, and error message
- Cron sync route response body changed from `errors: count` to `errors: string[]` and gained `overallStatus: "partial" | "success"`
- `recordSyncFailure()` updated to return the new consecutive failure count (`Promise<number>`) eliminating a secondary DB read
- 33 unit tests covering all failure paths, Sentry threshold logic, cron body shape, healthCheck behavior (PIPE-06), and retry behavior (PIPE-05)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Sentry alerting and structured failure logging to orchestrator** - `8e9d30c` (feat)
2. **Task 2: Update cron sync route to expose error messages and verify PIPE-05/PIPE-06** - `36af43a` (feat)

**Plan metadata:** TBD (docs: complete plan)

_Note: TDD tasks — RED tests written first, then implementation, then GREEN verified_

## Files Created/Modified

- `src/lib/data-sources/orchestrator.ts` - Added Sentry import, structured systemLog.error on failure, Sentry.captureMessage at 3+ consecutive failures
- `src/lib/pipeline-health.ts` - Updated recordSyncFailure() return type to Promise<number>, returns new failure count
- `src/app/api/cron/sync/route.ts` - Changed errors from count to string array, added overallStatus field
- `src/lib/data-sources/orchestrator.test.ts` - 7 tests: Sentry threshold, systemLog.error metadata, missing secrets warning
- `src/app/api/cron/sync/route.test.ts` - 11 tests: auth, tier validation, error messages shape, overallStatus
- `src/lib/data-sources/shared/adapter-syncer.test.ts` - 5 tests: PIPE-06 healthCheck implementation on createAdapterSyncer adapters

## Decisions Made

- Cron sync endpoint always returns HTTP 200 (cron infrastructure succeeded); `overallStatus` field carries the per-adapter outcome signal
- Changed `recordSyncFailure()` return type to `Promise<number>` (returns new count) — avoids an extra DB read to get the count for the Sentry threshold check

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Test for `healthCheck uses function-form healthCheckUrl` initially checked `fetch` call signature with 3 args, but `fetchWithRetry` passes 2 args to `fetch`. Fixed assertion to check only the URL argument.

## User Setup Required

None - no external service configuration required. Sentry is already configured; the new `captureMessage` call will emit warnings automatically when consecutive failures reach 3.

## Next Phase Readiness

- Failure visibility complete: Sentry alerts on repeated failures, structured logs on every failure, cron route exposes error details
- Plan 20-03 (startup validation and seeding) can proceed
- All 33 tests pass; type check clean; lint clean

---
*Phase: 20-pipeline-hardening*
*Completed: 2026-03-12*
