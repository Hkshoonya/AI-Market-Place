# Phase 11: Zod Runtime Validation - Research

**Researched:** 2026-03-07
**Domain:** Zod schema validation at Supabase query boundaries
**Confidence:** HIGH

## Summary

This phase replaces 57 `as unknown as` type casts across 39 files with Zod runtime validation via a centralized `parseQueryResult` utility. The project already has Zod 4.3.6 installed and Sentry configured server-side, so no new dependencies are needed. The work is purely mechanical: define domain-grouped schemas in `src/lib/schemas/`, build a `parseQueryResult` utility in `src/lib/schemas/parse.ts`, then sweep through all 39 files replacing casts with validation calls.

The 57 casts break down into distinct categories: ~48 are Supabase query result casts (the primary target), 3 are test file mock casts (different treatment), 2 are Recharts component prop casts (UI library boundary, not Supabase), 1 is a `.update()` argument cast, and 1 is a `null as unknown as string` cast for guest orders. Each category needs slightly different handling.

**Primary recommendation:** Build `parseQueryResult` and `parseQueryResultSingle` utilities first, define per-table base schemas with `.pick()` / `.extend()` for query-specific shapes, then sweep files in domain groups (marketplace > catalog > rankings > admin > API routes > components).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `.safeParse()` everywhere -- never throws, always returns graceful fallback on failure
- Allow extra fields (default Zod behavior) -- don't use `.strict()`, so new DB columns won't break validation
- Match DB nullability -- use `.nullable()` for NULL columns, `.optional()` only for fields omitted by `.select()`
- parseQueryResult handles full Supabase `{ data, error }` wrapper -- checks `.error` first, then validates `.data` with Zod
- Centralized in `src/lib/schemas/` with domain-grouped files (marketplace.ts, models.ts, analytics.ts, index.ts)
- parseQueryResult utility lives in `src/lib/schemas/parse.ts`
- Coexist with existing interfaces -- derive types from schemas using `z.infer<>`, gradually migrate interfaces
- Per-table base schemas with `.pick()` / `.extend()` for query-specific shapes -- reduces duplication
- List queries: return empty array `[]` on validation failure -- user sees "no results" UI
- Single-item queries: return null with 404 response -- user sees "not found" UI
- Silent fallback -- no user-facing indication of validation failure
- Same pattern everywhere -- server components and API routes both use parseQueryResult
- Custom tag `error.type: schema_validation` + custom fingerprint `['schema-validation', schemaName]` for grouping
- Include full Zod `.issues` array as Sentry extra context -- shows which fields failed and why
- Do NOT capture raw data -- privacy risk (user info, emails, financial data)
- Rate limiting via fingerprinting -- identical schema errors group into one Sentry issue automatically

### Claude's Discretion
- How to handle the 3 test file casts (compute-scores tests) -- may need different treatment than prod code
- Exact schema field definitions per table -- derive from existing TypeScript interfaces
- Whether to add a `schemaName` parameter or auto-detect from schema
- Order of file migration (which files to tackle first)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TYPE-01 | Zod schemas defined for Supabase query results replacing `as unknown as` casts (56 instances across 38 files) | Base schemas per table in `src/lib/schemas/`, query-specific shapes via `.pick()`/`.extend()`, Zod 4.3.6 already installed |
| TYPE-02 | Shared parseQueryResult utility with graceful fallback for Zod validation at query boundaries | `parseQueryResult` and `parseQueryResultSingle` in `src/lib/schemas/parse.ts`, `.safeParse()` with empty array / null fallbacks |
| TYPE-03 | Sentry error classification distinguishes Zod validation errors from application errors | Custom `error.type: schema_validation` tag, custom fingerprint `['schema-validation', schemaName]`, Zod issues in extras |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.3.6 | Schema validation & type inference | Already installed, TypeScript-first, `.safeParse()` for non-throwing validation |
| @sentry/nextjs | (already installed) | Error reporting with custom tags | Already configured server-side, supports `tags` and `fingerprint` on `captureException` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | No new dependencies needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual Zod schemas | supabase-to-zod codegen | Ruled out in REQUIREMENTS.md -- manual schemas more maintainable for 56 casts |
| z.safeParse | z.parse (throwing) | Locked decision: safeParse everywhere for graceful fallback |
| z.strict() | Default (allow extra) | Locked decision: extra fields allowed so new DB columns don't break |

