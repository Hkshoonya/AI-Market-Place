---
phase: 21-admin-visibility
plan: 02
subsystem: ui
tags: [admin, pipeline-health, swr, react, typescript, tailwind, lucide]

# Dependency graph
requires:
  - phase: 21-admin-visibility plan 01
    provides: computeStatus, mapSyncJobStatus, HEALTH_PRIORITY, formatRelativeTime, /api/admin/pipeline/health, /api/admin/sync?source=&limit=

provides:
  - Enhanced admin data-sources page with pipeline health summary cards
  - Staleness row tinting (amber=degraded, red=down)
  - Stale-first sort (down > degraded > healthy, then tier)
  - Health badge column alongside sync status badge per row
  - Clickable health cards that filter the table
  - Last Sync column with relative time + expected interval
  - Expandable rows with inline SyncHistoryInline component
  - On-demand SWR fetch for per-adapter sync history (last 10 jobs)
  - Error tooltip showing full message on hover

affects: [21-03, admin dashboard, pipeline monitoring UX]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Health-aware table: HEALTH_CONFIG parallel to STATUS_CONFIG for dual badge system
    - Stale-first sort with HEALTH_PRIORITY from shared compute lib
    - SyncHistoryInline local component with conditional SWR (slug ? url : null)
    - Row tinting via cn() with per-status background classes

key-files:
  created: []
  modified:
    - src/app/(admin)/admin/data-sources/page.tsx

key-decisions:
  - "Tasks 1 and 2 committed in same atomic commit — both touch only page.tsx, splitting would leave file in intermediate state"
  - "Array return in sortedSources.map() used for conditional expanded rows — React renders arrays as fragment children; tsc confirms no page errors"
  - "Pre-existing TypeScript errors in route.test.ts files (from Plan 01) are out of scope per deviation rules and not fixed"

patterns-established:
  - "HEALTH_CONFIG mirrors STATUS_CONFIG for consistent badge rendering pattern across health and sync status"
  - "Conditional SWR: useSWR(condition ? url : null) for on-demand data fetch when row expanded"

requirements-completed: [ADMN-01, ADMN-02, ADMN-03]

# Metrics
duration: 15min
completed: 2026-03-12
---

# Phase 21 Plan 02: Admin Data Sources UI Enhancement — Summary

**Admin data-sources page with pipeline health pill, Healthy/Degraded/Down filter cards, staleness row tinting, stale-first sort, dual status badges, relative-time Last Sync, and expandable inline sync history rows via on-demand SWR**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-12T04:02:47Z
- **Completed:** 2026-03-12T04:17:00Z (Tasks 1+2; Task 3 pending human verify)
- **Tasks:** 2/3 complete (Task 3 is checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments

- Replaced static summary cards with health-aware Healthy/Degraded/Down/Records Synced cards fetched from `/api/admin/pipeline/health`
- Added pipeline status pill (green/amber/red) above cards showing overall pipeline health and last run time
- Health cards are clickable filters: clicking "Degraded" shows only degraded adapters; clicking again clears the filter; works simultaneously with tier filter
- Added Health badge column per row using `HEALTH_CONFIG` (Shield/ShieldAlert/ShieldX icons) alongside existing sync Status badge
- Applied staleness row tinting: `bg-red-500/5` for down, `bg-amber-400/5` for degraded
- Sorted table stale-first using `HEALTH_PRIORITY` from shared lib: down=0, degraded=1, healthy=2, then by tier
- Updated Last Sync to `formatRelativeTime` + expected interval label (e.g., "14h ago (every 6h)")
- Added expand chevron (ChevronRight/ChevronDown) as last column; click toggles `expandedRows` Set
- Created `SyncHistoryInline` local component: conditional SWR fetch on expand, loading skeleton, 10-job grid with timestamp/status/records/duration
- Failed sync jobs show truncated error (80 chars) with full message in Tooltip on hover

## Task Commits

1. **Tasks 1+2: Pipeline health summary cards, staleness viz, expandable rows + SyncHistoryInline** - `05c1dd0` (feat)

*Note: Tasks 1 and 2 both modified page.tsx exclusively — committed as single atomic unit.*

**Plan metadata:** (pending final docs commit)

## Files Created/Modified

- `src/app/(admin)/admin/data-sources/page.tsx` — Complete rewrite: 473 lines -> 615 lines. Added health SWR, pipeline pill, health cards, health filter, stale-first sort, Health badge column, row tinting, Last Sync interval, expand chevron, SyncHistoryInline component

## Decisions Made

- Tasks 1 and 2 committed together since both exclusively modify `page.tsx` — splitting would leave the file in an intermediate broken state (Health badge column without SyncHistoryInline, or vice versa).
- Array return pattern in `sortedSources.map()` used to conditionally render the expansion `<tr>` after each source row. React supports array children in `<tbody>`. TypeScript confirms no errors in page.tsx.
- Pre-existing TypeScript errors in `route.test.ts` files (from Plan 01) are out of scope per scope boundary rule — they existed before this plan and are not caused by page.tsx changes.

## Deviations from Plan

None — plan executed exactly as written. Both tasks implemented in one file pass, matching all spec requirements.

## Issues Encountered

- Pre-existing TypeScript errors in `src/app/api/admin/pipeline/health/route.test.ts` and `src/app/api/admin/sync/route.test.ts` (from Plan 01) appeared in `tsc --noEmit` output. These are out-of-scope per the scope boundary rule — they pre-date this plan and are unrelated to page.tsx changes. Logged for deferred fix.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All visual enhancements shipped: health summary, staleness tint, stale-first sort, dual badges, expandable rows
- Task 3 (human checkpoint) pending: admin must verify all 13 visual/interactive behaviors at /admin/data-sources
- Plan 03 (drawer detail view) can build directly on top of this page's expandedRows pattern and health data

---
*Phase: 21-admin-visibility*
*Completed: 2026-03-12*
