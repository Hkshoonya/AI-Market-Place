---
phase: 06-type-safety
plan: 05
subsystem: type-safety
tags: [typescript, supabase, type-safety, any-elimination]

# Dependency graph
requires:
  - phase: 06-type-safety plans 01-04
    provides: Database type, TypedSupabaseClient, catch block cleanup, supabase-as-any removal
provides:
  - TYPE-05 (total any count under 20 — verified at 8)
  - TYPE-01 (0 catch :any blocks)
  - TYPE-02 (0 supabase as any in app code)
  - TYPE-03 (0 :any in compare-client.tsx)
  - TYPE-04 (0 as any in admin pages)
  - Phase 06 complete — all 5 TYPE requirements passing
affects: [all future development — type safety baseline established]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createAdminClient() returns SupabaseClient<Database> — no cast needed"
    - "SelectQueryError pattern: join on unregistered relation → as unknown as LocalType[]"
    - "scopes: string[] DB type causes never-narrowing in typeof checks → rawScopes: unknown intermediate"
    - "Recharts CustomTooltip: type payload as Array<{ name, value, color? }> not any[]"
    - "Filter type guard predicate: .filter((m): m is NonNullable<typeof m> => m != null)"
    - "unregistered RPC: (supabase.rpc as any)('rpc_name', ...) is the accepted pattern"

key-files:
  created: []
  modified:
    - src/app/(admin)/admin/users/page.tsx
    - src/app/(auth)/profile/profile-content.tsx
    - src/app/(auth)/watchlists/[id]/watchlist-detail-content.tsx
    - src/app/(catalog)/models/[slug]/opengraph-image.tsx
    - src/app/(catalog)/models/[slug]/page.tsx
    - src/app/(catalog)/models/page.tsx
    - src/app/(catalog)/providers/[slug]/page.tsx
    - src/app/(catalog)/providers/page.tsx
    - src/app/(catalog)/search/page.tsx
    - src/app/(catalog)/skills/page.tsx
    - src/app/(marketplace)/dashboard/seller/listings/[slug]/edit/edit-listing-content.tsx
    - src/app/(marketplace)/marketplace/[slug]/page.tsx
    - src/app/(rankings)/leaderboards/[category]/page.tsx
    - src/app/(rankings)/leaderboards/opengraph-image.tsx
    - src/app/(rankings)/leaderboards/page.tsx
    - src/app/api/charts/benchmark-heatmap/route.ts
    - src/app/api/charts/ticker/route.ts
    - src/app/api/charts/top-movers/route.ts
    - src/app/api/charts/trading/route.ts
    - src/app/api/marketplace/listings/[slug]/pricing/route.ts
    - src/app/api/marketplace/listings/bot/route.ts
    - src/app/api/marketplace/orders/route.ts
    - src/app/api/models/[slug]/deployments/route.ts
    - src/app/api/models/[slug]/description/route.ts
    - src/app/api/search/route.ts
    - src/app/page.tsx
    - src/app/sitemap.ts
    - src/components/charts/benchmark-radar-overlay.tsx
    - src/components/charts/provider-charts.tsx
    - src/components/charts/quality-distribution.tsx
    - src/components/marketplace/view-tracker.tsx
    - src/components/models/models-grid.tsx
    - src/components/news/news-card.tsx
    - src/components/watchlists/add-to-watchlist.tsx
    - src/components/watchlists/watchlist-card.tsx
    - src/lib/compute-scores/fetch-inputs.ts
    - src/lib/data-sources/adapters/deployment-pricing.ts
    - src/lib/data-sources/orchestrator.ts
    - src/lib/middleware/api-paywall.ts

key-decisions:
  - "createAdminClient() already returns SupabaseClient<Database> — all admin as any casts were false assumptions"
  - "Tables model_deployments, deployment_platforms, api_keys, model_descriptions all exist in database.ts — their table-name as any casts were unnecessary"
  - "SelectQueryError from Supabase for unregistered join relations must be handled with as unknown as LocalType[] not supabase as any"
  - "scopes: string[] and modalities: string[] in DB types cause typeof=string checks to narrow to never — must break via rawX: unknown intermediate"
  - "8 justified any remain: 4 unregistered RPCs (supabase.rpc as any), 3 lightweight-charts setData(), 1 upsertBatch dynamic table"
  - "DeploymentPricingModel enum type used in PricingEntry interface instead of plain string"
  - "ModelsGrid props interface changed from models: any[] to fully typed interface with all fields"

