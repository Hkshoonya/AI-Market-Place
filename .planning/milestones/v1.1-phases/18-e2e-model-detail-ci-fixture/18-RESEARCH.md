# Phase 18: E2E Model Detail CI Fixture - Research

**Researched:** 2026-03-11
**Domain:** MSW (Mock Service Worker) Node.js server-side HTTP interception + Playwright E2E
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use MSW (Mock Service Worker) to intercept server-side Supabase PostgREST HTTP calls at the Node.js level
- MSW handles server-side RSC data fetching; existing Playwright `mockApiRoute` continues handling client-side SWR `/api/*` calls
- MSW handlers registered globally in Playwright `globalSetup` so all E2E tests benefit from server-side Supabase mocking
- Broad table-level URL matching (e.g., `/rest/v1/models*`, `/rest/v1/model_snapshots*`) — not exact query string matching
- Add `msw` as devDependency
- Comprehensive fixture data covering all joined tables: `benchmark_scores`, `model_pricing`, `elo_ratings`, `rankings`, `model_updates`, `model_snapshots`, similar models
- Dedicated `model-detail.json` fixture file (separate from existing `models.json`)
- 2-3 model fixtures: GPT-4o (primary) + 1-2 others for similar-models sidebar and cross-navigation tests
- Real production data in fixtures — pull actual model stats from live DB, no synthetic/fake values
- Structural + key data verification: page structure (heading, tabs, stats row) AND spot-check key values
- Each tab click verifies tab-specific content rendered
- All 3 existing tests fixed to execute (not skip): page shell, tab navigation, leaderboard cross-navigation
- Remove `test.skip()` fallback entirely — tests must pass or fail, no silent skipping
- Keep existing 15min e2e timeout — MSW is lightweight, no additional CI overhead
- No extra services to spin up (no Docker, no local Supabase)

### Claude's Discretion
- MSW handler organization and file structure within `e2e/`
- Exact PostgREST URL patterns to match for each Supabase table query
- How to start/stop MSW server in Playwright `globalSetup`/`globalTeardown`
- Specific assertion selectors for tab content verification
- How to extract real production data for fixtures

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| E2E-03 | E2E test for model detail page (view model, check scores, navigate tabs) | MSW intercepts Supabase PostgREST HTTP calls so RSC renders with real fixture data; `model-detail.json` fixture provides complete joined data; `test.skip()` removed so assertions actually execute in CI |
</phase_requirements>

---

## Summary

Phase 18 fixes model-detail E2E tests that currently skip in CI because the RSC page calls Supabase server-side, gets ENOTFOUND with dummy credentials, and triggers `notFound()`. The root challenge is that Next.js server components run in the Next.js process, not the Playwright process — so `page.route()` cannot intercept them.

The solution is MSW (`msw/node`) running in the same Node.js process as Next.js dev server, activated via `src/instrumentation.ts`. MSW patches Node.js `http`/`https` modules directly, intercepting all outgoing HTTP from the Next.js process — including Supabase PostgREST calls made by RSC. An environment variable (`NEXT_PUBLIC_E2E_MSW=true`) gates MSW activation so it only runs during E2E tests. The CI workflow sets this env var in the `e2e` job.

**Critical architectural finding:** MSW already exists in the project (`msw@2.12.10` is installed). The `instrumentation.ts` already exists at `src/instrumentation.ts` (currently registers Sentry). Adding MSW requires: (1) extending `instrumentation.ts` with a conditional MSW block, (2) creating `e2e/mocks/server.ts` + `e2e/mocks/handlers.ts`, (3) creating `e2e/fixtures/model-detail.json`, (4) updating `playwright.config.ts` env vars to set `NEXT_PUBLIC_E2E_MSW=true`, (5) updating `.github/workflows/ci.yml` similarly, and (6) rewriting `e2e/model-detail.spec.ts` to remove all `test.skip()` patterns.