**Installation:**
```bash
# No installation needed -- zod@4.3.6 and @sentry/nextjs already in dependencies
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/schemas/
  index.ts            # Re-exports all schemas
  parse.ts            # parseQueryResult, parseQueryResultSingle utilities
  models.ts           # ModelSchema, BenchmarkScoreSchema, etc.
  marketplace.ts      # MarketplaceListingSchema, OrderSchema, ReviewSchema, etc.
  analytics.ts        # Admin analytics-specific schemas
  rankings.ts         # Leaderboard-specific query shapes
  community.ts        # Profile, Comment, Watchlist schemas
```

### Pattern 1: Base Schema with Query-Specific Shapes
**What:** Define one base schema per table, then use `.pick()` / `.extend()` for query-specific column selections.
**When to use:** Every Supabase query that selects specific columns or joins related tables.
**Example:**
```typescript
// src/lib/schemas/models.ts
import { z } from "zod";

// Base schema matching the Model interface in database.ts
export const ModelSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  provider: z.string(),
  category: z.string(),
  status: z.string(),
  overall_rank: z.number().nullable(),
  quality_score: z.number().nullable(),
  market_cap_estimate: z.number().nullable(),
  popularity_score: z.number().nullable(),
  is_open_weights: z.boolean().nullable(),
  // ... remaining fields
  created_at: z.string(),
  updated_at: z.string(),
});

export type Model = z.infer<typeof ModelSchema>;

// Query-specific shape for leaderboard explorer
export const ExplorerModelSchema = ModelSchema.pick({
  name: true,
  slug: true,
  provider: true,
  category: true,
  overall_rank: true,
  quality_score: true,
  // ... etc
});

// Query-specific shape with joined relations
export const RankedModelSchema = ModelSchema.pick({
  id: true,
  slug: true,
  name: true,
  provider: true,
  category: true,
  overall_rank: true,
  quality_score: true,
  market_cap_estimate: true,
  popularity_score: true,
  is_open_weights: true,
}).extend({
  benchmark_scores: z.array(z.object({
    score_normalized: z.number(),
    benchmarks: z.object({ slug: z.string() }).nullable(),
  })),
  model_pricing: z.array(z.object({
    input_price_per_million: z.number().nullable(),
  })),
});
```

### Pattern 2: parseQueryResult Utility
**What:** A single function that handles the full Supabase `{ data, error }` response, validates with Zod, and reports failures to Sentry.
**When to use:** Every Supabase query result in the application.
**Example:**
```typescript
// src/lib/schemas/parse.ts
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

/**
 * Validate a Supabase list query result with a Zod schema.
 * On validation failure: logs to Sentry, returns fallback (default: []).
 */
export function parseQueryResult<T>(
  response: { data: unknown; error: unknown },
  schema: z.ZodType<T>,
  schemaName: string,
  fallback: T[] = [] as unknown as T[],
): T[] {
  // Check Supabase error first
  if (response.error) {
    return fallback;
  }

  if (!response.data) {
    return fallback;
  }

  const arraySchema = z.array(schema);
  const result = arraySchema.safeParse(response.data);

  if (!result.success) {
    Sentry.captureException(
      new Error(`Schema validation failed: ${schemaName}`),
      {
        tags: { "error.type": "schema_validation" },
        fingerprint: ["schema-validation", schemaName],
        extra: {
          schemaName,
          issues: result.error.issues,
          // Do NOT include raw data -- privacy risk
        },
      },
    );
    return fallback;
  }

  return result.data;
}

/**
 * Validate a Supabase single-item query result with a Zod schema.
 * On validation failure: logs to Sentry, returns null.
 */
export function parseQueryResultSingle<T>(
  response: { data: unknown; error: unknown },
  schema: z.ZodType<T>,
  schemaName: string,
): T | null {
  if (response.error) {
    return null;
  }

  if (!response.data) {
    return null;
  }

  const result = schema.safeParse(response.data);

  if (!result.success) {
    Sentry.captureException(
      new Error(`Schema validation failed: ${schemaName}`),
      {
        tags: { "error.type": "schema_validation" },
        fingerprint: ["schema-validation", schemaName],
        extra: {
          schemaName,
          issues: result.error.issues,
        },
      },
    );
    return null;
  }

  return result.data;
}
```

