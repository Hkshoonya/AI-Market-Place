---
status: diagnosed
trigger: "Model detail pages (e.g., /models/gpt-4) return a 404 error after phase 11 Zod migration"
created: 2026-03-08T13:00:00Z
updated: 2026-03-08T13:30:00Z
---

## Current Focus

hypothesis: Zod schema type mismatch — `ModelBaseSchema` defines `z.number()` for fields that Supabase returns as strings (Postgres `numeric`/`bigint` types), causing `parseQueryResultSingle` to fail validation and return `null`, which triggers `notFound()`.
test: Compared SQL column types in migrations against Zod schema field types
expecting: `numeric`/`bigint` columns are returned as strings by PostgREST; `z.number()` rejects strings
next_action: Fix must use `z.coerce.number()` (or `z.number().or(z.string().pipe(z.coerce.number()))`) for all `numeric`/`bigint` database columns

## Symptoms

expected: Navigating to /models/gpt-4 (or any model slug) shows the model detail page with benchmark scores, pricing, ELO ratings, and rankings.
actual: Page returns 404 (Next.js `notFound()` is called).
errors: No visible error in browser — just 404. Sentry would show "Schema validation failed: ModelWithDetails" from the `reportSchemaError` function.
reproduction: Navigate to any /models/[slug] URL.
started: After phase 11 (zod-runtime-validation) migration — the phase replaced raw `as` casts with `parseQueryResultSingle(response, ModelWithDetailsSchema, ...)`.

## Eliminated

(none — root cause identified on first hypothesis)

## Evidence

- timestamp: 2026-03-08T13:05:00Z
  checked: src/app/(catalog)/models/[slug]/page.tsx lines 100-118
  found: Query uses `SELECT *` with joins, then passes full response to `parseQueryResultSingle(modelResponse, ModelWithDetailsSchema, "ModelWithDetails")`. If validation fails, returns `null`, which triggers `notFound()` on line 118.
  implication: Any Zod validation failure = 404 to the user, with no visible error.

- timestamp: 2026-03-08T13:08:00Z
  checked: src/lib/schemas/parse.ts — `parseQueryResultSingle` function (lines 52-69)
  found: Uses `schema.safeParse(response.data)`. On failure, calls `reportSchemaError` (Sentry) and returns `null`. The error is swallowed — console.error fallback only if Sentry is unavailable.
  implication: Silent failure by design — user sees 404, no client-side error message.

- timestamp: 2026-03-08T13:12:00Z
  checked: SQL migrations for `models` table column types
  found: Multiple columns use Postgres `numeric` and `bigint` types:
    - `parameter_count bigint` (migration 001, line 42)
    - `hf_downloads bigint DEFAULT 0` (migration 001, line 49)
    - `hf_trending_score numeric(10,4)` (migration 001, line 51)
    - `popularity_score numeric(10,4)` (migration 001, line 69)
    - `quality_score numeric(10,4)` (migration 001, line 70)
    - `value_score numeric(10,4)` (migration 001, line 71)
    - `market_cap_estimate numeric` (migration 007, line 5)
    - `agent_score numeric` (migration 007, line 9)
    - `capability_score NUMERIC` (migration 014, line 4)
    - `usage_score NUMERIC` (migration 014, line 6)
    - `expert_score NUMERIC` (migration 014, line 8)
  implication: PostgREST (Supabase JS client) returns `numeric` and `bigint` values as **strings**, not JavaScript numbers, because JS `number` cannot safely represent arbitrary-precision numerics or 64-bit integers.

- timestamp: 2026-03-08T13:15:00Z
  checked: src/lib/schemas/models.ts — ModelBaseSchema field types
  found: All numeric/bigint columns are defined as `z.number()` or `z.number().nullable()`:
    - `parameter_count: z.number().nullable()` (line 19)
    - `hf_downloads: z.number()` (line 24) — **required, non-nullable**
    - `hf_likes: z.number()` (line 25) — **required, non-nullable** (SQL: `integer DEFAULT 0`)
    - `hf_trending_score: z.number().nullable()` (line 26)
    - `popularity_score: z.number().nullable()` (line 39)
    - `quality_score: z.number().nullable()` (line 40)
    - etc.
  implication: `z.number()` rejects string values like `"0"` or `"92.3000"`. Every model row will fail validation because at minimum `hf_downloads` (bigint, always present as a string) will be rejected.

- timestamp: 2026-03-08T13:17:00Z
  checked: Zod coercion usage in schemas
  found: Zero uses of `z.coerce` anywhere in `src/lib/schemas/`. No coercion, no `.transform()`, no `.pipe()` to convert string numerics.
  implication: The schema has no mechanism to handle string-encoded numbers from Postgres.

- timestamp: 2026-03-08T13:19:00Z
  checked: package.json Zod version
  found: `"zod": "^4.3.6"` — Zod v4, which uses passthrough by default for extra object keys (so the `fts` tsvector column from `SELECT *` is NOT a problem). But type checking is still strict — `z.number()` does not accept strings.
  implication: Extra fields are fine, but type mismatches are fatal.