**Primary recommendation:** Use `instrumentation.ts` + `msw/node` for server-side interception. This is the correct pattern for Next.js App Router — it does NOT require `experimental.testProxy` or a separate mock bridge server. MSW is already installed. The implementation is a targeted 6-file change.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| msw | 2.12.10 (ALREADY INSTALLED) | Node.js HTTP interception via `setupServer` | Patches `http`/`https` at Node.js level; runs in same process as Next.js dev server; intercepts all outgoing requests including Supabase PostgREST |
| @playwright/test | 1.58.2 (ALREADY INSTALLED) | E2E test runner | Already used throughout project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| msw/node | part of msw 2.x | `setupServer` for Node.js environments | Server-side fetch interception from RSC |
| msw (browser) | part of msw 2.x | `setupWorker` + Service Worker | Client-side only — NOT used here; `page.route()` already handles client SWR |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `instrumentation.ts` + MSW | `next/experimental/testmode/playwright` (`testProxy`) | testProxy requires changing `playwright.config.ts` import from `@playwright/test` to `next/experimental/testmode/playwright` — invasive config change that breaks existing test structure; `instrumentation.ts` is less invasive and works with Next.js 16 |
| `instrumentation.ts` + MSW | Bridge mock server (separate HTTP process) | Requires running a separate process in CI; more complex; workers: 1 constraint needed for shared state; `instrumentation.ts` has none of these downsides |
| `instrumentation.ts` + MSW | Seed local Supabase | Requires Docker/Supabase CLI in CI; much higher operational overhead; CONTEXT.md explicitly ruled this out |

**Installation:** No installation needed — `msw@2.12.10` is already in `node_modules`.

---

## Architecture Patterns

### How MSW Intercepts RSC Requests

The key insight: **Next.js dev server and Playwright run in separate OS processes.** `page.route()` only intercepts browser-side requests. For server-side RSC fetches, MSW must run _inside_ the Next.js process.

```
CI / Local E2E run:
  Process 1: Playwright test runner (browser orchestration)
  Process 2: Next.js dev server  ← MSW runs here via instrumentation.ts
             │
             └─ RSC page renders → supabase.from("models")... → fetch to localhost:54321
                                    ↑ MSW intercepts this     ↑ returns fixture JSON
```

`instrumentation.ts` runs its `register()` function once when the Next.js server starts. When `NEXT_PUBLIC_E2E_MSW=true`, it imports `msw/node` and calls `server.listen({ onUnhandledRequest: "bypass" })`. This patches Node.js HTTP modules in the Next.js process, so all outgoing fetches to `http://localhost:54321/rest/v1/*` are intercepted and responded to with fixture data.

### Recommended File Structure

```
e2e/
├── fixtures/
│   ├── model-detail.json    # NEW: comprehensive model+joins fixture
│   ├── models.json          # existing — list view, unchanged
│   ├── leaderboard.json     # existing
│   └── listings.json        # existing
├── mocks/
│   ├── handlers.ts          # NEW: MSW http.get handlers for PostgREST URLs
│   └── server.ts            # NEW: setupServer(...handlers) export
├── helpers/
│   ├── routes.ts            # existing — client-side page.route() helpers
│   └── auth.ts              # existing — cookie injection
├── model-detail.spec.ts     # MODIFIED: remove test.skip(), add tab assertions
├── leaderboard.spec.ts      # unchanged
├── auth.spec.ts             # unchanged
└── marketplace.spec.ts      # unchanged

src/
└── instrumentation.ts       # MODIFIED: add MSW conditional block
```

### Pattern 1: `instrumentation.ts` Extension (CRITICAL)

The existing `instrumentation.ts` already handles Sentry. Add MSW inside the `nodejs` runtime block:

```typescript
// src/instrumentation.ts
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // MSW server-side interception for E2E tests
    // Only active when NEXT_PUBLIC_E2E_MSW=true (set by CI e2e job and local e2e)
    if (process.env.NEXT_PUBLIC_E2E_MSW === "true") {
      const { server } = await import("../e2e/mocks/server");
      server.listen({ onUnhandledRequest: "bypass" });
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
```

