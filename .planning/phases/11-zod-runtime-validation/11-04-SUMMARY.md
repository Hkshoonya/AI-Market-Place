---
phase: 11-zod-runtime-validation
plan: 04
subsystem: database
tags: [zod, coerce, postgrest, supabase, runtime-validation, nullable]

# Dependency graph
requires:
  - phase: 11-zod-runtime-validation-01
    provides: "parseQueryResult/parseQueryResultSingle + base schema files"
provides:
  - "z.coerce.number() in all 5 schema files for PostgREST string-to-number coercion"
  - "is_open_weights z.boolean().nullable() across models, analytics, admin inline schemas"
  - "Admin analytics try-catch error handling"
  - "New coercion + nullable tests in models.test.ts"
affects: [model-detail, leaderboards, admin-analytics, comments]

# Tech tracking
tech-stack:
  added: []
  patterns: ["z.coerce.number() for all Postgres numeric/bigint columns returned as strings by PostgREST"]

key-files:
  created: []
  modified:
    - "src/lib/schemas/models.ts"
    - "src/lib/schemas/rankings.ts"
    - "src/lib/schemas/marketplace.ts"
    - "src/lib/schemas/community.ts"
    - "src/lib/schemas/analytics.ts"
    - "src/lib/schemas/models.test.ts"
    - "src/app/(admin)/admin/analytics/page.tsx"

key-decisions:
  - "z.coerce.number() applied globally to all z.number() calls since PostgREST may return any numeric column as string"
  - "is_open_weights nullable in ModelBaseSchema since DB has DEFAULT false but no NOT NULL constraint"
  - "Explicit === true filter for is_open_weights in admin analytics (clarity over falsy null/false conflation)"

patterns-established:
  - "z.coerce.number() for all Postgres numeric/bigint columns in Zod schemas"
  - "z.boolean().nullable() for boolean columns without NOT NULL constraints"

requirements-completed: [TYPE-01, TYPE-02, TYPE-03]

# Metrics
duration: 6min
completed: 2026-03-08
---

# Phase 11 Plan 04: Gap Closure - z.coerce.number() and nullable is_open_weights Summary

**z.coerce.number() in all 5 schema files fixes PostgREST string-to-number mismatch; nullable is_open_weights + admin try-catch fixes analytics crashes**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-08T22:22:42Z
- **Completed:** 2026-03-08T22:29:32Z
- **Tasks:** 2 of 2 (Task 2 checkpoint:human-action completed by user)
- **Files modified:** 7

## Accomplishments
- Systematic z.number() -> z.coerce.number() replacement across all 5 schema files (models, rankings, marketplace, community, analytics)
- is_open_weights changed to z.boolean().nullable() in ModelBaseSchema, analytics.ts, and admin analytics inline schema
- Admin analytics page gets try-catch error handling and explicit === true filter for is_open_weights
- Two new tests verify PostgREST string coercion and null is_open_weights acceptance
- All 25 schema tests pass, TypeScript compiles clean (zero errors)

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace z.number() with z.coerce.number() + fix is_open_weights nullable** - `3b2d350` (fix)
2. **Task 2: Apply production DB migration for leaderboard multi-lens scoring columns** - (human-action, no commit)

**Plan metadata:** `d0649f3` (docs: complete plan)

## Files Created/Modified
- `src/lib/schemas/models.ts` - z.coerce.number() for all numeric fields, is_open_weights nullable
- `src/lib/schemas/rankings.ts` - z.coerce.number() for all numeric fields
- `src/lib/schemas/marketplace.ts` - z.coerce.number() for all numeric fields
- `src/lib/schemas/community.ts` - z.coerce.number() for all numeric fields
- `src/lib/schemas/analytics.ts` - z.coerce.number() for numeric fields, is_open_weights nullable
- `src/lib/schemas/models.test.ts` - Two new tests for coercion and nullable boolean
- `src/app/(admin)/admin/analytics/page.tsx` - Inline schema fixes, try-catch, explicit filter

## Decisions Made
- Applied z.coerce.number() globally to all z.number() calls since PostgREST may return any numeric column as string -- safe because z.coerce.number() accepts both actual numbers AND numeric strings
- is_open_weights nullable in ModelBaseSchema since DB has DEFAULT false but no NOT NULL constraint
- Explicit === true filter for is_open_weights in admin analytics for clarity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Prior plan changes (marketplace.ts buyer_id nullable, orders content refactors) were already staged in git, causing the first commit to include unrelated files. Resolved by creating a second commit with the correct 6 files for this task.

## User Setup Required

**Task 2 (checkpoint:human-action) -- COMPLETED by user on 2026-03-08:**
1. User applied `supabase/migrations/014_multi_lens_scoring.sql` to production Supabase
2. User ran compute-scores pipeline locally to populate new columns
3. Leaderboard "All" tab should now show ranked models with multi-lens scores

## Next Phase Readiness
- Schema coercion fixes unblock model detail pages, comments, and admin analytics
- Leaderboard "All" tab unblocked after user applied DB migration (Task 2 complete)
- Plan 11-05 has already been executed after this plan

## Self-Check: PASSED
- All 7 modified files exist on disk
- Commit 3b2d350 verified in git log
- Commit d0649f3 (docs) verified in git log
- Task 2 confirmed complete by user

---
*Phase: 11-zod-runtime-validation*
*Completed: 2026-03-08*