### Pattern 3: Usage in Server Components
**What:** Replace `as unknown as` with `parseQueryResult` call.
**When to use:** All server component data fetching.
**Example:**
```typescript
// BEFORE:
const { data: rankedModelsRaw } = await supabase
  .from("models")
  .select("*, rankings(*), model_pricing(*)")
  .limit(20);
const rankedModels = rankedModelsRaw as unknown as RankedModel[] | null;

// AFTER:
const response = await supabase
  .from("models")
  .select("*, rankings(*), model_pricing(*)")
  .limit(20);
const rankedModels = parseQueryResult(response, RankedModelSchema, "RankedModel");
```

### Pattern 4: Usage in Client Components (with enrichment pattern)
**What:** For client components that fetch data and then enrich with profile lookups.
**When to use:** Comments, reviews, orders -- any client-side data that joins profiles separately.
**Example:**
```typescript
// BEFORE:
const { data: rawData } = await supabase.from("comments").select("*").eq("model_id", modelId);
let enriched: Comment[] = rawData as unknown as Comment[];

// AFTER:
const response = await supabase.from("comments").select("*").eq("model_id", modelId);
let enriched = parseQueryResult(response, CommentBaseSchema, "Comment");
// Then enrich with profiles as before
```

### Anti-Patterns to Avoid
- **Using `.strict()` on schemas:** New DB columns added later would cause validation failures on every query. Default Zod behavior (allow extra keys) is intentional.
- **Catching and re-throwing Zod errors:** Use `.safeParse()` everywhere. Never `.parse()`. The locked decision is graceful fallback, not error propagation.
- **Including raw data in Sentry extras:** Privacy risk. Only include the `issues` array (field paths and expected types).
- **Using `z.infer<>` without exporting schemas:** Always export both the schema and the inferred type so consuming files import the schema for runtime validation and the type for compile-time checking.
- **Defining schemas inline at usage sites:** All schemas go in `src/lib/schemas/` -- centralized, not scattered across 39 files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Custom validate functions | Zod `.safeParse()` | Handles nested objects, arrays, unions, nullability; generates precise error messages with field paths |
| Type inference | Manual type definitions alongside schemas | `z.infer<typeof Schema>` | Single source of truth -- schema defines both runtime validation and compile-time type |
| Error reporting | Custom logging for validation failures | `Sentry.captureException` with tags/fingerprint | Built-in grouping, rate limiting via fingerprinting, dashboard filtering by `error.type` |
| Supabase response unwrapping | Per-file error/null checks before casting | `parseQueryResult` utility | DRY, consistent fallback behavior, automatic Sentry reporting |

**Key insight:** The entire phase is about replacing ad-hoc `as unknown as` casts with a single utility function. The utility does three things: (1) checks Supabase error, (2) validates with Zod, (3) reports failures to Sentry. Every cast site becomes a one-liner.

## Common Pitfalls

### Pitfall 1: Inline Type Definitions Blocking Schema Reuse
**What goes wrong:** Many files define query-specific types inline (e.g., `type RankedModel = { ... }` inside the component). If schemas are defined separately but types remain inline, you get duplication.
**Why it happens:** 15+ files define local `type` aliases next to the query.
**How to avoid:** Delete inline type definitions and replace with `z.infer<typeof SchemaName>` imports. The schema IS the type definition.
**Warning signs:** Both a Zod schema import and a local `type` for the same shape in the same file.