**Why `NEXT_PUBLIC_` prefix:** The env var needs to be available when Next.js reads it during instrumentation. `NEXT_PUBLIC_` variables are inlined at build time for client bundles but also available as `process.env` in Node.js server code during dev/test runs. A plain `E2E_MSW` (non-NEXT_PUBLIC) also works — either is fine.

**Why `onUnhandledRequest: "bypass"`:** All requests NOT matching our handlers (auth calls, other Supabase endpoints, Next.js internal requests) pass through to their original destination (or fail silently as before). This is safe because unmatched requests to `localhost:54321` will still fail with ENOTFOUND — but that's fine for tables we don't need to mock.

### Pattern 2: MSW Server + Handlers

```typescript
// e2e/mocks/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

```typescript
// e2e/mocks/handlers.ts
import { http, HttpResponse } from "msw";
import modelDetailFixture from "../fixtures/model-detail.json";

const BASE = "http://localhost:54321";

export const handlers = [
  // Main model detail query (with joins) — slug=eq.gpt-4o
  http.get(`${BASE}/rest/v1/models`, ({ request }) => {
    const url = new URL(request.url);
    const slugParam = url.searchParams.get("slug");
    // Return single model object (PostgREST .single() expects an object, not array)
    if (slugParam?.startsWith("eq.")) {
      return HttpResponse.json(modelDetailFixture.primary_model);
    }
    // Similar models query (eq("category", ...) + neq("id", ...))
    return HttpResponse.json(modelDetailFixture.similar_models);
  }),

  // model_snapshots table
  http.get(`${BASE}/rest/v1/model_snapshots`, () => {
    return HttpResponse.json(modelDetailFixture.snapshots);
  }),

  // model_news table
  http.get(`${BASE}/rest/v1/model_news`, () => {
    return HttpResponse.json([]);
  }),

  // Metadata query (generateMetadata also calls supabase)
  // Already covered by the /rest/v1/models handler above

  // Auth endpoints — bypass or return minimal response
  http.get(`${BASE}/auth/v1/user`, () => {
    return HttpResponse.json({ id: null }, { status: 401 });
  }),
];
```

**URL pattern note:** `http.get("http://localhost:54321/rest/v1/models")` in MSW 2.x matches the exact path. Supabase PostgREST puts all query params in the URL search params (e.g., `?select=*%2C...&slug=eq.gpt-4o`). The path itself is just `/rest/v1/models` — the handler fires for any GET to that path regardless of query params.

**Single vs array response:** Supabase `.single()` calls include `Accept: application/vnd.pgrst.object+json` header, which tells PostgREST to return an object instead of an array. MSW intercepts this and we must return the correct shape. The `parseQueryResultSingle` function receives the `{ data, error }` object from the Supabase client — the client handles the header negotiation internally. We return the raw model object (not wrapped in array) for the `.single()` path.

**Important:** The main model detail query uses `.select(...)...eq("slug", slug).single()` — the Supabase JS client sends `?slug=eq.gpt-4o` (for slug "gpt-4o") in the URL. The handler can distinguish single-model queries from list queries via the `slug` search param.

### Pattern 3: Fixture Structure (`model-detail.json`)

The fixture must satisfy `ModelWithDetailsSchema` (Zod-validated in `parseQueryResultSingle`). Required fields from `ModelBaseSchema` + joins:

```json
{
  "primary_model": {
    "id": "...",
    "slug": "gpt-4o",
    "name": "GPT-4o",
    "provider": "OpenAI",
    "category": "Multimodal",
    "status": "active",
    "description": "...",
    "short_description": "...",
    "architecture": "Transformer",
    "parameter_count": null,
    "context_window": 128000,
    "training_data_cutoff": null,
    "release_date": "2024-05-13",
    "hf_model_id": null,
    "hf_downloads": 0,
    "hf_likes": 0,
    "hf_trending_score": null,
    "arxiv_paper_id": null,
    "website_url": "https://openai.com/gpt-4o",
    "github_url": null,
    "license": "proprietary",
    "license_name": "Proprietary",
    "is_open_weights": false,
    "is_api_available": true,
    "supported_languages": [],
    "modalities": ["text", "image"],
    "capabilities": { "chat": true, "code": true, "vision": true },
    "provider_id": null,
    "overall_rank": 1,
    "popularity_score": 95,
    "quality_score": 95.2,
    "value_score": 72.4,
    "market_cap_estimate": 48500000000,
    "popularity_rank": 1,
    "github_stars": null,
    "github_forks": null,
    "agent_score": 91.2,
    "agent_rank": 1,
    "capability_score": 94.8,
    "capability_rank": 1,
    "usage_score": 96.1,
    "usage_rank": 1,
    "expert_score": 93.5,
    "expert_rank": 2,
    "balanced_rank": 1,
    "created_at": "2024-05-13T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z",
    "data_refreshed_at": null,
    "benchmark_scores": [ ... ],
    "model_pricing": [ ... ],
    "elo_ratings": [ ... ],
    "rankings": [ ... ],
    "model_updates": [ ... ]
  },
  "similar_models": [ ... ],
  "snapshots": [ ... ]
}
```

### Pattern 4: Playwright Config Extension

Add `NEXT_PUBLIC_E2E_MSW=true` to the `webServer.env` block so Next.js starts with MSW active:

```typescript
// playwright.config.ts — webServer.env addition
env: {
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  NEXT_PUBLIC_E2E_MSW: "true",   // NEW: activates MSW in instrumentation.ts
},
```

### Pattern 5: CI Workflow Update

Add `NEXT_PUBLIC_E2E_MSW: 'true'` to the `e2e` job's `env` block in `.github/workflows/ci.yml`:

```yaml
e2e:
  name: E2E
  env:
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321'
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
    NEXT_PUBLIC_E2E_MSW: 'true'   # NEW
