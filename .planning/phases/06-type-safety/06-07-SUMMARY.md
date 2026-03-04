---
phase: 06-type-safety
plan: 07
subsystem: type-safety
tags: [typescript, api-routes, admin, eslint]

# Dependency graph
requires:
  - phase: 06-type-safety
    provides: TypedSupabaseClient from database.ts; SellerVerificationRequest from database.ts
provides:
  - Zero unjustified any in purchase/route.ts, withdraw/route.ts, chain-deposits/route.ts, admin/listings/page.tsx, admin/verifications/page.tsx
  - No orphaned eslint-disable comments in auctions-browse-content.tsx or terminal-bench.ts
affects: [API routes, admin pages, marketplace auctions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin page state typing: define local interfaces matching API response shapes for useState generics"
    - "createAdminClient() returns SupabaseClient<Database> — no as any cast needed"

key-files:
  created: []
  modified:
    - src/app/api/marketplace/purchase/route.ts
    - src/app/api/seller/withdraw/route.ts
    - src/app/api/webhooks/chain-deposits/route.ts
    - src/app/(admin)/admin/listings/page.tsx
    - src/app/(admin)/admin/verifications/page.tsx
    - src/app/(marketplace)/marketplace/auctions/auctions-browse-content.tsx
    - src/lib/data-sources/adapters/terminal-bench.ts

key-decisions:
  - "purchase/route.ts: removed unnecessary as any on admin client — createAdminClient() already typed"
  - "withdraw/route.ts: same pattern — createAdminClient() as any was redundant"
  - "chain-deposits/route.ts: imported TypedSupabaseClient for function parameter types instead of any"
  - "admin/listings/page.tsx: defined AdminListing interface matching API response shape for useState<AdminListing[]>"
  - "admin/verifications/page.tsx: extended SellerVerificationRequest with profiles join for typed state"

patterns-established:
  - "API route Supabase clients: use createAdminClient() directly, never cast to any"
  - "Admin page state: define response-shape interfaces locally, import base types from database.ts"

requirements-completed: [TYPE-05]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 06 Plan 07: Gap Closure — API Routes & Admin Pages Summary

**8 unjustified any annotations removed from 5 files, 2 orphaned eslint-disable comments removed from 2 files, completing TYPE-05 gap closure**

## Performance

- **Duration:** 5 min
- **Completed:** 2026-03-04
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- purchase/route.ts: removed `as any` cast on admin client — `createAdminClient()` already returns `SupabaseClient<Database>`
- withdraw/route.ts: removed `as any` cast on `createAdminClient()` call
- chain-deposits/route.ts: 4 `any` params replaced with `TypedSupabaseClient` for `processSolanaDeposits`, `processEvmDeposits`, `isTxHashProcessed`, plus `createAdminClient()` cast removed
- admin/listings/page.tsx: `useState<any[]>` replaced with `useState<AdminListing[]>` using local interface; file-level eslint-disable removed
- admin/verifications/page.tsx: `useState<any[]>` replaced with `useState<VerificationRequestWithProfile[]>`; file-level eslint-disable removed
- auctions-browse-content.tsx: orphaned `eslint-disable @typescript-eslint/no-explicit-any` comment removed
- terminal-bench.ts: orphaned `eslint-disable-next-line @typescript-eslint/no-explicit-any` comment removed

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove as-any casts from API routes** - `ce87a5d` (feat)
2. **Task 2: Type admin page state and remove orphaned eslint-disable comments** - `a5299b4` (feat)

## Files Created/Modified
- `src/app/api/marketplace/purchase/route.ts` - removed `as any` on admin client
- `src/app/api/seller/withdraw/route.ts` - removed `as any` on createAdminClient()
- `src/app/api/webhooks/chain-deposits/route.ts` - 4 any -> TypedSupabaseClient
- `src/app/(admin)/admin/listings/page.tsx` - AdminListing interface, typed useState
- `src/app/(admin)/admin/verifications/page.tsx` - VerificationRequestWithProfile, typed useState
- `src/app/(marketplace)/marketplace/auctions/auctions-browse-content.tsx` - orphaned eslint-disable removed
- `src/lib/data-sources/adapters/terminal-bench.ts` - orphaned eslint-disable removed

## Decisions Made
- Used local interfaces for admin page state rather than importing from database.ts, because the API response shape includes joined profiles data not present in base types.
- `VerificationRequestWithProfile` extends `SellerVerificationRequest` to include the profiles join shape.

## Deviations from Plan
None — all fixes applied as specified.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- Phase 06 type-safety fully complete — all 7 plans (5 original + 2 gap closure) executed
- Total any count: 8 justified exceptions (4 unregistered RPCs, 3 lightweight-charts, 1 upsertBatch)
- `npx tsc --noEmit` exits clean

---
*Phase: 06-type-safety*
*Completed: 2026-03-04*
