---
phase: 06-type-safety
plan: 06
subsystem: type-safety
tags: [typescript, marketplace, payments, scoring, supabase]

# Dependency graph
requires:
  - phase: 06-type-safety
    provides: TypedSupabaseClient, MarketplaceListing from database.ts; NormalizationStats from quality-calculator
provides:
  - Zero unjustified any in delivery.ts, purchase-handlers.ts, enrich-listings.ts, model-matcher.ts, withdraw.ts, compute-scores/types.ts
affects: [future marketplace features, payments features, scoring pipeline changes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic select with TypedSupabaseClient: cast result via 'as unknown as T[]' when fields param is a generic string"
    - "Typed insert objects: build complete typed object upfront instead of dynamic Record<string, unknown>"

key-files:
  created: []
  modified:
    - src/lib/marketplace/delivery.ts
    - src/lib/marketplace/purchase-handlers.ts
    - src/lib/marketplace/enrich-listings.ts
    - src/lib/data-sources/model-matcher.ts
    - src/lib/payments/withdraw.ts
    - src/lib/compute-scores/types.ts

key-decisions:
  - "delivery.ts agent insert: extract capabilities as string[] via Array.isArray guard; extract mcp_endpoint via typeof string check"
  - "enrich-listings.ts: dynamic select(fields: string) returns GenericStringError with TypedSupabaseClient — cast via 'as unknown as Record<string, unknown>[]'"
  - "purchase-handlers.ts: replaced dynamic Record<string, unknown> orderInsert with fully-typed object; database.ts Insert type updated to include guest_email, guest_name, buyer_id nullable"
  - "withdraw.ts: createAdminClient() already returns SupabaseClient<Database> — as any casts were unnecessary"
  - "compute-scores/types.ts: Phase 6 now complete — replaced stats: any with stats: NormalizationStats"

patterns-established:
  - "Typed insert pattern: build single flat typed object with all conditional fields set to null when inactive, instead of dynamic Record<>"
  - "Dynamic select cast: when select fields are a generic string param (not literal), cast result 'as unknown as T | null' for type safety"

requirements-completed: [TYPE-05]

# Metrics
duration: 6min
completed: 2026-03-04
---

# Phase 06 Plan 06: Gap Closure — Library any Audit Summary

**12 unjustified any annotations removed from 6 src/lib/ files using MarketplaceListing and TypedSupabaseClient, closing the TYPE-05 gap**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-04T16:47:06Z
- **Completed:** 2026-03-04T16:53:06Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- delivery.ts: 5 `listing: any` params replaced with `listing: MarketplaceListing` — proper typing for all delivery functions
- purchase-handlers.ts: `SupabaseClient = any` alias replaced with `TypedSupabaseClient`; dynamic `Record<string, unknown>` insert replaced with typed object
- enrich-listings.ts: `AnyClient = any` alias replaced with `TypedSupabaseClient`; dynamic select results cast via `as unknown as` pattern
- model-matcher.ts: `SupabaseClient = any` alias replaced with `TypedSupabaseClient` in `buildModelLookup()`
- withdraw.ts: 2 `createAdminClient() as any` casts removed — type was already correct
- compute-scores/types.ts: `stats: any` replaced with `stats: NormalizationStats` — Phase 6 comment fulfilled

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace any in marketplace and data-source library files** - `8d0cb36` (feat)
2. **Task 2: Fix withdraw.ts casts and compute-scores/types.ts stats type** - `5f9476c` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/lib/marketplace/delivery.ts` - 5 `listing: any` -> `listing: MarketplaceListing`; agent insert uses typed capabilities extraction
- `src/lib/marketplace/purchase-handlers.ts` - `SupabaseClient = any` -> `TypedSupabaseClient`; refactored orderInsert to typed object
- `src/lib/marketplace/enrich-listings.ts` - `AnyClient = any` -> `TypedSupabaseClient`; cast dynamic select results
- `src/lib/data-sources/model-matcher.ts` - `SupabaseClient = any` -> `TypedSupabaseClient` in buildModelLookup()
- `src/lib/payments/withdraw.ts` - removed `as any` from both `createAdminClient()` calls
- `src/lib/compute-scores/types.ts` - `stats: NormalizationStats` replacing `stats: any`

## Decisions Made
- Dynamic `select(fields: string)` with TypedSupabaseClient returns `GenericStringError` (no shape inference for generic strings). Cast via `as unknown as Record<string, unknown>[]` — necessary because callers pass arbitrary field sets.
- `orderInsert` refactored from dynamic `Record<string, unknown>` to a flat typed object with all fields declared upfront. Guest-only fields (`guest_email`, `guest_name`) set to `null` for authenticated users.
- Marketplace_orders Insert type in database.ts now properly reflects `buyer_id?: string | null`, `guest_email`, `guest_name` — these fields existed in the DB but were missing from type definitions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type errors after removing any aliases**
- **Found during:** Task 1 (delivery.ts, enrich-listings.ts, purchase-handlers.ts)
- **Issue:** Removing `any` aliases exposed real type mismatches — `agentConfig.capabilities` typed as `unknown`, dynamic select returns `GenericStringError`, `Record<string, unknown>` insert incompatible with typed Supabase insert
- **Fix:** Used runtime type guards for capabilities extraction; cast dynamic select results; built fully-typed insert object for orders
- **Files modified:** delivery.ts, enrich-listings.ts, purchase-handlers.ts
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** 8d0cb36 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type errors from any removal)
**Impact on plan:** Auto-fix essential — removing any aliases exposed latent type issues that needed resolution. No scope creep.

## Issues Encountered
- `purchase-handlers.ts` had `marketplace_orders` Insert type missing `guest_email`, `guest_name`, and `buyer_id` as nullable. Database type was updated (linter applied changes via git stash) to reflect actual schema. This unblocked the typed insert approach.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 06 type-safety is fully complete — all 6 gap closure plans executed
- Total any count reduced from 96 (start of Phase 6) to 8 (4 unregistered RPCs, 3 lightweight-charts, 1 upsertBatch dynamic table)
- `npx tsc --noEmit` exits clean throughout Phase 6

---
*Phase: 06-type-safety*
*Completed: 2026-03-04*