```

### Anti-Patterns to Avoid

- **Do NOT use `globalSetup` to start MSW:** MSW needs to run _inside_ the Next.js process, not the Playwright test process. `globalSetup` runs in the Playwright process — it can't intercept Next.js server-side HTTP. The `instrumentation.ts` approach is correct.
- **Do NOT import `msw/node` in test files:** Handlers in `e2e/mocks/` are loaded by instrumentation.ts inside Next.js. Test files use `page.route()` only for client-side browser intercepts.
- **Do NOT use exact query string matching for PostgREST URLs:** Query params include encoded `select` clauses that change as code evolves. Match on path only (`/rest/v1/models`) and use request URL params to differentiate single vs list queries.
- **Do NOT use `experimental.testProxy`:** Requires changing `playwright.config.ts` import to `next/experimental/testmode/playwright` — breaks existing test structure and adds brittleness. The `instrumentation.ts` approach works with standard `@playwright/test`.
- **Do NOT skip `onUnhandledRequest: "bypass"`:** Without it, MSW defaults to "warn" and logs noise for every Supabase auth call or unmatched request. "bypass" silently passes unmatched requests through.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node.js HTTP interception | Custom monkey-patching of `http.request` | `msw/node` `setupServer` | MSW handles all edge cases: https, redirects, streaming, concurrent requests, cleanup |
| Request matching | Custom URL string comparison | MSW `http.get(pattern, handler)` with path params | MSW supports wildcards, path params, request inspection |
| Response building | Manual `JSON.stringify` + headers | `HttpResponse.json(data)` from msw | Correct Content-Type, status codes, headers automatically |

**Key insight:** MSW 2.x is already installed in this project — zero new dependencies needed.

---

## Common Pitfalls

### Pitfall 1: MSW Runs in Wrong Process
**What goes wrong:** Developer puts `server.listen()` in `playwright.config.ts` `globalSetup`. Tests still fail — RSC still gets 404.
**Why it happens:** `globalSetup` runs in the Playwright process. Next.js dev server is a different process — its HTTP calls are unaffected.
**How to avoid:** Use `instrumentation.ts` exclusively for MSW initialization. This is the only file that runs inside the Next.js process.
**Warning signs:** Tests still skip/fail with 404 after adding MSW; adding console.log to handlers never fires.

### Pitfall 2: Supabase `.single()` Response Shape
**What goes wrong:** Handler returns `[{...model...}]` (array). `parseQueryResultSingle` receives `{ data: [...], error: null }` — `schema.safeParse([...])` fails because it's not an object → returns null → `notFound()` → still 404.
**Why it happens:** PostgREST `.single()` returns a JSON object, not array. The Supabase client sends `Accept: application/vnd.pgrst.object+json` for `.single()` calls. MSW intercepts the request but we must return the right shape.
**How to avoid:** Return `HttpResponse.json(modelObject)` (plain object) — NOT wrapped in an array — for the main model query handler.
**Warning signs:** Page still 404s even though MSW handler fires (add `console.log` in handler to verify it fires).

### Pitfall 3: Fixture Fails Zod Validation
**What goes wrong:** `parseQueryResultSingle(response, ModelWithDetailsSchema, ...)` returns null because fixture JSON doesn't satisfy the schema. The `notFound()` branch executes. Page still 404s.
**Why it happens:** `ModelWithDetailsSchema` extends `ModelBaseSchema` which has strict types — `z.coerce.number()` for numeric fields, `z.boolean()` for boolean fields, `z.string()` for non-null strings. Missing required fields or wrong types fail validation.
**How to avoid:** Cross-reference `ModelWithDetailsSchema` and `ModelBaseSchema` field-by-field when building `model-detail.json`. Required non-nullable fields: `id`, `slug`, `name`, `provider`, `category`, `status`, `hf_downloads` (0), `hf_likes` (0), `license`, `is_api_available`, `supported_languages` ([]), `modalities` ([]), `capabilities` ({}), `created_at`, `updated_at`.
**Warning signs:** Sentry/console logs show "Schema validation failed: ModelWithDetails"; page 404s with MSW active.

### Pitfall 4: TypeScript Import Error from `e2e/mocks/server.ts` in `instrumentation.ts`
**What goes wrong:** `tsconfig.json` `paths` or `include` config doesn't cover `e2e/` directory — TypeScript compilation fails.
**Why it happens:** `e2e/` files are often excluded from the main tsconfig. `instrumentation.ts` importing from `../e2e/mocks/server` may be outside the compilation scope.
**How to avoid:** Use dynamic `import("../e2e/mocks/server")` (already in the pattern above). Also verify `tsconfig.json` includes `e2e` or add it. Alternatively, put mocks in `src/mocks/` to stay within the `src/` compilation boundary — but keeping in `e2e/` is cleaner for organizational reasons. Check `tsconfig.json` `include` field.
**Warning signs:** `npx tsc --noEmit` fails with "Cannot find module '../e2e/mocks/server'".

### Pitfall 5: `generateMetadata` Also Calls Supabase
**What goes wrong:** The model detail page has a `generateMetadata` export that makes a Supabase query (`supabase.from("models").select("name, provider, ...").eq("slug", slug).single()`). This runs before the page component. If this call fails, Next.js may still proceed to the page component — but it returns `{ title: "Model Not Found" }` which is fine. This is NOT a blocking issue.
**Why it happens:** `generateMetadata` is separate from the page component. It makes its own DB query.
**How to avoid:** The `/rest/v1/models` MSW handler already covers this query (same table, same URL pattern). The `generateMetadata` function handles null gracefully — it won't 404 even if the query fails.
**Warning signs:** None (this is handled gracefully already).

### Pitfall 6: `instrumentation.ts` Loads MSW in Production
**What goes wrong:** `NEXT_PUBLIC_E2E_MSW=true` accidentally set in production env. MSW starts listening and intercepts real Supabase calls → site returns fixture data in production.
**Why it happens:** Env var copy-paste error in deployment config.
**How to avoid:** The env var name `NEXT_PUBLIC_E2E_MSW` is clearly test-scoped. Never set it in production. The `instrumentation.ts` block is strictly conditional: `if (process.env.NEXT_PUBLIC_E2E_MSW === "true")`. The Coolify deployment config and `docs/DEPLOYMENT.md` should not mention this var.
**Warning signs:** Production pages show fixture data ("GPT-4o", hardcoded scores) instead of real DB data.

---

## Code Examples

### MSW 2.x Handler Syntax (Verified: msw@2.12.10)

```typescript
// Source: mswjs.io/docs/integrations/node
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("http://localhost:54321/rest/v1/models", ({ request }) => {
    const url = new URL(request.url);
    // Check if this is a single-model query (has slug param)
    const slugParam = url.searchParams.get("slug"); // "eq.gpt-4o"
    if (slugParam) {
      // Return single object for .single() queries
      return HttpResponse.json(primaryModelFixture);
    }
    // Return array for list queries
    return HttpResponse.json(similarModelsFixture);
  }),

  http.get("http://localhost:54321/rest/v1/model_snapshots", () => {
    return HttpResponse.json(snapshotsFixture);
  }),

  http.get("http://localhost:54321/rest/v1/model_news", () => {
    return HttpResponse.json([]);
  }),
);