- timestamp: 2026-03-08T13:22:00Z
  checked: Joined relation schemas (BenchmarkScoreSchema, ModelPricingSchema, EloRatingSchema)
  found: These also use `z.number()` for `numeric`-type SQL columns:
    - `BenchmarkScoreSchema.score: z.number()` — SQL: `numeric(12,4) NOT NULL`
    - `BenchmarkScoreSchema.score_normalized: z.number().nullable()` — SQL: `numeric(5,4)`
    - `ModelPricingSchema.input_price_per_million: z.number().nullable()` — SQL: `numeric(12,6)`
    - etc.
  implication: Even if the base model somehow passed, the joined relations would also fail for models that have benchmark scores or pricing data.

- timestamp: 2026-03-08T13:25:00Z
  checked: Pre-phase-11 code pattern (before Zod migration)
  found: Before phase 11, the code used TypeScript `as` casts: `const model = data as ModelWithDetails`. These casts perform zero runtime validation — they just tell TypeScript "trust me". The `Number()` calls in the template (e.g., `Number(model.quality_score).toFixed(1)` on line 334) handled the string-to-number conversion at render time.
  implication: The old code worked because `as` casts don't check types at runtime, and template code already handled string-to-number conversion. Phase 11 added runtime validation that correctly catches the type mismatch but incorrectly treats it as "no data" (404) rather than coercing the types.

- timestamp: 2026-03-08T13:27:00Z
  checked: `hf_likes` column — SQL type is `integer DEFAULT 0`
  found: `integer` (int4) columns ARE returned as JS numbers by PostgREST. Only `bigint` (int8) and `numeric` are returned as strings.
  implication: `hf_likes: z.number()` is actually fine. But `hf_downloads: z.number()` (bigint) will fail.

## Resolution

root_cause: |
  **Postgres numeric/bigint to JS string type mismatch in Zod schemas.**

  PostgREST (the REST layer Supabase uses) returns Postgres `numeric` and `bigint` column values as **JavaScript strings**, not numbers. This is by design — JavaScript `number` (IEEE 754 double) cannot safely represent all `bigint` (64-bit integer) or `numeric` (arbitrary precision) values.

  The `ModelBaseSchema` (and all related schemas: `BenchmarkScoreSchema`, `ModelPricingSchema`, etc.) define these fields as `z.number()`, which rejects string values at runtime.

  When `parseQueryResultSingle()` runs `ModelWithDetailsSchema.safeParse(data)`, validation fails because fields like `hf_downloads` (bigint -> string `"0"`), `quality_score` (numeric -> string `"92.3000"`), `parameter_count` (bigint -> string `"200000000000"`), etc. are strings, not numbers.

  The function returns `null` on validation failure, and the page component calls `notFound()` when model is null — producing the 404.

  This affects EVERY model, not just specific ones, because `hf_downloads` is a required non-nullable `bigint` field with a default of 0, so it's always present and always a string.

  **Scope of impact:** This same root cause likely affects ALL pages that use `parseQueryResult`/`parseQueryResultSingle` with schemas containing `z.number()` for `numeric`/`bigint` columns — potentially explaining UAT failures #2 (leaderboard), #6 (orders), and #7 (admin analytics) as well.

fix: (not applied — diagnosis only)
verification: (not applied — diagnosis only)
files_changed: []

### Affected Fields (models table — need `z.coerce.number()`)

| Field | SQL Type | Current Zod | Supabase Returns |
|-------|----------|-------------|------------------|
| parameter_count | bigint | z.number().nullable() | string or null |
| hf_downloads | bigint | z.number() | string |
| hf_trending_score | numeric(10,4) | z.number().nullable() | string or null |
| popularity_score | numeric(10,4) | z.number().nullable() | string or null |
| quality_score | numeric(10,4) | z.number().nullable() | string or null |
| value_score | numeric(10,4) | z.number().nullable() | string or null |
| market_cap_estimate | numeric | z.number().nullable() | string or null |
| agent_score | numeric | z.number().nullable() | string or null |
| capability_score | NUMERIC | z.number().nullable() | string or null |
| usage_score | NUMERIC | z.number().nullable() | string or null |
| expert_score | NUMERIC | z.number().nullable() | string or null |
| popularity_rank | integer | z.number().nullable() | number or null (OK) |

### Affected Fields (joined relations)

| Schema | Field | SQL Type |
|--------|-------|----------|
| BenchmarkScoreSchema | score | numeric(12,4) |
| BenchmarkScoreSchema | score_normalized | numeric(5,4) |
| ModelPricingSchema | input_price_per_million | numeric(12,6) |
| ModelPricingSchema | output_price_per_million | numeric(12,6) |
| ModelPricingSchema | all other price/numeric fields | numeric |
| EloRatingSchema | (none — elo_score is integer, OK) | |
| RankingSchema | score | numeric(12,4) |

### Suggested Fix Direction

Replace `z.number()` with `z.coerce.number()` for all `numeric`/`bigint` columns across all schemas in `src/lib/schemas/models.ts`. Zod v4's `z.coerce.number()` will parse the string `"92.3000"` into the number `92.3`. For nullable fields, use `z.coerce.number().nullable()`. This preserves runtime validation (rejects actual garbage values) while handling PostgREST's string encoding.
