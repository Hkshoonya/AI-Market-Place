---
phase: 14-swr-data-fetching
plan: 05
subsystem: ui
tags: [swr, data-fetching, supabase, react, caching, auth-gating]

# Dependency graph
requires:
  - phase: 14-swr-data-fetching
    plan: 01
    provides: SWR infrastructure, SWR_TIERS constants, SWRConfig provider
provides:
  - 13 Supabase-direct query components converted to useSWR with inline fetchers
  - Auth-gated SWR patterns with null-key conditional fetching
  - Supabase cache key convention (supabase: prefix)
  - On-demand SWR global mutate for compare page model caching
  - Mutation revalidation via mutate() across seller tables and comments
affects: [14-swr-data-fetching, swr-data-fetching]

# Tech tracking
tech-stack:
  added: []
  patterns: [supabase-inline-fetcher, auth-gated-null-key, parameterized-cache-keys, swr-global-mutate-for-on-demand-fetch]

key-files:
  created: []
  modified:
    - src/app/(admin)/admin/page.tsx
    - src/app/(admin)/admin/analytics/page.tsx
    - src/app/(admin)/admin/models/page.tsx
    - src/app/(admin)/admin/reviews/page.tsx
    - src/app/(admin)/admin/users/page.tsx
    - src/app/(auth)/orders/orders-content.tsx
    - src/app/(auth)/profile/profile-content.tsx
    - src/components/models/comments-section.tsx
    - src/components/marketplace/seller-orders-table.tsx
    - src/components/marketplace/seller-listings-table.tsx
    - src/app/(marketplace)/dashboard/seller/listings/[slug]/edit/edit-listing-content.tsx
    - src/app/(auth)/wallet/wallet-content.tsx
    - src/app/compare/compare-client.tsx

key-decisions:
  - "Inline fetcher functions with createClient() inside for fresh auth context per request"
  - "Parameterized cache keys include page/filter/search for automatic refetch on UI state change"
  - "Compare page uses useSWRConfig().mutate for imperative cache population (not useSWR hook)"
  - "Comments section includes visibleCount in cache key for Load More pagination"
  - "Wallet content wraps API route fetch in SWR (not direct Supabase) preserving existing API layer"

patterns-established:
  - "Auth-gated SWR: user ? 'supabase:entity' : null for conditional fetching"
  - "Parameterized cache keys: supabase:entity:${page}:${filter} for filter/pagination"
  - "Two-query enrichment inside SWR fetcher as single logical operation"
  - "SWR global mutate for on-demand model cache: mutateGlobal('supabase:model:${slug}', data, false)"
  - "Optimistic mutations via mutate(newData, false) for seller tables"

requirements-completed: [PERF-01]

# Metrics
duration: 11min
completed: 2026-03-09
---

# Phase 14 Plan 05: Supabase-Direct Query SWR Conversion Summary

**13 components converted from Supabase-direct useEffect/useCallback queries to useSWR with inline fetchers, auth-gated null keys, and parameterized cache keys**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-09T05:26:47Z
- **Completed:** 2026-03-09T05:38:36Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Converted 5 admin pages (overview, analytics, models, reviews, users) from Supabase-direct useEffect to useSWR with SLOW/MEDIUM tiers
- Converted 8 auth-gated components (orders, profile, comments, seller tables, edit listing, wallet, compare) with null-key conditional fetching
- Removed all module-level createClient()/createBrowserClient() calls in converted files
- Comments section tests (5/5) continue passing with SWR conversion
- All mutation actions (status toggles, comment submit/edit/delete, order approve/reject) use mutate() for revalidation
- Compare page migrated from @supabase/ssr createBrowserClient to @/lib/supabase/client createClient with SWR global mutate

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert admin Supabase-direct pages** - `2eba3a2` (feat)
2. **Task 2: Convert auth-gated Supabase components, marketplace tables, and compare page** - `f1d50b5` (feat)

## Files Created/Modified
- `src/app/(admin)/admin/page.tsx` - SLOW tier SWR for admin overview stats
- `src/app/(admin)/admin/analytics/page.tsx` - SLOW tier SWR for analytics aggregations
- `src/app/(admin)/admin/models/page.tsx` - MEDIUM tier SWR with page/status/search cache key
- `src/app/(admin)/admin/reviews/page.tsx` - MEDIUM tier SWR with page/rating/search cache key
- `src/app/(admin)/admin/users/page.tsx` - MEDIUM tier SWR with page/role/search cache key
- `src/app/(auth)/orders/orders-content.tsx` - MEDIUM tier auth-gated with two-query enrichment
- `src/app/(auth)/profile/profile-content.tsx` - SLOW tier auth-gated bookmarks + watchlist
- `src/components/models/comments-section.tsx` - MEDIUM tier with mutate() for all mutations
- `src/components/marketplace/seller-orders-table.tsx` - MEDIUM tier auth-gated with optimistic mutations
- `src/components/marketplace/seller-listings-table.tsx` - MEDIUM tier auth-gated with delete mutation
- `src/app/(marketplace)/dashboard/seller/listings/[slug]/edit/edit-listing-content.tsx` - SLOW tier auth-gated single listing
- `src/app/(auth)/wallet/wallet-content.tsx` - MEDIUM tier auth-gated with filter/page cache keys
- `src/app/compare/compare-client.tsx` - SWR global mutate for on-demand model caching

## Decisions Made
- Used inline fetcher functions with createClient() inside (not at module level) to ensure fresh Supabase auth context per request
- Included page/filter/search params in cache keys so SWR automatically refetches when UI state changes -- eliminates manual fetchData() calls
- Compare page uses useSWRConfig().mutate for imperative cache writes rather than useSWR hook, since model fetching is on-demand (user-triggered) not lifecycle-based
- Comments section includes visibleCount in cache key so "Load More" triggers a new SWR fetch with higher limit
- Wallet content preserves the existing API route fetch pattern (not direct Supabase) but wraps it in SWR for caching and deduplication

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error in compare-client.tsx**
- **Found during:** Task 2 (compare-client conversion)
- **Issue:** Switching from createBrowserClient to typed createClient caused TypeScript error on `data as ModelWithDetails` due to stricter FK relationship types
- **Fix:** Used `data as unknown as ModelWithDetails` double assertion (runtime data shape is correct, type system lacks FK metadata)
- **Files modified:** src/app/compare/compare-client.tsx
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** f1d50b5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial type assertion fix. No scope creep.

## Issues Encountered
- Pre-existing test failure in search-dialog.test.tsx (3 tests) caused by uncommitted changes from Plans 02/03/04 in working tree. Not related to Plan 05 changes. Comments-section test (5/5) passes cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 13 Supabase-direct query components now use SWR
- Combined with Plans 02-04 (API route conversions, custom hooks, widgets), the entire client-side data fetching layer uses SWR
- Cache key convention (supabase: prefix) established for Supabase-direct queries distinct from API route URL keys
- Ready for Phase 15 (E2E testing) or any subsequent phase

## Self-Check: PASSED

- All 13 modified files verified present on disk
- Both task commits (2eba3a2, f1d50b5) verified in git log
- TypeScript compiles clean
- Comments-section tests (5/5) pass

---
*Phase: 14-swr-data-fetching*
*Completed: 2026-03-09*