### Pitfall 2: Nullable vs Optional Confusion
**What goes wrong:** Using `.optional()` where the column is nullable (returns `null` from DB, not `undefined`) or vice versa.
**Why it happens:** Zod `.optional()` means the field can be `undefined` (absent), while `.nullable()` means the field can be `null` (present but null). Supabase returns `null` for NULL columns, never `undefined`.
**How to avoid:** Follow the locked decision: `.nullable()` for NULL columns, `.optional()` only for fields that are omitted by `.select()` (i.e., the field is not in the query at all).
**Warning signs:** Zod validation errors on nullable DB columns saying "expected string, received null."

### Pitfall 3: Not Handling Non-Supabase Casts
**What goes wrong:** Trying to route every `as unknown as` through `parseQueryResult`, even for casts that are not Supabase query results.
**Why it happens:** The count is "57 casts" but not all are Supabase results.
**How to avoid:** Categorize casts before migrating:
  - **Supabase query results (~48):** Use `parseQueryResult` / `parseQueryResultSingle`
  - **Test file mock objects (3):** Leave as-is -- these cast mock objects to `SupabaseClient` type for test setup, not data validation
  - **Recharts prop casts (2):** These are UI library boundary casts (e.g., Recharts `payload` typing). Replace with properly typed callback params or a small local assertion, not `parseQueryResult`
  - **`.update()` argument cast (1):** `updates as unknown as MarketplaceListing` -- replace with a properly typed partial update object, not runtime validation
  - **`null as unknown as string` (1):** Guest order buyer_id -- fix by making the type accept `null`, not with Zod validation

### Pitfall 4: Schema Drift from Database Types
**What goes wrong:** Zod schemas diverge from `src/types/database.ts` interfaces over time as the database evolves.
**Why it happens:** Two sources of truth for the same data shape.
**How to avoid:** For now (locked decision), schemas coexist with interfaces. Schemas should be defined by referencing the existing interface fields. Leave a comment in each schema file: `// Derived from database.ts Model interface`. Future phases can migrate interfaces to `z.infer<>`.
**Warning signs:** Schema has fields not in the interface, or vice versa.

### Pitfall 5: Wrapping `{ data, error }` Destructuring
**What goes wrong:** Current code destructures `const { data } = await supabase...`. To use `parseQueryResult`, you need the full response object.
**Why it happens:** `parseQueryResult` takes `{ data, error }` as its first argument. Destructuring loses the error field.
**How to avoid:** Change destructuring to capture the full response: `const response = await supabase...` instead of `const { data } = await supabase...`. Then pass `response` to `parseQueryResult`.
**Warning signs:** Passing `{ data: someVar, error: undefined }` to `parseQueryResult` because the error was discarded.

### Pitfall 6: Sentry Not Imported in Client Components
**What goes wrong:** `parseQueryResult` calls `Sentry.captureException`, but `@sentry/nextjs` client config does not exist (only server + edge configs found).
**Why it happens:** The project has `sentry.server.config.ts` and `sentry.edge.config.ts` but no `sentry.client.config.ts`. Client components calling parseQueryResult would fail silently or error.
**How to avoid:** Check if a Sentry client SDK is initialized. If not, `parseQueryResult` should guard the Sentry call (e.g., check if `Sentry.captureException` exists before calling). Alternatively, use `console.error` as fallback for client-side. Or create a minimal `sentry.client.config.ts`.
**Warning signs:** Validation errors in client components (comments-section, listing-reviews, seller-orders-table) not appearing in Sentry dashboard.

## Code Examples

