---
phase: 21-admin-visibility
plan: 01
subsystem: api
tags: [pipeline-health, admin, supabase, vitest, zod, typescript]

# Dependency graph
requires:
  - phase: 20-pipeline-hardening
    provides: pipeline_health table, /api/pipeline/health route, createAdminClient pattern

provides:
  - computeStatus shared function (extracted from pipeline health route)
  - mapSyncJobStatus vocabulary bridge function
  - HEALTH_PRIORITY sorting constant
  - formatRelativeTime with sub-day granularity (seconds/minutes/hours/days)
  - GET /api/admin/sync with ?source= and ?limit= query params
  - GET /api/admin/pipeline/health — admin-session-authenticated full adapter detail

affects: [21-02, 21-03, admin dashboard frontend, pipeline health display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Shared computation lib (pipeline-health-compute.ts) imported by multiple routes
    - Dual-client admin pattern: createClient() for session auth, createAdminClient() for data queries
    - TDD with vi.useFakeTimers() for deterministic staleness/time tests

key-files:
  created:
    - src/lib/pipeline-health-compute.ts
    - src/lib/pipeline-health-compute.test.ts
    - src/lib/format.test.ts
    - src/app/api/admin/sync/route.test.ts
    - src/app/api/admin/pipeline/health/route.ts
    - src/app/api/admin/pipeline/health/route.test.ts
  modified:
    - src/lib/format.ts (added formatRelativeTime)
    - src/app/api/pipeline/health/route.ts (replaced local computeStatus with import)
    - src/app/api/admin/sync/route.ts (added source + limit params)

key-decisions:
  - "/api/admin/pipeline/health uses session+is_admin auth (not CRON_SECRET) for browser-safe admin data access"
  - "computeStatus extracted to shared lib to eliminate duplication between public and admin health routes"
  - "mapSyncJobStatus bridges sync_jobs.status DB vocabulary ('completed') to frontend vocabulary ('success')"
  - "Admin sync limit clamped 1-100; invalid limit values default to 50 (backward compatible)"

patterns-established:
  - "Dual-client admin pattern: createClient() for session auth, createAdminClient() for data via RLS bypass"
  - "Shared lib pattern: computeStatus in pipeline-health-compute.ts imported by both public and admin routes"

requirements-completed: [ADMN-01, ADMN-02, ADMN-03]

# Metrics
duration: 6min
completed: 2026-03-12
---

# Phase 21 Plan 01: Admin Visibility Backend — Summary

**Shared computeStatus lib + formatRelativeTime + admin-session-authenticated pipeline health endpoint with per-adapter detail, and sync API extended with source/limit filtering**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-12T03:53:26Z
- **Completed:** 2026-03-12T03:58:51Z
- **Tasks:** 2
- **Files modified:** 8 (5 new, 3 modified)

## Accomplishments

- Extracted `computeStatus`, `mapSyncJobStatus`, `HEALTH_PRIORITY` into shared `pipeline-health-compute.ts` library (eliminates duplication between public and admin health routes)
- Added `formatRelativeTime` to `format.ts` with sub-minute/minute/hour/day granularity, delegating to `formatRelativeDate` for >= 7 days
- Created `/api/admin/pipeline/health` endpoint returning full `PipelineHealthDetailSchema` with per-adapter breakdown, using session+is_admin auth (browser-compatible)
- Extended `/api/admin/sync` with `?source=` and `?limit=` query params while maintaining backward compatibility (default limit=50)
- 46 total tests across 4 test files: all passing

## Task Commits

Each task was committed atomically using TDD (RED then GREEN):

1. **Task 1: Extract shared pipeline health lib + formatRelativeTime** - `c41ddca` (feat)
2. **Task 2: Extend sync API with source filter + create admin pipeline health endpoint** - `ab117db` (feat)

*Note: TDD tasks — tests were written first (RED), then implementation (GREEN).*

## Files Created/Modified

- `src/lib/pipeline-health-compute.ts` — Shared `computeStatus`, `mapSyncJobStatus`, `HEALTH_PRIORITY` exports
- `src/lib/pipeline-health-compute.test.ts` — 17 tests for all compute behaviors
- `src/lib/format.ts` — Added `formatRelativeTime` with sub-day granularity
- `src/lib/format.test.ts` — 16 tests for `formatRelativeTime` covering all time ranges
- `src/app/api/pipeline/health/route.ts` — Replaced local `computeStatus` with shared lib import
- `src/app/api/admin/sync/route.ts` — Added `?source=` and `?limit=` query params with clamping
- `src/app/api/admin/sync/route.test.ts` — 7 tests for auth, default limit, source filter, limit param
- `src/app/api/admin/pipeline/health/route.ts` — New admin-session-authenticated pipeline health endpoint
- `src/app/api/admin/pipeline/health/route.test.ts` — 6 tests for auth, full adapter shape, health status computation

## Decisions Made

- `/api/admin/pipeline/health` uses `createClient()` for session auth and `createAdminClient()` for data queries. This dual-client pattern is required because the browser cannot send `Bearer CRON_SECRET` headers, but admin data queries need RLS bypass via service role key.
- `computeStatus` is now the single source of truth for health status computation — both public and admin routes import from `pipeline-health-compute.ts`.
- `mapSyncJobStatus` maps `"completed"` -> `"success"` to bridge the vocabulary mismatch between `sync_jobs.status` DB column and `STATUS_CONFIG` used in the frontend page.
- Admin sync `?limit=` is clamped to the range 1-100; any invalid or out-of-range value defaults to 50.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 3 API data sources for the admin dashboard are ready: `/api/admin/sync?source=X`, `/api/admin/pipeline/health`, and `/api/admin/data-sources` (pre-existing)
- Plans 02/03 can now build the frontend admin dashboard against these stable API contracts
- `computeStatus`, `mapSyncJobStatus`, `HEALTH_PRIORITY` available for frontend sorting/display logic

---
*Phase: 21-admin-visibility*
*Completed: 2026-03-12*
