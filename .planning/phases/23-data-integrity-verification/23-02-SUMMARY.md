---
phase: 23-data-integrity-verification
plan: 02
subsystem: ui
tags: [data-integrity, quality-score, admin, swr, react, tailwind]

# Dependency graph
requires:
  - phase: 23-data-integrity-verification
    plan: 01
    provides: verifyDataIntegrity(), DataIntegrityReport type, GET /api/admin/data-integrity endpoint
  - phase: 21-admin-visibility
    provides: Admin data-sources page structure, SWR_TIERS, Card/Badge/Button components, formatRelativeTime

provides:
  - Data Integrity panel integrated into /admin/data-sources page
  - Per-source quality score badges (0-100) with color coding on adapter rows
  - Summary cards: average quality, stale source count, empty table count
  - Table coverage pills showing populated/empty status per tracked table
  - Stale sources amber alert panel with last-sync and overdue duration
  - Run Verification button triggering on-demand mutate() refetch

affects:
  - any future admin UI phases building on the data-sources page
  - INTG-01, INTG-04 requirements fully satisfied

# Tech tracking
tech-stack:
  added: []
  patterns:
    - qualityColor() helper returns {text, bg} Tailwind classes based on 0-100 score thresholds
    - DataIntegrityReport/SourceQualityScore/TableCoverage types defined locally in client component (not imported from lib)
    - SWR mutate() used as on-demand refresh trigger (GET endpoint runs verification as side effect)

key-files:
  created: []
  modified:
    - src/app/(admin)/admin/data-sources/page.tsx

key-decisions:
  - "Types (DataIntegrityReport, SourceQualityScore, TableCoverage) defined locally in page.tsx rather than imported from lib -- client components fetch via API; types are for local shape only"
  - "23-02 human verify checkpoint approved -- all 10 UI verification steps confirmed at /admin/data-sources"

patterns-established:
  - "qualityColor(score) helper: green >= 70 (text-gain/bg-gain/10), amber 40-69 (text-amber-400/bg-amber-400/10), red < 40 (text-loss/bg-loss/10)"

requirements-completed: [INTG-01, INTG-04]

# Metrics
duration: 10min
completed: 2026-03-12
---

# Phase 23 Plan 02: Data Integrity Panel (Admin UI) Summary

**Data integrity panel integrated into /admin/data-sources with quality score summary cards, per-source badges, table coverage pills, stale sources alert, and on-demand Run Verification button**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-12T16:18:00Z
- **Completed:** 2026-03-12T16:28:00Z
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 1

## Accomplishments
- Quality score summary cards (average quality 0-100, stale source count, empty table count) inserted below existing health summary cards and above adapter table
- Per-source quality score badges on every adapter row using `integrityData?.qualityScores.find(q => q.slug === source.slug)` lookup
- Table coverage horizontal pills: green for populated tables with row count, red for empty tables with responsible adapter names as tooltip
- Stale sources amber alert panel (conditional) listing each stale source with name, last-sync time, overdue duration, and expected interval
- Run Verification button with Loader2 spinner while `integrityLoading` is true; triggers `mutateIntegrity()` and shows success toast

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Data Integrity panel to admin data-sources page** - `c137dfe` (feat)
2. **Task 2: Human verification of data integrity panel** - (human-verified, no code commit)

**Plan metadata:** (final commit includes SUMMARY.md + STATE.md + ROADMAP.md)

## Files Created/Modified
- `src/app/(admin)/admin/data-sources/page.tsx` - Added Data Integrity panel: SWR hook for /api/admin/data-integrity, qualityColor() helper, type definitions, summary cards row, table coverage pills, stale sources alert, Run Verification button, per-source quality badges in adapter rows

## Decisions Made
- Local type definitions for `DataIntegrityReport`, `SourceQualityScore`, `TableCoverage` in page.tsx rather than importing from `src/lib/data-integrity.ts` -- client components only access these types at the API boundary; importing from lib would drag server-only code into client bundle
- Human checkpoint approved after 10 visual/interactive verification steps at /admin/data-sources

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 23 (Data Integrity Verification) is complete: backend engine (Plan 01) + admin UI (Plan 02)
- All 4 INTG requirements are satisfied (INTG-01/02/03 in Plan 01, INTG-04 confirmed in Plan 02)
- Admin dashboard at /admin/data-sources now shows end-to-end data quality visibility

---
*Phase: 23-data-integrity-verification*
*Completed: 2026-03-12*

## Self-Check: PASSED

- FOUND: .planning/phases/23-data-integrity-verification/23-02-SUMMARY.md
- FOUND commit: c137dfe (Task 1 — feat(23-02): add Data Integrity panel to admin data-sources page)