### Complete parseQueryResult Implementation
```typescript
// src/lib/schemas/parse.ts
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

type SupabaseResponse<T = unknown> = {
  data: T | null;
  error: { message: string; code?: string; details?: string } | null;
};

/**
 * Validate a Supabase list query result with a Zod array schema.
 * Returns validated data on success, empty array on failure.
 * Reports validation errors to Sentry with schema_validation classification.
 */
export function parseQueryResult<T>(
  response: SupabaseResponse,
  schema: z.ZodType<T>,
  schemaName: string,
): T[] {
  if (response.error || !response.data) {
    return [];
  }

  const result = z.array(schema).safeParse(response.data);

  if (!result.success) {
    reportSchemaError(schemaName, result.error);
    return [];
  }

  return result.data;
}

/**
 * Validate a Supabase single-row query result (.single()).
 * Returns validated data on success, null on failure.
 */
export function parseQueryResultSingle<T>(
  response: SupabaseResponse,
  schema: z.ZodType<T>,
  schemaName: string,
): T | null {
  if (response.error || !response.data) {
    return null;
  }

  const result = schema.safeParse(response.data);

  if (!result.success) {
    reportSchemaError(schemaName, result.error);
    return null;
  }

  return result.data;
}

function reportSchemaError(schemaName: string, error: z.ZodError): void {
  try {
    Sentry.captureException(
      new Error(`Schema validation failed: ${schemaName}`),
      {
        tags: { "error.type": "schema_validation" },
        fingerprint: ["schema-validation", schemaName],
        extra: {
          schemaName,
          issueCount: error.issues.length,
          issues: error.issues.map((issue) => ({
            code: issue.code,
            path: issue.path,
            message: issue.message,
          })),
        },
      },
    );
  } catch {
    // Sentry not available (e.g., client-side without client config)
    console.error(`[schema-validation] ${schemaName}:`, error.issues);
  }
}
```

### Base Schema Example (models.ts)
```typescript
// src/lib/schemas/models.ts
import { z } from "zod";

export const ModelBaseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  provider: z.string(),
  category: z.string(),
  status: z.string(),
  description: z.string().nullable(),
  short_description: z.string().nullable(),
  architecture: z.string().nullable(),
  parameter_count: z.number().nullable(),
  context_window: z.number().nullable(),
  training_data_cutoff: z.string().nullable(),
  release_date: z.string().nullable(),
  hf_model_id: z.string().nullable(),
  hf_downloads: z.number(),
  hf_likes: z.number(),
  hf_trending_score: z.number().nullable(),
  arxiv_paper_id: z.string().nullable(),
  website_url: z.string().nullable(),
  github_url: z.string().nullable(),
  license: z.string(),
  license_name: z.string().nullable(),
  is_open_weights: z.boolean(),
  is_api_available: z.boolean(),
  supported_languages: z.array(z.string()),
  modalities: z.array(z.string()),
  capabilities: z.record(z.string(), z.boolean()),
  provider_id: z.number().nullable(),
  overall_rank: z.number().nullable(),
  popularity_score: z.number().nullable(),
  quality_score: z.number().nullable(),
  value_score: z.number().nullable(),
  market_cap_estimate: z.number().nullable(),
  popularity_rank: z.number().nullable(),
  github_stars: z.number().nullable(),
  github_forks: z.number().nullable(),
  agent_score: z.number().nullable(),
  agent_rank: z.number().nullable(),
  capability_score: z.number().nullable(),
  capability_rank: z.number().nullable(),
  usage_score: z.number().nullable(),
  usage_rank: z.number().nullable(),
  expert_score: z.number().nullable(),
  expert_rank: z.number().nullable(),
  balanced_rank: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  data_refreshed_at: z.string().nullable(),
});

// Query-specific picks for different pages
export const HomeTopModelSchema = ModelBaseSchema.pick({
  id: true,
  slug: true,
  name: true,
  provider: true,
  category: true,
  overall_rank: true,
  quality_score: true,
  market_cap_estimate: true,
  popularity_score: true,
  is_open_weights: true,
}).extend({
  rankings: z.array(z.object({
    balanced_rank: z.number().nullable(),
  })),
  model_pricing: z.array(z.object({
    input_price_per_million: z.number().nullable(),
  })),
});
```

