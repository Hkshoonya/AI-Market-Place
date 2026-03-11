---
phase: 11-zod-runtime-validation
plan: 05
subsystem: ui, database
tags: [zod, supabase, orders, two-query-enrichment, nullable]

# Dependency graph
requires:
  - phase: 11-zod-runtime-validation
    provides: parseQueryResult/parseQueryResultSingle, ProfilePickSchema, OrderWithListingSchema
provides:
  - Orders page using two-query enrichment instead of broken FK alias joins
  - Order detail page using two-query enrichment with buyer/seller profiles
  - buyer_id nullable in MarketplaceOrderSchema for guest order support
  - Removed broken OrderWithJoinsSchema and OrderWithPartiesSchema
affects: [marketplace, orders]

# Tech tracking
tech-stack:
  added: []
  patterns: [two-query enrichment for orders, nullable buyer_id for guest orders]

key-files:
  created: []
  modified:
    - src/lib/schemas/marketplace.ts
    - src/app/(auth)/orders/orders-content.tsx
    - src/app/(auth)/orders/[id]/order-detail-content.tsx
    - src/components/marketplace/seller-orders-table.tsx

key-decisions:
  - "Two-query enrichment in client components instead of using API route (API GET for buyer role lacks seller profile enrichment)"
  - "OrderWithListingSchema as single replacement for OrderWithJoinsSchema and OrderWithPartiesSchema"

patterns-established:
  - "Client-side two-query enrichment: fetch orders with listing join, then fetch profiles separately and merge via Map"

requirements-completed: [TYPE-01]

# Metrics
duration: 9min
completed: 2026-03-08
---

# Phase 11 Plan 05: Orders FK Alias Fix Summary

**Two-query enrichment replaces broken FK alias joins in orders pages; buyer_id nullable for guest orders**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-08T22:22:40Z
- **Completed:** 2026-03-08T22:31:32Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- Fixed buyer_id to be `z.string().nullable()` in MarketplaceOrderSchema matching DB column that allows null for guest orders
- Replaced broken FK alias joins (`seller:seller_id(...)`, `buyer:buyer_id(...)`) in orders-content.tsx with two-query enrichment pattern using ProfilePick
- Replaced broken FK alias joins in order-detail-content.tsx with two-query enrichment fetching buyer and seller profiles separately
- Removed unused OrderWithJoinsSchema, OrderWithPartiesSchema, and OrderPartySchema from marketplace.ts
- Added OrderWithListingSchema as the single schema for order queries with listing joins only
- Fixed seller-orders-table.tsx type narrowing for nullable buyer_id using type predicate filter

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix MarketplaceOrderSchema buyer_id nullable and refactor orders client components** - `9fcc6b8` (fix)

**Plan metadata:** (pending)

## Files Created/Modified
- `src/lib/schemas/marketplace.ts` - buyer_id nullable, added OrderWithListingSchema, removed OrderWithJoinsSchema/OrderWithPartiesSchema/OrderPartySchema
- `src/app/(auth)/orders/orders-content.tsx` - Two-query enrichment with seller profiles via ProfilePick, removed FK alias join query
- `src/app/(auth)/orders/[id]/order-detail-content.tsx` - Two-query enrichment fetching buyer and seller profiles separately via Map
- `src/components/marketplace/seller-orders-table.tsx` - Type predicate filter for nullable buyer_id

## Decisions Made
- Used two-query enrichment in client components rather than the API route at `/api/marketplace/orders` because the API's GET handler for `role=buyer` does not enrich with seller profiles -- it only enriches seller view with buyer profiles
- Created a single `OrderWithListingSchema` to replace both `OrderWithJoinsSchema` and `OrderWithPartiesSchema`, since the profile data is now fetched separately and merged in JavaScript
- Used type predicate `(id): id is string => id != null` in seller-orders-table.tsx to properly narrow the `(string | null)[]` array from nullable buyer_id

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed seller-orders-table.tsx type narrowing for nullable buyer_id**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** Making buyer_id nullable caused `TS2345` in seller-orders-table.tsx line 65 -- `.filter(Boolean)` does not narrow `(string | null)[]` to `string[]` in TypeScript
- **Fix:** Changed `.filter(Boolean)` to `.filter((id): id is string => id != null)` for proper type narrowing
- **Files modified:** src/components/marketplace/seller-orders-table.tsx
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 9fcc6b8 (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix necessary for TypeScript correctness after making buyer_id nullable. No scope creep.

## Issues Encountered
- Task changes were committed by a concurrent plan 11-04 execution into commit `9fcc6b8` (mislabeled). All 4 files from plan 11-05 are included in that commit. No duplicate commit created.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All order client components now use safe two-query enrichment pattern
- No FK alias joins remain in orders pages
- Ready for any future marketplace/orders work

## Self-Check: PASSED

All 4 modified files exist. Commit 9fcc6b8 verified in git history. SUMMARY.md created.

---
*Phase: 11-zod-runtime-validation*
*Completed: 2026-03-08*