// Start with bypass for unmatched requests
server.listen({ onUnhandledRequest: "bypass" });
```

### `instrumentation.ts` MSW Integration (Verified: Next.js instrumentation docs)

```typescript
// src/instrumentation.ts (extend existing file)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");  // existing

    if (process.env.NEXT_PUBLIC_E2E_MSW === "true") {
      const { server } = await import("../e2e/mocks/server");
      server.listen({ onUnhandledRequest: "bypass" });
    }
  }
  // ... edge config unchanged
}
```

### PostgREST URL Pattern Reference

With `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321`, Supabase JS client sends:

| Query | HTTP Request |
|-------|-------------|
| `.from("models").select(...).eq("slug", "gpt-4o").single()` | `GET http://localhost:54321/rest/v1/models?select=*%2Cbenchmark_scores(...)&slug=eq.gpt-4o` + `Accept: application/vnd.pgrst.object+json` |
| `.from("model_snapshots").select(...).eq("model_id", id)` | `GET http://localhost:54321/rest/v1/model_snapshots?select=...&model_id=eq.{id}` |
| `.from("models").select(...).eq("category", cat).neq("id", id).limit(5)` | `GET http://localhost:54321/rest/v1/models?select=...&category=eq.Multimodal&id=neq.{id}&limit=5` |
| `.from("model_news").select(...).contains("related_model_ids", [...])` | `GET http://localhost:54321/rest/v1/model_news?...` |
| `generateMetadata` models query | `GET http://localhost:54321/rest/v1/models?select=name%2Cprovider%2Cshort_description%2Ccategory&slug=eq.gpt-4o` |