### Migration Example: Server Component
```typescript
// BEFORE (src/app/(rankings)/leaderboards/page.tsx):
const { data: rankedModelsRaw } = await supabase
  .from("models")
  .select("*, rankings(*), model_pricing(*), benchmark_scores(*, benchmarks(*)), elo_ratings(*)")
  .eq("status", "active")
  .not("overall_rank", "is", null)
  .order("overall_rank", { ascending: true })
  .limit(20);
type RankedModel = { id: string; slug: string; /* ... */ };
const rankedModels = rankedModelsRaw as unknown as RankedModel[] | null;

// AFTER:
import { parseQueryResult } from "@/lib/schemas/parse";
import { RankedModelSchema } from "@/lib/schemas/rankings";

const response = await supabase
  .from("models")
  .select("*, rankings(*), model_pricing(*), benchmark_scores(*, benchmarks(*)), elo_ratings(*)")
  .eq("status", "active")
  .not("overall_rank", "is", null)
  .order("overall_rank", { ascending: true })
  .limit(20);
const rankedModels = parseQueryResult(response, RankedModelSchema, "RankedModel");
// rankedModels is always T[] (never null) -- empty array on failure
```

### Migration Example: Single-Item Query
```typescript
// BEFORE (src/app/(marketplace)/marketplace/[slug]/page.tsx):
const { data: rawData, error } = await supabase
  .from("marketplace_listings")
  .select("*")
  .eq("slug", slug)
  .single();
if (error || !rawData) notFound();
const rawListing = rawData as unknown as MarketplaceListing;

// AFTER:
import { parseQueryResultSingle } from "@/lib/schemas/parse";
import { MarketplaceListingSchema } from "@/lib/schemas/marketplace";

const response = await supabase
  .from("marketplace_listings")
  .select("*")
  .eq("slug", slug)
  .single();
const rawListing = parseQueryResultSingle(response, MarketplaceListingSchema, "MarketplaceListing");
if (!rawListing) notFound();
```

## Cast Inventory and Classification

### Category A: Supabase List Query Casts (~44 instances, 32 files)
Standard `parseQueryResult` replacement. These are the bulk of the work.

**Key files by domain:**
- **Rankings (4 casts, 2 files):** leaderboards/page.tsx (4), leaderboards/[category]/page.tsx (1)
- **Catalog (7 casts, 5 files):** models/page.tsx (1), models/[slug]/page.tsx (2), providers/[slug]/page.tsx (1), providers/opengraph-image.tsx (1), skills/page.tsx (3), discover/page.tsx (1)
- **Marketplace pages (5 casts, 4 files):** marketplace/page.tsx (2), marketplace/browse/page.tsx (1), marketplace/[slug]/page.tsx (3), marketplace/opengraph-image.tsx (1)
- **Marketplace components (5 casts, 3 files):** seller-orders-table.tsx (2), seller-listings-table.tsx (1), listing-reviews.tsx (2)
- **Community components (2 casts, 1 file):** comments-section.tsx (2)
- **API routes (8 casts, 7 files):** activity/route.ts, watchlists/[id]/route.ts, marketplace/orders/route.ts, marketplace/orders/[id]/messages/route.ts, marketplace/auctions/route.ts, marketplace/auctions/[id]/route.ts, marketplace/listings/[slug]/reviews/route.ts
- **Admin pages (5 casts, 2 files):** admin/analytics/page.tsx (3), admin/reviews/page.tsx (2)
- **Auth pages (3 casts, 3 files):** orders/orders-content.tsx (1), orders/[id]/order-detail-content.tsx (1), profile/profile-content.tsx (1)
- **Lib utilities (3 casts, 2 files):** enrich-listings.ts (2), fetch-inputs.ts (1)
- **Charts (1 cast, 1 file):** benchmark-heatmap/route.ts (1)
- **Home (1 cast, 1 file):** page.tsx (1)

