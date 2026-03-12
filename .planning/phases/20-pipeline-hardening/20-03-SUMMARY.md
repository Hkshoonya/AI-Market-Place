---
phase: 20-pipeline-hardening
plan: "03"
subsystem: pipeline-health-api
tags: [api, pipeline, health, monitoring, zod, tdd]
dependency_graph:
  requires:
    - pipeline_health table (Supabase migration)
    - data_sources table (seeded by Plan 20-01)
    - src/lib/supabase/admin.ts (createAdminClient)
    - src/lib/api-error.ts (handleApiError)
  provides:
    - GET /api/pipeline/health (public summary)
    - GET /api/pipeline/health with Bearer CRON_SECRET (authed detail)
  affects:
    - src/types/database.ts (pipeline_health table type added)
tech_stack:
  added: []
  patterns:
    - TDD (RED -> GREEN)
    - Zod response validation at API boundary
    - Bearer token auth matching cron route pattern
    - Worst-wins status aggregation
key_files:
  created:
    - src/app/api/pipeline/health/route.ts
    - src/app/api/pipeline/health/route.test.ts
  modified:
    - src/types/database.ts
decisions:
  - "pipeline_health table type added to Database typedef to fix TypeScript never inference on typed Supabase client"
  - "afterEach import added to test (globals:false in vitest config)"
  - "Adapter with no pipeline_health row treated as down (last_success_at=null => staleness=Infinity > 4x interval)"
metrics:
  duration_minutes: 8
  completed_date: "2026-03-12"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 3
requirements:
  - PIPE-07
---

# Phase 20 Plan 03: Pipeline Health Endpoint Summary

**One-liner:** HTTP health endpoint for pipeline monitoring with public aggregate summary and authed per-adapter breakdown using Zod validation and consecutive_failures + staleness worst-wins logic.

## Objective

Create `/api/pipeline/health` to enable monitoring, alerting, and the admin dashboard (Phase 21) to check pipeline status at a glance — without any prior HTTP visibility into the sync pipeline's health.

## Tasks Completed

### Task 1 (TDD): Create /api/pipeline/health endpoint

**RED:** Created `route.test.ts` with 13 tests covering public summary, authed detail, status computation (healthy/degraded/down), staleness rules, never-synced adapters, and error handling. Confirmed failure before implementation.

**GREEN:** Implemented `route.ts` with:
- `computeStatus()` pure function: `failures >= 3 || staleness > 4x interval` → down; `failures >= 1 || staleness > 2x interval` → degraded; else healthy
- `GET` handler: parallel query of `data_sources` and `pipeline_health`, in-code join, per-adapter status computation, worst-wins top-level status
- Public path: `PipelineHealthSummarySchema.parse()` returns `{status, healthy, degraded, down, checkedAt}`
- Authed path: `PipelineHealthDetailSchema.parse()` adds `adapters[]` with `{slug, status, lastSync, consecutiveFailures, recordCount, error}`
- `handleApiError` for all error paths, `dynamic = "force-dynamic"` prevents caching

All 13 tests pass.

**Commit:** `7a136cf` (RED), `36eae6f` (GREEN)

## Verification Results

- `npx vitest run --project unit src/app/api/pipeline/health/route.test.ts` — 13/13 pass
- `npx tsc --noEmit` — no errors in pipeline/health files (pre-existing errors in 20-01/02 test files are out of scope)
- `npx eslint src/app/api/pipeline/health/route.ts ...` — no lint errors
- Public response: does NOT include `adapters` field
- Authed response: includes full `adapters[]` breakdown

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added pipeline_health to Database typedef**

- **Found during:** Task 1, GREEN phase (TypeScript type check)
- **Issue:** The `Database` interface in `src/types/database.ts` had no entry for `pipeline_health`. The typed Supabase client (`SupabaseClient<Database>`) infers `never` for unknown tables, causing `TS2339: Property 'source_slug' does not exist on type 'never'`
- **Fix:** Added `pipeline_health` table Row/Insert/Update types to `Database.public.Tables`
- **Files modified:** `src/types/database.ts`
- **Commit:** `36eae6f`

**2. [Rule 3 - Blocking] Fixed missing afterEach import in test**

- **Found during:** Task 1, GREEN phase (test run)
- **Issue:** `afterEach is not defined` — vitest config has `globals: false`, so all test utilities must be imported explicitly
- **Fix:** Added `afterEach` to import from "vitest"
- **Files modified:** `src/app/api/pipeline/health/route.test.ts`
- **Commit:** `36eae6f`

## Success Criteria Met

- [x] GET /api/pipeline/health returns aggregate pipeline status (PIPE-07)
- [x] Public: summary counts only (healthy/degraded/down/checkedAt)
- [x] Authed: full per-adapter detail (slug, status, lastSync, consecutiveFailures, recordCount, error)
- [x] Status computed from consecutive_failures AND staleness, worst wins
- [x] Zod validates response shape
- [x] Tests cover public, authed, healthy, degraded, down, staleness, and error scenarios

## Self-Check: PASSED

Files confirmed present:
- `src/app/api/pipeline/health/route.ts` — FOUND
- `src/app/api/pipeline/health/route.test.ts` — FOUND

Commits confirmed:
- `7a136cf` (RED test commit) — FOUND
- `36eae6f` (GREEN implementation commit) — FOUND