**Handler matching:** MSW `http.get("http://localhost:54321/rest/v1/models", ...)` matches ALL of the above `/rest/v1/models` calls. Use `request.url` param inspection to return the correct shape (object vs array).

### Fixture Shape Validation Map

Fields required by `ModelBaseSchema` that must be non-null/non-optional in fixture:

```
id: string          slug: string          name: string
provider: string    category: string      status: string
hf_downloads: 0     hf_likes: 0           license: string
is_api_available: boolean
supported_languages: []
modalities: []
capabilities: {}
created_at: string  updated_at: string
```

Fields that can be `null`:
```
description, short_description, architecture, parameter_count,
context_window, training_data_cutoff, release_date, hf_model_id,
hf_trending_score, arxiv_paper_id, website_url, github_url,
license_name, is_open_weights, provider_id, overall_rank,
popularity_score, quality_score, value_score, market_cap_estimate,
popularity_rank, github_stars, github_forks, agent_score, agent_rank,
capability_score, capability_rank, usage_score, usage_rank,
expert_score, expert_rank, balanced_rank, data_refreshed_at
```

### Test Assertion Pattern (Tab Content Verification)

```typescript
// model-detail.spec.ts — after removing test.skip()
test("model detail page renders page shell with tabs", async ({ page }) => {
  await setupModelInterceptors(page);  // existing client-side SWR mocks
  await page.goto(MODEL_URL);

  // No skip — MSW ensures page renders with data
  const heading = page.locator("h1").first();
  await expect(heading).toBeVisible({ timeout: 10_000 });
  const headingText = await heading.textContent();
  expect(headingText).toContain("GPT-4o");  // key value assertion

  // Stats row
  await expect(page.getByText(/quality score/i)).toBeVisible();

  // Default tab: Benchmarks
  const benchmarksTab = page.getByRole("tab", { name: "Benchmarks" });
  await expect(benchmarksTab).toHaveAttribute("aria-selected", "true");
});

test("tab navigation switches content panels", async ({ page }) => {
  await setupModelInterceptors(page);
  await page.goto(MODEL_URL);

  // Pricing tab — verify content renders
  const pricingTab = page.getByRole("tab", { name: "Pricing" });
  await pricingTab.click();
  await expect(pricingTab).toHaveAttribute("aria-selected", "true");
  // Pricing tab content: expect cost per million tokens visible
  await expect(page.getByText(/per million/i).first()).toBeVisible();

  // Details tab — verify content
  const detailsTab = page.getByRole("tab", { name: "Details" });
  await detailsTab.click();
  await expect(detailsTab).toHaveAttribute("aria-selected", "true");

  // Deploy tab — triggers SWR call already mocked by setupModelInterceptors
  const deployTab = page.getByRole("tab", { name: "Deploy" });
  await deployTab.click();
  await expect(deployTab).toHaveAttribute("aria-selected", "true");
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MSW 1.x (`setupServer(rest.get(...))`) | MSW 2.x (`setupServer(http.get(...))`) | MSW 2.0 (Oct 2023) | `rest` removed; use `http` from `"msw"`; `HttpResponse.json()` replaces `ctx.json()` |
| `experimental.instrumentationHook: true` in next.config.ts | Instrumentation enabled by default | Next.js 14.0.4+ | No config flag needed; `instrumentation.ts` in root/`src/` auto-discovered |
| `page.route()` for server-side RSC | MSW in `instrumentation.ts` | N/A — different problems | `page.route()` remains for browser SWR calls; MSW is additive |

**Deprecated/outdated:**
- `rest.get` / `rest.post` from MSW 1.x: replaced by `http.get` / `http.post` from `"msw"` in 2.x
- `ctx.json(data)` response helper: replaced by `HttpResponse.json(data)` in 2.x
- MSW `worker.start()` for browser: not relevant here (server-side only)

---

## Open Questions

1. **`generateMetadata` queries and MSW handler disambiguation**
   - What we know: `generateMetadata` calls `.from("models").select("name, provider, short_description, category").eq("slug", slug).single()` — different `select` columns than the page component query
   - What's unclear: Does MSW handler need to distinguish between them, or can both return the full `primary_model` object (extra fields are ignored by PostgREST column selection — but MSW bypasses PostgREST entirely, so we return the full object and the Supabase client just reads what it needs)
   - Recommendation: Return full `primary_model` fixture for all `/rest/v1/models?slug=eq.*` queries. The Supabase client extracts only the columns it needs from the response. No disambiguation needed.

2. **Tab content assertions and DOM selectors**
   - What we know: Tabs are Radix UI `<TabsContent>` components; content only renders when tab is active; tab IDs from page.tsx are `"benchmarks"`, `"pricing"`, `"deploy"`, `"trading"`, `"trends"`, `"news"`, `"details"`, `"changelog"`
   - What's unclear: Exact visible text in each tab when fixture data has no benchmark scores, no pricing rows — depends on empty-state rendering in `BenchmarksTab`, `PricingTab` etc.
   - Recommendation: Use conservative assertions — check that tab becomes `aria-selected="true"` AND that _some_ content renders in the tab panel. Avoid asserting specific benchmark names unless fixture includes benchmark data. Include at least 1 benchmark score and 1 pricing row in fixture.

3. **`leaderboard cross-navigation` test (Test 3)**
   - What we know: Test 3 navigates to `/leaderboards`, finds model links, clicks the first. With MSW active, the leaderboard page still renders with empty data (Supabase calls for leaderboard use different tables not covered by model-detail handlers) — so no model links will appear
   - What's unclear: Whether to also add leaderboard MSW handlers for test 3, or restructure test 3 to navigate directly to the model URL
   - Recommendation: Restructure test 3 — navigate directly to `/models/gpt-4o` and verify we can navigate back to `/leaderboards` (reverse flow). Or simplify test 3 to just verify the model detail page is accessible via direct URL. The current "click model link from leaderboard" approach requires leaderboard data too.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test e2e/model-detail.spec.ts --project=chromium-desktop` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| E2E-03 | Model detail page renders with data (not 404) | E2E | `npx playwright test e2e/model-detail.spec.ts --project=chromium-desktop` | ✅ (needs modification) |