### Category B: Supabase Single-Item Casts (~4 instances, 3 files)
Use `parseQueryResultSingle` instead.
- `marketplace/[slug]/page.tsx`: ListingMeta (generateMetadata) + MarketplaceListing (page body)
- `admin/listings/[slug]/edit/page.tsx`: MarketplaceListing
- `watchlists/[id]/route.ts`: WatchlistWithItems (wrapped in `{ data, error }` structure)

### Category C: Test File Mock Casts (3 instances, 3 files)
**Recommendation:** Leave as-is. These cast mock objects to `SupabaseClient` type for test setup, not for data validation.
- `fetch-inputs.test.ts:52` -- `as unknown as SupabaseClient`
- `persist-results.test.ts:143` -- `as unknown as SupabaseClient`
- `compute-all-lenses.test.ts:171` -- `as unknown as SupabaseClient`

### Category D: Non-Supabase Casts (4 instances, 3 files)
**Handle individually, NOT through parseQueryResult:**
- `quality-price-frontier.tsx:393` -- Recharts `_data` callback parameter. Replace with typed handler or leave with explicit type annotation.
- `rank-timeline.tsx:456` -- Recharts `payload` prop. Replace with typed handler or leave with explicit type annotation.
- `marketplace/listings/[slug]/route.ts:190` -- `.update(updates as unknown as MarketplaceListing)`. Fix by properly typing the `updates` object.
- `marketplace/orders/route.ts:182` -- `null as unknown as string` for guest buyer_id. Fix by making the insert type accept `string | null`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `as unknown as Type` | Zod `.safeParse()` validation | Zod 3 (2022+) | Runtime safety + type inference from schemas |
| Zod 3 `z.object().strict()` | Zod 4 default passthrough | Zod 4 (2025) | Extra keys allowed by default -- exactly what this phase needs |
| Separate runtime + compile types | `z.infer<>` unifies both | Zod 3+ | Single source of truth eliminates drift |
| Zod 3 error format | Zod 4 `.issues` array with `input` field | Zod 4 (2025) | More structured error data for Sentry reporting |

