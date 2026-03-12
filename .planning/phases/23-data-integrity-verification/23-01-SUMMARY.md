---
phase: 23-data-integrity-verification
plan: 01
subsystem: api
tags: [data-integrity, quality-score, admin, supabase, zod, tdd, vitest]

# Dependency graph
requires:
  - phase: 21-admin-visibility
    provides: Admin auth pattern (session + is_admin check), createAdminClient, pipeline health route structure
  - phase: 20-pipeline-hardening
    provides: seed-config.ts with output_types mapping, SyncOutputType, pipeline_health table

provides:
  - verifyDataIntegrity() function assembling full DataIntegrityReport from DB queries
  - computeQualityScore/computeCompleteness/computeFreshness/computeTrend pure functions
  - TABLE_MAP verified against actual adapter code
  - GET /api/admin/data-integrity endpoint with session auth + Zod validation
  - DataIntegrityReport, SourceQualityScore, TableCoverage types

affects:
  - 23-02 (future admin UI displaying the data integrity report)
  - any phase needing quality score computation or freshness checks

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure computation functions tested independently of DB (TDD-friendly separation)
    - TABLE_MAP constant mapping SyncOutputType to actual DB table names (verified against adapter code)
    - Admin route pattern: createClient() for session auth, createAdminClient() for data
    - Zod parse-before-return for all API responses

key-files:
  created:
    - src/lib/data-integrity.ts
    - src/lib/data-integrity.test.ts
    - src/app/api/admin/data-integrity/route.ts
    - src/app/api/admin/data-integrity/route.test.ts
  modified: []

key-decisions:
  - "TABLE_MAP uses benchmark_scores (not model_scores) and elo_ratings (not elo_scores) -- verified by grepping actual adapter .from() calls"
  - "computeFreshness decay: 1.0 within interval, linear decay 1.0->0 over [interval, 4x interval], 0 beyond 4x"
  - "Quality score weights: completeness 40%, freshness 40%, trend 20% -- freshness and completeness dominate"
  - "verifyDataIntegrity fetches last 200 sync_jobs ordered by created_at desc to get 2 per source without N+1 queries"
  - "staleSince uses lastSyncAt + intervalHours (when source first went stale) rather than current time"

patterns-established:
  - "Pure computation functions (computeX) are separate from DB orchestration (verifyDataIntegrity) -- enables unit testing without mocking"
  - "formatDuration() local helper avoids the 'X ago' suffix from formatRelativeTime"

requirements-completed: [INTG-01, INTG-02, INTG-03, INTG-04]

# Metrics
duration: 5min
completed: 2026-03-12
---

# Phase 23 Plan 01: Data Integrity Verification Engine Summary

**Data integrity engine with per-source quality scores (completeness/freshness/trend), verified TABLE_MAP, and admin GET /api/admin/data-integrity endpoint backed by 53 TDD tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-12T16:11:07Z
- **Completed:** 2026-03-12T16:16:42Z
- **Tasks:** 2
- **Files modified:** 4 (all created)

## Accomplishments
- Pure quality score computation: `computeCompleteness`, `computeFreshness` (linear decay over 4x interval), `computeTrend`, `computeQualityScore` (40/40/20 weights)
- `verifyDataIntegrity()` assembles full `DataIntegrityReport` with table coverage, freshness report, and per-source scores from 3 DB queries (no N+1)
- `TABLE_MAP` verified against actual adapter `.from()` calls: `benchmark_scores`, `elo_ratings`, `model_news`, `model_pricing`
- Admin endpoint `GET /api/admin/data-integrity` with session+is_admin auth, admin client bypass, Zod validation
- 53 tests passing: 43 unit (pure functions + verifyDataIntegrity mock), 10 route tests (401/403/429/200 + shape)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create data-integrity.ts verification engine** - `b353acd` (feat)
2. **Task 2: Create admin data-integrity API endpoint** - `5a0274a` (feat)

**Plan metadata:** (final commit includes SUMMARY.md + STATE.md + ROADMAP.md)

_Note: Both tasks followed TDD: RED (failing tests written first) then GREEN (implementation to pass)._

## Files Created/Modified
- `src/lib/data-integrity.ts` - Core verification engine: TABLE_MAP, pure computation functions, verifyDataIntegrity()
- `src/lib/data-integrity.test.ts` - 43 unit tests for computation functions and verifyDataIntegrity (mocked Supabase)
- `src/app/api/admin/data-integrity/route.ts` - Admin GET endpoint with session auth + Zod validation
- `src/app/api/admin/data-integrity/route.test.ts` - 10 route tests covering auth, response shape, error handling

## Decisions Made
- `TABLE_MAP` uses `benchmark_scores` (not `model_scores`) and `elo_ratings` (not `elo_scores`) -- confirmed by grepping adapter `.from()` calls in `artificial-analysis.ts`, `chatbot-arena.ts`, etc.
- Quality score decay: `computeFreshness` returns 1.0 within interval, linear decay to 0 at 4x interval -- matches the behavior specified in the plan
- Trend baseline: `previousCount === 0` returns 1.0 (no baseline to penalize against)
- `staleSince` is computed as `lastSyncAt + intervalHours` (the timestamp when the source *became* stale), not the current time
- `sync_jobs` fetched as last 200 records globally (ordered by `created_at` desc), then grouped per source -- avoids N+1 query pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `verifyDataIntegrity()` and `DataIntegrityReport` are ready for the admin UI (Phase 23 Plan 02)
- All 4 requirements INTG-01 through INTG-04 satisfied
- TypeScript compiles clean, lint passes with --max-warnings 0

---
*Phase: 23-data-integrity-verification*
*Completed: 2026-03-12*
