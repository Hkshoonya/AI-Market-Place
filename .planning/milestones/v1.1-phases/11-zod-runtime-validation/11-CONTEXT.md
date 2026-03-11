# Phase 11: Zod Runtime Validation - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace all 57 `as unknown as` casts across 39 files with Zod schema validation at Supabase query boundaries. Create a shared parseQueryResult utility with graceful fallbacks. Validation errors are reported to Sentry with distinct classification. No new features, no DB changes.

</domain>

<decisions>
## Implementation Decisions

### Validation strictness
- `.safeParse()` everywhere — never throws, always returns graceful fallback on failure
- Allow extra fields (default Zod behavior) — don't use `.strict()`, so new DB columns won't break validation
- Match DB nullability — use `.nullable()` for NULL columns, `.optional()` only for fields omitted by `.select()`
- parseQueryResult handles full Supabase `{ data, error }` wrapper — checks `.error` first, then validates `.data` with Zod

### Schema organization
- Centralized in `src/lib/schemas/` with domain-grouped files (marketplace.ts, models.ts, analytics.ts, index.ts)
- parseQueryResult utility lives in `src/lib/schemas/parse.ts`
- Coexist with existing interfaces — derive types from schemas using `z.infer<>`, gradually migrate interfaces
- Per-table base schemas with `.pick()` / `.extend()` for query-specific shapes — reduces duplication

### Fallback behavior
- List queries: return empty array `[]` on validation failure — user sees "no results" UI
- Single-item queries: return null with 404 response — user sees "not found" UI
- Silent fallback — no user-facing indication of validation failure
- Same pattern everywhere — server components and API routes both use parseQueryResult

### Sentry error tagging
- Custom tag `error.type: schema_validation` + custom fingerprint `['schema-validation', schemaName]` for grouping
- Include full Zod `.issues` array as Sentry extra context — shows which fields failed and why
- Do NOT capture raw data — privacy risk (user info, emails, financial data)
- Rate limiting via fingerprinting — identical schema errors group into one Sentry issue automatically

### Claude's Discretion
- How to handle the 3 test file casts (compute-scores tests) — may need different treatment than prod code
- Exact schema field definitions per table — derive from existing TypeScript interfaces
- Whether to add a `schemaName` parameter or auto-detect from schema
- Order of file migration (which files to tackle first)

</decisions>

<specifics>
## Specific Ideas

- parseQueryResult is THE single integration point — all 57 casts flow through this one utility
- Zod 4.x is already installed (^4.3.6) — no new dependencies needed
- Pattern: `const result = parseQueryResult(supabaseResponse, Schema, fallback)` replaces `const data = response.data as unknown as Type`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/api-error.ts` (handleApiError): Already captures errors to Sentry — validation errors use Sentry directly, not handleApiError
- `src/types/database.ts`: Generated Supabase types — base for schema definitions
- `zod@^4.3.6`: Already in dependencies — no installation needed
- Existing interfaces in route files and component files — source for schema field definitions

### Established Patterns
- `as unknown as` cast pattern: `const { data } = await supabase.from('table').select('*') as unknown as { data: Type[] }`
- handleApiError for 5xx errors, 4xx excluded from Sentry (Phase 9 decision)
- createTaggedLogger for structured logging

### Integration Points
- 14 `.ts` files (API routes, lib utilities) with 17 casts
- 25 `.tsx` files (server components, client components) with 40 casts
- `src/lib/api-error.ts`: Sentry capture pattern to follow (but validation errors use distinct tagging)
- Sentry SDK already configured with tags support (Phase 9)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-zod-runtime-validation*
*Context gathered: 2026-03-07*