**Deprecated/outdated:**
- Zod 3 API still works in v4 but some methods changed. `.parse()` and `.safeParse()` no longer accept `path` in params (GitHub issue #4128). Not relevant for this phase since we don't use `path` params.
- `z.nativeEnum()` is replaced by `z.enum()` accepting native enums in Zod 4. For this phase, string enums like `z.enum(["active", "deprecated", ...])` work fine.

## Sentry Integration Details

### Existing Sentry Configuration
The project has Sentry configured for **server-side only** (no client config found):
- `sentry.server.config.ts`: `Sentry.init({ dsn, tracesSampleRate: 0 })`
- `sentry.edge.config.ts`: Same pattern
- `src/instrumentation.ts`: Loads server/edge configs via `register()`
- `src/lib/api-error.ts`: Uses `Sentry.captureException(error, { tags: { source } })`

### Validation Error Reporting Pattern
```typescript
Sentry.captureException(
  new Error(`Schema validation failed: ${schemaName}`),
  {
    tags: { "error.type": "schema_validation" },
    fingerprint: ["schema-validation", schemaName],
    extra: {
      schemaName,
      issueCount: error.issues.length,
      issues: error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message,
        // NO raw data -- privacy locked decision
      })),
    },
  },
);
```

### Client-Side Consideration
Since there is no `sentry.client.config.ts`, `Sentry.captureException` may be a no-op or throw in client components. The `parseQueryResult` utility should wrap the Sentry call in a try-catch to handle this gracefully. Client components that use `parseQueryResult`: `comments-section.tsx`, `listing-reviews.tsx`, `seller-orders-table.tsx`, `seller-listings-table.tsx`, `orders-content.tsx`, `order-detail-content.tsx`, `profile-content.tsx`.

## Open Questions

1. **Client-side Sentry SDK**
   - What we know: Only server + edge Sentry configs exist. Client components calling `Sentry.captureException` may silently fail.
   - What's unclear: Whether `@sentry/nextjs` auto-initializes a client SDK even without explicit config, or if it no-ops.
   - Recommendation: Wrap the Sentry call in `reportSchemaError` with a try-catch. If client Sentry is needed, creating a minimal `sentry.client.config.ts` is a small addition.

2. **Exact count of non-Supabase casts**
   - What we know: At least 4 casts are not Supabase query results (Recharts x2, .update() x1, null cast x1).
   - What's unclear: Whether every remaining cast fits the `parseQueryResult` pattern cleanly.
   - Recommendation: During implementation, if a cast doesn't fit the utility pattern, fix it with proper typing rather than forcing it through `parseQueryResult`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest, via `vitest/config`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TYPE-01 | Zod schemas correctly validate known-good Supabase shapes | unit | `npx vitest run src/lib/schemas/ -x` | No -- Wave 0 |
| TYPE-01 | Zod schemas reject malformed data | unit | `npx vitest run src/lib/schemas/ -x` | No -- Wave 0 |
| TYPE-02 | parseQueryResult returns fallback on validation failure | unit | `npx vitest run src/lib/schemas/parse.test.ts -x` | No -- Wave 0 |
| TYPE-02 | parseQueryResult returns validated data on success | unit | `npx vitest run src/lib/schemas/parse.test.ts -x` | No -- Wave 0 |
| TYPE-02 | parseQueryResult handles Supabase error in response | unit | `npx vitest run src/lib/schemas/parse.test.ts -x` | No -- Wave 0 |
| TYPE-03 | Sentry.captureException called with correct tags/fingerprint on validation failure | unit | `npx vitest run src/lib/schemas/parse.test.ts -x` | No -- Wave 0 |
| TYPE-03 | Sentry error includes Zod issues array (no raw data) | unit | `npx vitest run src/lib/schemas/parse.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/schemas/ -x`
- **Per wave merge:** `npx vitest run && npx tsc --noEmit`
- **Phase gate:** Full suite green + `npx tsc --noEmit` clean before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/schemas/parse.test.ts` -- unit tests for parseQueryResult and parseQueryResultSingle (covers TYPE-02, TYPE-03)
- [ ] `src/lib/schemas/models.test.ts` -- validates base model schema and query-specific picks against sample data (covers TYPE-01)
- [ ] Sentry mock setup in test files: `vi.mock("@sentry/nextjs")` -- needed for TYPE-03 assertions

## Sources

### Primary (HIGH confidence)
- **Project codebase:** Direct inspection of all 39 files with `as unknown as` casts, `src/types/database.ts` (1449 lines), `src/lib/api-error.ts`, Sentry configs
- **Zod official docs (zod.dev/basics, zod.dev/api):** `.safeParse()` return structure, `.pick()`, `.extend()`, `.nullable()`, `.optional()`, `z.infer<>` usage
- **Installed package:** `zod@4.3.6` confirmed via `node -e "console.log(require('zod/package.json').version)"`

### Secondary (MEDIUM confidence)
- **Zod 4 release notes (zod.dev/v4):** Breaking changes from v3, new error format with `input` field in issues
- **Sentry captureException API:** Tags, fingerprint, and extra parameters verified against existing `handleApiError` usage pattern in codebase

### Tertiary (LOW confidence)
- **Client-side Sentry behavior:** Whether `@sentry/nextjs` auto-initializes client SDK without explicit `sentry.client.config.ts` -- needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Zod 4.3.6 already installed, API verified against official docs
- Architecture: HIGH -- patterns derived from actual codebase analysis of all 39 files and locked CONTEXT.md decisions
- Pitfalls: HIGH -- identified from direct code inspection, especially the cast categorization (Categories A-D)
- Sentry integration: MEDIUM -- server-side pattern confirmed from existing code, client-side behavior uncertain

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- Zod 4 API and Sentry API are well-established)
