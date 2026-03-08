---
phase: 11-zod-runtime-validation
plan: 03
subsystem: ui
tags: [zod, validation, recharts, supabase, client-components, type-safety]

# Dependency graph
requires:
  - phase: 11-zod-runtime-validation
    provides: parseQueryResult/parseQueryResultSingle utilities and domain Zod schemas (Plan 01)
provides:
  - Zero as-unknown-as casts in client component files (7 files migrated)
  - Recharts casts replaced with proper typing (2 files)
  - Query-specific schemas for client component enrichment patterns
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [client-side parseQueryResult with two-query enrichment, Recharts Payload type import for tooltip typing]

key-files:
  created: []
  modified:
    - src/components/models/comments-section.tsx
    - src/components/marketplace/listing-reviews.tsx
    - src/components/marketplace/seller-orders-table.tsx
    - src/components/marketplace/seller-listings-table.tsx
    - src/app/(auth)/orders/orders-content.tsx
    - src/app/(auth)/orders/[id]/order-detail-content.tsx
    - src/app/(auth)/profile/profile-content.tsx
    - src/components/charts/quality-price-frontier.tsx
    - src/components/charts/rank-timeline.tsx
    - src/lib/schemas/community.ts
    - src/lib/schemas/marketplace.ts

key-decisions:
  - "Client component two-query enrichment pattern: validate raw Supabase data with base schema, then enrich with profiles in JS using ProfilePickSchema"
  - "Recharts Scatter onClick uses single as assertion to {payload?: T} instead of double-cast, since ScatterPointItem.payload is typed as any"
  - "Recharts tooltip Payload<number, string> imported from recharts/types for proper tooltip typing"
  - "Schema fields like status/listing_type kept as z.string() to match Supabase response; UI components use single as assertion to enum types where needed"

patterns-established:
  - "Client enrichment: parseQueryResult for raw data, then merge with profile data fetched separately"
  - "Recharts typing: import Payload from recharts/types/component/DefaultTooltipContent for tooltip props"

requirements-completed: [TYPE-01]

# Metrics
duration: 11min
completed: 2026-03-08
---

# Phase 11 Plan 03: Client Component & Recharts Cast Migration Summary

**All 7 client component Supabase casts replaced with parseQueryResult and both Recharts double-casts fixed with proper typing imports**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-08T06:59:47Z
- **Completed:** 2026-03-08T07:10:55Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Migrated 10 as-unknown-as casts across 7 client component files to use parseQueryResult/parseQueryResultSingle
- Added 7 query-specific schemas (CommentWithProfileSchema, BookmarkWithModelSchema, SellerOrderRowSchema, OrderWithJoinsSchema, OrderWithPartiesSchema, ProfilePickSchema, OrderProfilePickSchema)
- Fixed Recharts quality-price-frontier onClick double-cast with single assertion to ScatterPointItem payload shape
- Fixed Recharts rank-timeline tooltip cast by importing Payload<number, string> from recharts types
- All 193 tests pass, TypeScript compiles clean (only pre-existing errors in Plan 02 scope files)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate client component Supabase casts (7 files, ~10 casts)** - `71ee92f` (feat)
2. **Task 2: Fix Recharts casts with proper typing and verify zero production casts** - `5afb936` (feat)

## Files Created/Modified
- `src/lib/schemas/community.ts` - Added CommentWithProfileSchema, BookmarkWithModelSchema for client queries
- `src/lib/schemas/marketplace.ts` - Added SellerOrderRowSchema, ProfilePickSchema, OrderProfilePickSchema, OrderWithJoinsSchema, OrderWithPartiesSchema
- `src/components/models/comments-section.tsx` - Replaced 2 casts with parseQueryResult(response, CommentSchema)
- `src/components/marketplace/listing-reviews.tsx` - Replaced 2 casts with parseQueryResult for reviews and profiles
- `src/components/marketplace/seller-orders-table.tsx` - Replaced 2 casts with parseQueryResult for orders and profiles
- `src/components/marketplace/seller-listings-table.tsx` - Replaced 1 cast with parseQueryResult for listings
- `src/app/(auth)/orders/orders-content.tsx` - Replaced 1 cast with parseQueryResult for buyer orders
- `src/app/(auth)/orders/[id]/order-detail-content.tsx` - Replaced 1 cast with parseQueryResultSingle for order detail
- `src/app/(auth)/profile/profile-content.tsx` - Replaced 1 cast with parseQueryResult for bookmarks
- `src/components/charts/quality-price-frontier.tsx` - Fixed Scatter onClick with single assertion
- `src/components/charts/rank-timeline.tsx` - Fixed tooltip payload with Recharts Payload type import

## Decisions Made
- Client component two-query enrichment pattern: validate raw Supabase data with base schema (e.g., CommentSchema, MarketplaceReviewSchema), then enrich with profiles in JavaScript. This avoids needing recursive schemas for nested data added post-query.
- Recharts Scatter onClick handler: used single `as` assertion to `{ payload?: T }` rather than importing ScatterPointItem, since the `payload` property on ScatterPointItem is typed as `any` and a single assertion is sufficient.
- Recharts tooltip: imported `Payload<number, string>` from `recharts/types/component/DefaultTooltipContent` to properly type the tooltip content props, eliminating the double-cast entirely.
- Schema enum fields (status, listing_type, pricing_type) kept as `z.string()` to match raw Supabase response shape. UI components use single `as ListingStatus` or `as OrderStatus` assertions where they index into enum-keyed maps.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ListingType/ListingStatus index access on string fields**
- **Found during:** Task 1 (seller-listings-table.tsx migration)
- **Issue:** Schema returns `listing_type` and `status` as `string`, but `LISTING_TYPE_MAP` and `STATUS_COLORS` are keyed by narrow enum types
- **Fix:** Added single `as ListingStatus` and `as ListingType` assertions at point of use
- **Files modified:** src/components/marketplace/seller-listings-table.tsx, src/components/marketplace/seller-orders-table.tsx
- **Verification:** npx tsc --noEmit passes clean for these files
- **Committed in:** 71ee92f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Minor type narrowing needed at enum index access points. No scope creep.

## Issues Encountered

- Plan 02 (server component cast migration) has not been executed yet, so server-side `as unknown as` casts remain in production code. The verification criterion "zero production casts" applies only to Plan 03's scope (7 client components + 2 Recharts charts). All Plan 03 scope files have zero `as unknown as` casts.
- Pre-existing TypeScript error in `src/app/(catalog)/models/[slug]/page.tsx` (line 136) and uncommitted Plan 02 work in `src/app/(marketplace)/marketplace/[slug]/page.tsx` cause tsc errors unrelated to Plan 03 changes. These are out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 03 client component migration is complete
- Plan 02 (server component + API route migration) still needs execution to achieve full zero-cast production codebase
- All schemas and parse utilities are battle-tested across both server (Plan 01) and client (Plan 03) usage patterns
- 193 tests pass with zero regressions

## Self-Check: PASSED

All 11 modified files verified present. Both task commits (71ee92f, 5afb936) verified in git history.

---
*Phase: 11-zod-runtime-validation*
*Completed: 2026-03-08*