patterns-established:
  - "Pattern 1: For any[] in map callbacks — remove annotation entirely and let TS infer from typed array"
  - "Pattern 2: For Supabase embedded join queries — use as unknown as LocalType[] at result assignment"
  - "Pattern 3: For admin client usage — use createAdminClient() directly, no cast needed"
  - "Pattern 4: For DB string[] fields used in typeof checks — cast to unknown first"
  - "Pattern 5: For unregistered RPCs — (supabase.rpc as any)('name', params) with inline comment"

requirements-completed: [TYPE-05]

# Metrics
duration: ~4 hours (continued from prior session)
completed: 2026-03-04
---

# Phase 06 Plan 05: Final any Audit and Cleanup Summary

**Reduced `any` from 96 to 8 across 39 files by eliminating false-assumption casts, untyped map callbacks, and any[] arrays — all 5 TYPE requirements verified passing with clean TypeScript compilation.**

## Performance

- **Duration:** ~4 hours (across 2 sessions)
- **Started:** 2026-03-04T07:30:00Z
- **Completed:** 2026-03-04T12:02:46Z
- **Tasks:** 1
- **Files modified:** 39

## Accomplishments
- Reduced `any` count from 96 to 8 (92% reduction), meeting the under-20 target (TYPE-05)
- Verified all 5 TYPE requirements: TYPE-01 (0 catch :any), TYPE-02 (0 supabase as any in app code), TYPE-03 (0 :any in compare-client), TYPE-04 (0 as any in admin pages), TYPE-05 (8 total, under 20)
- Discovered and corrected false assumptions: `createAdminClient()` and multiple table names already had proper types — the `as any` casts were unnecessary and masking real types
- Typed 39 files across API routes, pages, components, and library modules; `npx tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit remaining any occurrences and fix stragglers** - `f62dd0c` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

### API Routes (10 files)
- `src/app/api/charts/benchmark-heatmap/route.ts` - Added local ScoreWithBenchmark type for join results
- `src/app/api/charts/ticker/route.ts` - Removed as any[] casts and (m: any) callbacks
- `src/app/api/charts/top-movers/route.ts` - Added Database import, typed computeMovers parameter
- `src/app/api/charts/trading/route.ts` - Used (s as Record<string, unknown>)[metric] for dynamic field access
- `src/app/api/marketplace/listings/[slug]/pricing/route.ts` - Removed admin as any, fixed scopes.split never-type
- `src/app/api/marketplace/listings/bot/route.ts` - Removed 3 admin as any casts, fixed scopes.split
- `src/app/api/marketplace/orders/route.ts` - Added TypedSupabaseClient typing, restructured order enrichment
- `src/app/api/models/[slug]/deployments/route.ts` - Removed all as any table name casts (tables exist in database.ts)
- `src/app/api/models/[slug]/description/route.ts` - Removed model = modelRaw as any
- `src/app/api/search/route.ts` - Changed let marketplace: any[] to typed inline object array

### Pages — Catalog (6 files)
- `src/app/(catalog)/models/[slug]/page.tsx` - as unknown as ModelWithDetails, rawModalities: unknown
- `src/app/(catalog)/models/[slug]/opengraph-image.tsx` - Removed model = data as any
- `src/app/(catalog)/models/page.tsx` - Added ModelPageRow type for model_pricing join
- `src/app/(catalog)/providers/[slug]/page.tsx` - Added ProviderModelRow type, as unknown as
- `src/app/(catalog)/providers/page.tsx` - Removed as any[] in forEach
- `src/app/(catalog)/search/page.tsx` - Added Database import, createClient<Database>(), typed models array
- `src/app/(catalog)/skills/page.tsx` - Added BenchmarkScoreEntry type, removed 6 any casts

### Pages — Rankings (3 files)
- `src/app/(rankings)/leaderboards/page.tsx` - Added RankedModel, SpeedModel, ValueModel, ExplorerModel types; removed file-level eslint-disable
- `src/app/(rankings)/leaderboards/[category]/page.tsx` - Added CategoryModel type, removed file-level eslint-disable
- `src/app/(rankings)/leaderboards/opengraph-image.tsx` - Removed model: any in map

### Pages — Auth/Admin/Marketplace (5 files)
- `src/app/(admin)/admin/users/page.tsx` - Removed as any from profile update calls
- `src/app/(auth)/profile/profile-content.tsx` - Removed as any from profile update
- `src/app/(auth)/watchlists/[id]/watchlist-detail-content.tsx` - Removed item: any annotation
- `src/app/(marketplace)/marketplace/[slug]/page.tsx` - profiles as unknown as Pick<Profile, ...>
- `src/app/(marketplace)/dashboard/seller/listings/[slug]/edit/edit-listing-content.tsx` - useState<MarketplaceListing | null>

### Root Pages (2 files)
- `src/app/page.tsx` - Typed topModels with popularity_score field, removed as any[] casts
- `src/app/sitemap.ts` - Removed 3 as any[] / (p: any) casts

### Components (8 files)
- `src/components/charts/benchmark-radar-overlay.tsx` - Typed payload array
- `src/components/charts/provider-charts.tsx` - Typed CustomTooltip payload
- `src/components/charts/quality-distribution.tsx` - Typed CustomTooltip payload
- `src/components/marketplace/view-tracker.tsx` - Removed createClient() as any; kept (supabase.rpc as any)
- `src/components/models/models-grid.tsx` - Changed models: any[] to typed interface
- `src/components/news/news-card.tsx` - Typed update.models join result
- `src/components/watchlists/add-to-watchlist.tsx` - Removed w: any and item: any
- `src/components/watchlists/watchlist-card.tsx` - Added type guard, removed item: any

### Library (4 files)
- `src/lib/compute-scores/fetch-inputs.ts` - Added BenchmarkScoreWithSlug type for join results
- `src/lib/data-sources/adapters/deployment-pricing.ts` - DeploymentPricingModel enum, removed ctx as any
- `src/lib/data-sources/orchestrator.ts` - Added TypedSupabaseClient to executeAdapter signature
- `src/lib/middleware/api-paywall.ts` - Removed 2 admin as any casts

## Decisions Made

1. **createAdminClient() already typed**: The existing supabase admin client factory returns `SupabaseClient<Database>` — no cast needed. Approximately 6 files had unnecessary `admin as any` patterns masking real types.

2. **Table names don't need as any**: `model_deployments`, `deployment_platforms`, `api_keys`, `api_endpoint_pricing`, `model_descriptions` all existed in `database.ts` with proper `Tables` entries — their table name `as any` casts were false.

3. **8 justified any remain** (not fixed):
   - 4 unregistered RPC calls: `(supabase.rpc as any)('increment_view_count')`, `(supabase.rpc as any)('increment_comment_upvote')`, `(supabase.rpc as any)('get_public_stats')`, `(supabase.rpc as any)('increment_listing_purchases')`
   - 3 lightweight-charts `setData(data as any)` — library's `ISeriesApi.setData()` doesn't accept `Time[]` directly for custom types
   - 1 `upsertBatch` dynamic table string — established architectural exception from Plan 02/04

4. **scopes/modalities never-narrowing**: When a Supabase DB column is typed `string[]`, a `typeof x === "string"` branch becomes `never`. Must break via `rawX: unknown` intermediate — this is a TypeScript narrowing behavior, not a Supabase bug.

5. **SelectQueryError pattern**: For Supabase join queries on relations not in `Relationships[]`, the query result type becomes `SelectQueryError<...>`. Solution: define a local interface with the expected shape and use `as unknown as LocalType[]`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 6 files had admin as any masking properly-typed createAdminClient()**
- **Found during:** Task 1 (any audit)
- **Issue:** `createAdminClient()` returns `SupabaseClient<Database>` but callers cast it to `any` unnecessarily
- **Fix:** Removed all `admin as any` casts — used returned value directly
- **Files modified:** `api-paywall.ts`, `bot/route.ts`, `pricing/route.ts`, `deployments/route.ts`, `description/route.ts`, `orders/route.ts`
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** f62dd0c (Task 1 commit)

**2. [Rule 1 - Bug] scopes: string[] caused never-type narrowing in split guard**
- **Found during:** Task 1 — `bot/route.ts` and `pricing/route.ts`
- **Issue:** When column is `string[]` in DB types, `typeof scopes === "string"` narrows to `never`, making `scopes.split(",")` a type error
- **Fix:** Cast to `rawScopes: unknown` first, then check typeof on rawScopes
- **Files modified:** `bot/route.ts`, `pricing/route.ts`
- **Committed in:** f62dd0c (Task 1 commit)

**3. [Rule 1 - Bug] modalities: string[] caused never-type narrowing in Array.isArray guard**
- **Found during:** Task 1 — `models/[slug]/page.tsx`
- **Issue:** Same pattern — `modalities: string[]` in DB type causes `Array.isArray(modalities)` to always be true, making the string split branch dead code (`never`)
- **Fix:** `const rawModalities: unknown = model.modalities;` before the Array.isArray check
- **Files modified:** `src/app/(catalog)/models/[slug]/page.tsx`
- **Committed in:** f62dd0c (Task 1 commit)

**4. [Rule 1 - Bug] 5 files had SelectQueryError for unregistered joins**
- **Found during:** Task 1 — audit and TypeScript verification
- **Issue:** `leaderboards/page.tsx` queried `category_rank` from `rankings(*)` and `model_pricing(*)` — these joins not in `Relationships[]`, causing `SelectQueryError` return type
- **Fix:** Defined local types (RankedModel, SpeedModel, ValueModel, ExplorerModel, ModelPageRow, ProviderModelRow) and used `as unknown as LocalType[]`
- **Files modified:** `leaderboards/page.tsx`, `models/page.tsx`, `providers/[slug]/page.tsx`
- **Committed in:** f62dd0c (Task 1 commit)

**5. [Rule 3 - Blocking] TypeScript compile failures discovered during fix iterations (multiple rounds)**
- **Found during:** Task 1 — 3 rounds of `npx tsc --noEmit`
- **Issue:** Multiple cascading TypeScript errors surfaced as each batch of any was removed: missing fields in local types, null coalescing needed, type reassignment issues in orders/route.ts
- **Fix:** Iterative fixes — added fields to local types, added `?? ""` null coalescing, restructured orders to use intermediate `responseData` variable
- **Files modified:** All 39 files touched in this plan
- **Committed in:** f62dd0c (Task 1 commit)

---

**Total deviations:** 5 auto-fixed (3 type bugs, 1 type error cascade, 1 compile failure iteration)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep. The false `admin as any` casts were the largest single category of unnecessary any usage.

## Issues Encountered

1. **3 rounds of TypeScript compilation**: Removing any in batches triggered cascading errors — each fix revealed new type mismatches. Required 3 full `npx tsc --noEmit` passes to reach exit 0.

2. **Supabase SelectQueryError opacity**: When a join isn't registered in `Relationships[]`, the query result becomes `SelectQueryError<"Could not find a relationship...">`, which manifests as type errors on any field access. The error message is clear once you know to look for it, but it's not immediately obvious that `as unknown as` is the correct fix pattern.

3. **lightweight-charts incompatibility**: The `setData()` method on candlestick/line series doesn't accept typed `Time` arrays directly for custom time formats. These 3 remaining `as any` casts are library limitations, not code issues.

## Next Phase Readiness

Phase 06 (Type Safety) is now complete. All 5 TYPE requirements are verified:
- TYPE-01: 0 `catch (err: any)` blocks
- TYPE-02: 0 `supabase as any` in app code
- TYPE-03: 0 `:any` in compare-client.tsx
- TYPE-04: 0 `as any` in admin pages
- TYPE-05: 8 total any occurrences (under 20 target)

The codebase has a clean TypeScript foundation for Phase 07 (Phase 7 — next phase per ROADMAP).

8 justified `any` occurrences remain and are documented as accepted exceptions. No blockers.

## Self-Check

Files verified:
- `src/app/(rankings)/leaderboards/page.tsx` — FOUND
- `src/app/(rankings)/leaderboards/[category]/page.tsx` — FOUND
- `src/lib/data-sources/orchestrator.ts` — FOUND
- `src/lib/middleware/api-paywall.ts` — FOUND
- `src/components/models/models-grid.tsx` — FOUND
- `src/components/watchlists/watchlist-card.tsx` — FOUND
- `.planning/phases/06-type-safety/06-05-SUMMARY.md` — FOUND

Commits verified:
- `f62dd0c` feat(06-05): audit and fix remaining any occurrences — FOUND

## Self-Check: PASSED

---
*Phase: 06-type-safety*
*Completed: 2026-03-04*