| E2E-03 | Page shell has h1 with model name, stats row, Benchmarks tab active | E2E | same | ✅ (assertions already written, blocked by skip) |
| E2E-03 | Tab navigation switches panels (Pricing, Details, Deploy) | E2E | same | ✅ (assertions already written, blocked by skip) |
| E2E-03 | Leaderboard cross-navigation | E2E | same | ✅ (needs restructure per open question 3) |

### Sampling Rate
- **Per task commit:** `npx playwright test e2e/model-detail.spec.ts --project=chromium-desktop`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `e2e/mocks/server.ts` — MSW setupServer export
- [ ] `e2e/mocks/handlers.ts` — PostgREST URL handlers
- [ ] `e2e/fixtures/model-detail.json` — comprehensive model+joins fixture
- No framework install needed (msw@2.12.10 already installed, @playwright/test@1.58.2 already installed)

---

## Sources

### Primary (HIGH confidence)
- MSW official docs (`mswjs.io/docs/integrations/node`) — setupServer API, listen() options, Node.js HTTP patching mechanism
- MSW official docs (`mswjs.io/docs/api/setup-server/listen`) — `onUnhandledRequest` options: "warn" | "error" | "bypass"
- Next.js official docs (`nextjs.org/docs/app/guides/instrumentation`) — `instrumentation.ts` register() lifecycle, NEXT_RUNTIME check pattern
- Project source (`src/instrumentation.ts`) — existing file structure (Sentry already registered)
- Project source (`src/app/(catalog)/models/[slug]/page.tsx`) — all Supabase tables queried, all joins
- Project source (`src/lib/schemas/models.ts`) — `ModelWithDetailsSchema` and `ModelBaseSchema` field requirements
- Project source (`src/lib/schemas/parse.ts`) — `parseQueryResultSingle` null-on-failure behavior
- Project source (`playwright.config.ts`) — webServer.env pattern for adding new env vars
- Project source (`e2e/model-detail.spec.ts`) — exact test.skip() patterns to remove
- Project source (`package.json`) — msw@2.12.10 confirmed installed, @playwright/test@1.58.2

