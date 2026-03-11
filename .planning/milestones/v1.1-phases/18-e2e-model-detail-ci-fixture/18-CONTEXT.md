# Phase 18: E2E Model Detail CI Fixture - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Make model-detail.spec.ts E2E tests execute real assertions in CI instead of skipping. The model detail page is a React Server Component that fetches from Supabase server-side — in CI with dummy Supabase URL, the server fetch fails → notFound() → 404 → tests skip. This phase adds server-side request mocking so the page renders with data in CI.

</domain>

<decisions>
## Implementation Decisions

### Server-side mock strategy
- Use MSW (Mock Service Worker) to intercept server-side Supabase PostgREST HTTP calls at the Node.js level
- MSW handles server-side RSC data fetching; existing Playwright mockApiRoute continues handling client-side SWR /api/* calls
- MSW started in `src/instrumentation.ts` (Next.js process) via `NEXT_PUBLIC_E2E_MSW` env var — must run in the same Node.js process as Next.js server to intercept RSC fetches (globalSetup runs in separate Playwright process, cannot intercept server-side requests)
- Broad table-level URL matching (e.g., /rest/v1/models*, /rest/v1/model_snapshots*) — not exact query string matching
- Add msw as devDependency

### Fixture data richness
- Comprehensive fixture data covering all joined tables: benchmark_scores, model_pricing, elo_ratings, rankings, model_updates, model_snapshots, similar models
- Dedicated model-detail.json fixture file (separate from existing models.json list view fixture)
- 2-3 model fixtures: GPT-4o (primary) + 1-2 others for similar-models sidebar and cross-navigation tests
- Real production data in fixtures — pull actual model stats from live DB, no synthetic/fake values

### Test assertion depth
- Structural + key data verification: page structure (heading, tabs, stats row) AND spot-check key values (model name in h1, score ranges, benchmark names)
- Each tab click verifies tab-specific content rendered: Benchmarks shows benchmark names, Pricing shows cost values, Deploy shows deployment info
- All 3 existing tests fixed to execute (not skip): page shell, tab navigation, leaderboard cross-navigation
- Remove test.skip() fallback entirely — tests must pass or fail, no silent skipping

### CI performance budget
- Keep existing 15min e2e timeout — MSW is lightweight, no additional CI overhead
- No extra services to spin up (no Docker, no local Supabase)

### Claude's Discretion
- MSW handler organization and file structure within e2e/
- Exact PostgREST URL patterns to match for each Supabase table query
- MSW lifecycle management in instrumentation.ts
- Specific assertion selectors for tab content verification
- How to extract real production data for fixtures

</decisions>

<specifics>
## Specific Ideas

- Fixture data must use real production values — pull actual model stats from the live Supabase database to create fixture JSON files
- MSW should be global so future RSC-based page tests get server-side mocking for free

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `e2e/helpers/routes.ts`: mockApiRoute and mockSupabaseRpc helpers for Playwright browser-side interception — continue using for client SWR calls
- `e2e/fixtures/models.json`: Existing fixture with 3 models (basic fields) — model-detail.json will be a richer superset
- `e2e/helpers/auth.ts`: Auth helper pattern to follow for MSW helper organization

### Established Patterns
- Model detail page (`src/app/(catalog)/models/[slug]/page.tsx`): Server Component using createClient() + parseQueryResultSingle() + ModelWithDetailsSchema
- Supabase PostgREST queries: select with joins (benchmark_scores, model_pricing, elo_ratings, rankings, model_updates) + .eq("slug", slug).single()
- Secondary queries: model_snapshots and similar models fetched separately after main model query
- Client SWR calls: /api/models/{slug}/deployments, /api/models/{slug}/description, /api/models/{slug}/bookmark

### Integration Points
- src/instrumentation.ts: Conditional MSW activation via env var
- CI workflow (.github/workflows/ci.yml): e2e job env vars — MSW needs to intercept calls to localhost:54321
- package.json: msw devDependency addition
- e2e/model-detail.spec.ts: Remove test.skip() patterns, add tab content assertions

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-e2e-model-detail-ci-fixture*
*Context gathered: 2026-03-11*
