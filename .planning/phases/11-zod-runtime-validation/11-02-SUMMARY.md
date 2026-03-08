---
phase: 11-zod-runtime-validation
plan: 02
subsystem: api
tags: [zod, runtime-validation, supabase, type-safety, sentry]

# Dependency graph
requires:
  - phase: 11-zod-runtime-validation/01
    provides: parseQueryResult/parseQueryResultSingle utilities, domain Zod schemas
provides:
  - All server-side Supabase query results validated at runtime via Zod
  - Zero as-unknown-as casts remaining in server components and API routes
  - Inline Zod schemas for page-specific query shapes
  - ModelWithDetailsSchema for model detail page with all relation joins
affects: [11-zod-runtime-validation/03, future schema additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "parseQueryResult replaces as-unknown-as on every Supabase list query"
    - "parseQueryResultSingle replaces as-unknown-as on every .single() query"
    - "Passthrough schemas (z.object({id}).passthrough()) for dynamic/embedded join results"
    - "Inline Zod schemas at query site for page-specific shapes not in central schema files"
    - "const response = await supabase... pattern preserves full {data, error} for parse utilities"

key-files:
  created: []
  modified:
    - src/app/page.tsx
    - src/app/(rankings)/leaderboards/page.tsx
    - src/app/(rankings)/leaderboards/[category]/page.tsx
    - src/app/(catalog)/models/page.tsx
    - src/app/(catalog)/models/[slug]/page.tsx
    - src/app/(catalog)/providers/[slug]/page.tsx
    - src/app/(catalog)/providers/opengraph-image.tsx
    - src/app/(catalog)/skills/page.tsx
    - src/app/(catalog)/discover/page.tsx
    - src/app/(marketplace)/marketplace/page.tsx
    - src/app/(marketplace)/marketplace/browse/page.tsx
    - src/app/(marketplace)/marketplace/[slug]/page.tsx
    - src/app/(marketplace)/marketplace/opengraph-image.tsx
    - src/app/(admin)/admin/analytics/page.tsx
    - src/app/(admin)/admin/reviews/page.tsx
    - src/app/(admin)/admin/listings/[slug]/edit/page.tsx
    - src/lib/marketplace/enrich-listings.ts
    - src/lib/compute-scores/fetch-inputs.ts
    - src/lib/schemas/models.ts
    - src/app/api/activity/route.ts
    - src/app/api/watchlists/[id]/route.ts
    - src/app/api/marketplace/orders/route.ts
    - src/app/api/marketplace/orders/[id]/messages/route.ts
    - src/app/api/marketplace/auctions/route.ts
    - src/app/api/marketplace/auctions/[id]/route.ts
    - src/app/api/marketplace/listings/[slug]/reviews/route.ts
    - src/app/api/marketplace/listings/[slug]/route.ts
    - src/app/api/charts/benchmark-heatmap/route.ts

key-decisions:
  - "Passthrough schemas for auction/order embedded joins where FK relationships are missing from DB types"
  - "Dynamic profile enrichment uses z.object({id}).passthrough() since field selection varies (card vs full vs admin)"
  - "Inline Zod schemas at query site for one-off query shapes rather than bloating central schema files"
  - "SellerCard profile validated via z.safeParse() in JSX IIFE since data comes from enrichment, not direct query"
  - "Non-Supabase casts fixed: null buyer_id typed as string|null, update payload typed as Partial<MarketplaceListing>"

patterns-established:
  - "Server query pattern: const response = await supabase... -> parseQueryResult(response, Schema, Name)"
  - "Paginated query pattern: extract count from response.count separately after parseQueryResult"
  - "Embedded join pattern: use passthrough schema when FK relationships are missing from generated types"
  - "Enrichment pattern: validate base data with strict schema, enrich with profiles in JS"

requirements-completed: [TYPE-01]

# Metrics
duration: 15min
completed: 2026-03-08
---

# Phase 11 Plan 02: Server & API Route Cast Migration Summary

**Replaced all 35+ as-unknown-as Supabase casts across 27 server files with parseQueryResult/parseQueryResultSingle Zod validation, plus 2 non-Supabase cast fixes**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-08T07:08:00Z
- **Completed:** 2026-03-08T07:23:00Z
- **Tasks:** 2
- **Files modified:** 28

## Accomplishments
- All 17 server page/lib files migrated from as-unknown-as casts to parseQueryResult validation
- All 9 API route files migrated from as-unknown-as casts to parseQueryResult validation
- 2 non-Supabase casts fixed with proper TypeScript typing (guest buyer_id null handling, partial update typing)
- ModelWithDetailsSchema added for model detail page with benchmark, pricing, ELO, ranking, and update joins
- Zero as-unknown-as casts remain in server-side code
- All 193 tests pass, TypeScript compiles clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate server page components (17 files, ~25 casts)** - `b89c3d1` (feat)
2. **Task 2: Migrate API routes + fix non-Supabase casts (9 files, ~13 casts)** - `20c5f7c` (feat)

## Files Created/Modified

### Server Pages (Task 1)
- `src/app/page.tsx` - Home page top models query validated with HomeTopModelSchema
- `src/app/(rankings)/leaderboards/page.tsx` - 4 queries validated (ranked, explorer, speed, value models)
- `src/app/(rankings)/leaderboards/[category]/page.tsx` - Category model query validated
- `src/app/(catalog)/models/page.tsx` - Models list with pricing join validated
- `src/app/(catalog)/models/[slug]/page.tsx` - Model detail with all relations validated via ModelWithDetailsSchema
- `src/app/(catalog)/providers/[slug]/page.tsx` - Provider models query validated
- `src/app/(catalog)/providers/opengraph-image.tsx` - Provider list OG image query validated
- `src/app/(catalog)/skills/page.tsx` - 3 queries validated (benchmarks, affiliates, deployments)
- `src/app/(catalog)/discover/page.tsx` - Profile rows query validated
- `src/app/(marketplace)/marketplace/page.tsx` - Listing type counts and featured listings validated
- `src/app/(marketplace)/marketplace/browse/page.tsx` - Browse listings query validated
- `src/app/(marketplace)/marketplace/[slug]/page.tsx` - Listing detail + metadata + seller profile validated
- `src/app/(marketplace)/marketplace/opengraph-image.tsx` - Marketplace OG listing type query validated
- `src/app/(admin)/admin/analytics/page.tsx` - 3 analytics queries validated
- `src/app/(admin)/admin/reviews/page.tsx` - Reviews + profiles + listings enrichment validated
- `src/app/(admin)/admin/listings/[slug]/edit/page.tsx` - Admin edit listing query validated
- `src/lib/marketplace/enrich-listings.ts` - Profile enrichment queries validated with passthrough schema
- `src/lib/compute-scores/fetch-inputs.ts` - Benchmark scores with slug join validated
- `src/lib/schemas/models.ts` - Added ModelWithDetailsSchema for model detail page

### API Routes (Task 2)
- `src/app/api/activity/route.ts` - Watchlist items join validated
- `src/app/api/watchlists/[id]/route.ts` - Watchlist with items and models join validated
- `src/app/api/marketplace/orders/route.ts` - Order rows validated; guest buyer_id null cast fixed
- `src/app/api/marketplace/orders/[id]/messages/route.ts` - Messages list + insert result validated
- `src/app/api/marketplace/auctions/route.ts` - Auctions list with embedded listing join validated
- `src/app/api/marketplace/auctions/[id]/route.ts` - Auction detail with listing join validated
- `src/app/api/marketplace/listings/[slug]/reviews/route.ts` - Reviews list validated
- `src/app/api/marketplace/listings/[slug]/route.ts` - Update payload cast fixed with Partial typing
- `src/app/api/charts/benchmark-heatmap/route.ts` - Benchmark scores with slug join validated

## Decisions Made
- Used passthrough schemas (`z.object({id}).passthrough()`) for dynamic embedded joins where FK relationships are missing from generated Supabase types, preserving all extra fields while still validating the core shape
- Defined inline Zod schemas at query sites for one-off query shapes (analytics, reviews enrichment) rather than adding to central schema files
- SellerCard profile data validated via inline `z.safeParse()` in JSX IIFE since it comes from the enrichment utility, not a direct Supabase query
- Fixed `null as unknown as string` for guest buyer_id by typing as `string | null` with a single assertion
- Fixed `.update(updates as unknown as MarketplaceListing)` by typing as `Partial<MarketplaceListing> & Record<string, unknown>`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed EnrichedReview type mismatch in admin reviews**
- **Found during:** Task 1 (admin/reviews/page.tsx)
- **Issue:** EnrichedReview type used `Omit<MarketplaceReview, "profiles">` which included fields not in the select query (updated_at, upvotes, is_verified_purchase)
- **Fix:** Changed to `Pick<MarketplaceReview, "id" | "rating" | "title" | "content" | "created_at" | "listing_id" | "reviewer_id">` to match actual query fields
- **Files modified:** src/app/(admin)/admin/reviews/page.tsx
- **Verification:** TypeScript compiles clean
- **Committed in:** b89c3d1 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Zod string vs enum mismatch for Supabase typed columns**
- **Found during:** Task 1 (models/[slug]/page.tsx, marketplace/[slug]/page.tsx, admin/listings/edit)
- **Issue:** Zod schemas use z.string() for enum-like fields (category, pricing_type, status), but Supabase SDK expects narrow string literal unions for .eq() filters and component props
- **Fix:** Added targeted type assertions (e.g., `as ModelCategory`, `as PricingType`, `as StatusType`) at usage sites where Zod-validated strings feed into typed interfaces
- **Files modified:** src/app/(catalog)/models/[slug]/page.tsx, src/app/(marketplace)/marketplace/[slug]/page.tsx, src/app/(admin)/admin/listings/[slug]/edit/page.tsx
- **Verification:** TypeScript compiles clean
- **Committed in:** b89c3d1 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for TypeScript compilation after Zod migration. No scope creep.

## Issues Encountered
- Task 1 was partially committed in a previous session as part of `b89c3d1` (Plan 03 summary commit). The pre-commit hook reformatted files, making the commit boundary less atomic than intended. All Task 1 changes are verified present in the committed state.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All server-side `as unknown as` casts eliminated across pages, API routes, and lib utilities
- Plan 03 (client components) was already completed in a parallel session
- Phase 11 is fully complete with all 3 plans executed
- Ready for Phase 12 (Testing)

---
*Phase: 11-zod-runtime-validation*
*Completed: 2026-03-08*
