---
phase: 21-admin-visibility
plan: 03
subsystem: ui
tags: [admin, drawer, sheet, swr, react, typescript, tailwind, lucide, sync]

# Dependency graph
requires:
  - phase: 21-admin-visibility plan 02
    provides: healthBySlug, mutate/mutateHealth, allSources, HEALTH_CONFIG, STATUS_CONFIG, mapSyncJobStatus, formatRelativeTime, SyncHistoryInline pattern, expandedRows, TIER_SCHEDULES

provides:
  - Slide-out Sheet drawer for per-adapter detail view (adapter name click)
  - Config summary in drawer: tier, sync interval, output types, consecutive failures, health badge, last sync
  - Full (untruncated) error message display for most recent failure
  - Paginated sync history in drawer: last 25 entries with Load More (+25 per click)
  - Sync Now button in drawer header: POST /api/admin/sync/{slug} with spinner
  - Auto-refresh of drawer history, main table, and health cards after Sync Now

affects: [admin dashboard, pipeline monitoring UX, ADMN requirements complete]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional SWR for drawer: useSWR(drawerSlug ? url : null) keyed by slug + limit for pagination"
    - "Load More pagination: setDrawerHistoryLimit(prev => prev + 25) changes SWR key, triggers refetch"
    - "Derive selected source from slug: allSources.find(s => s.slug === drawerSlug) avoids stale object references post-mutate()"
    - "Triple mutate after sync: mutateDrawerHistory() + mutate() + mutateHealth() for full consistency"

key-files:
  created: []
  modified:
    - src/app/(admin)/admin/data-sources/page.tsx

key-decisions:
  - "21-03: adapter name (button) opens drawer; expand chevron (row) opens inline history — two independent drill-down paths"
  - "21-03: drawer history limit managed as local state; SWR key includes limit so Load More naturally re-fetches with higher limit"
  - "21-03: human verify checkpoint approved — all 11 drawer/Sync Now verification steps confirmed at /admin/data-sources"

patterns-established:
  - "Drawer-from-table: slug state + Sheet open={!!slug} + useSWR(slug ? url : null) pattern for on-demand drawer detail"
  - "Post-action triple-mutate: always refresh drawer data, main table, and health summary after write operations"

requirements-completed: [ADMN-04, ADMN-05]

# Metrics
duration: ~20min
completed: 2026-03-12
---

# Phase 21 Plan 03: Adapter Detail Drawer with Sync Now — Summary

**Slide-out Sheet drawer on adapter name click showing config summary, full error, paginated sync history (25+), and a Sync Now button that POSTs and triple-mutates drawer + table + health SWR caches**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-12T04:12:00Z
- **Completed:** 2026-03-12T04:32:00Z (Task 1 committed; Task 2 human checkpoint approved)
- **Tasks:** 2/2 complete (Task 2 checkpoint:human-verify approved)
- **Files modified:** 1

## Accomplishments

- Made adapter names clickable buttons (`hover:text-neon hover:underline`) that open a right-side Sheet drawer
- Drawer config summary shows: tier label, sync interval, output type badges, consecutive failures (red if > 0), health status badge, last sync time
- Full (untruncated) last error message rendered in `bg-loss/5 border border-loss/30` container with `whitespace-pre-wrap break-all` — visible only when last sync status is "failed"
- Sync history SWR keyed on `drawerSlug + limit`: last 25 entries with timestamp, status badge, records, duration, full error text for failed jobs
- Load More button appears when returned jobs equal current limit; increments limit by 25, SWR key changes and re-fetches
- Sync Now button in drawer header: `Play` icon normally, `Loader2 animate-spin` while syncing; disabled when already syncing or adapter is disabled
- After sync completes: `toast.success`, then `Promise.all([mutateDrawerHistory(), mutate(), mutateHealth()])` refreshes all three SWR caches atomically
- `useEffect` resets `drawerHistoryLimit` to 25 when `drawerSlug` changes (prevents stale pagination on drawer re-open)

## Task Commits

1. **Task 1: Adapter detail drawer with config summary and sync history** — `5287019` (feat)

*Note: Task 2 was a checkpoint:human-verify task — resolved by user approval, no additional commit.*

**Plan metadata commit:** *(pending — will be recorded in final docs commit)*

## Files Created/Modified

- `src/app/(admin)/admin/data-sources/page.tsx` — Extended from 615 lines with Sheet drawer, drawerSlug/drawerSyncing state, drawerHistoryLimit state, conditional SWR for drawer history, clickable adapter name buttons, triggerSyncFromDrawer handler, full drawer UI with config grid, error block, sync history list, Load More button

## Decisions Made

- Adapter name click and expand chevron click serve different purposes and operate independently: name → full drawer detail; chevron → inline history row. Both can be open simultaneously.
- Drawer history limit stored as local state (not URL param) since pagination is ephemeral and resets on drawer close, which is the correct UX.
- Selected source derived from `allSources.find(s => s.slug === drawerSlug)` rather than storing the object directly — ensures fresh data after any mutate() call without stale closures.
- Human verify checkpoint (Task 2) approved: all 11 verification steps confirmed at /admin/data-sources. All ADMN requirements (ADMN-01 through ADMN-05) are now satisfied.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All ADMN requirements (ADMN-01 through ADMN-05) are now complete across Plans 01, 02, and 03
- Phase 21 (Admin Visibility) is fully complete: backend health lib + endpoints (01), enhanced table with health cards + expandable rows (02), adapter detail drawer with Sync Now (03)
- The admin /data-sources page now provides full operational visibility: pipeline health at-a-glance, per-adapter drill-down, manual sync trigger, and paginated sync history

---
*Phase: 21-admin-visibility*
*Completed: 2026-03-12*