### Secondary (MEDIUM confidence)
- DEV Community article (dev.to/ajth-in) — `instrumentation.ts` MSW pattern with `NEXT_PUBLIC_MSW_ENV` env var check
- DEV Community article (dev.to/webdeveloperhyper) — MSW bridge server pattern (considered but rejected: too complex)
- Momentic blog (momentic.ai/blog) — `next/experimental/testProxy` approach (considered but rejected: invasive config change)

### Tertiary (LOW confidence)
- Michele Ong blog (micheleong.com) — Notes that MSW does NOT intercept server actions (relevant: we're using route handlers, not server actions, so this doesn't apply)
- WebSearch result — Next.js 15 fixed server-side MSW interception that was broken in Next.js 14 App Router

---

## Metadata

**Confidence breakdown:**
- Standard stack (msw/node + instrumentation.ts): HIGH — official docs + project source confirmed; msw already installed
- Architecture (process separation, instrumentation.ts placement): HIGH — confirmed by official Next.js instrumentation docs and multiple verified sources
- Pitfalls (Zod validation, response shape): HIGH — derived directly from project source code (`parse.ts`, `models.ts` schemas)
- PostgREST URL patterns: MEDIUM — derived from Supabase PostgREST specification + NEXT_PUBLIC_SUPABASE_URL in project; exact query params depend on runtime behavior

**Research date:** 2026-03-11
**Valid until:** 2026-06-11 (stable — MSW 2.x API is stable; Next.js instrumentation is stable since 14.0.4)
