# Architecture Patterns

**Domain:** Production-readiness infrastructure for AI Market Cap (Next.js 16 App Router + Supabase)
**Researched:** 2026-03-05

## Recommended Architecture

The v1.1 production-readiness milestone adds **six integration layers** to the existing architecture. Each layer touches specific existing components and introduces new files. The key architectural principle is: **wrap existing patterns, don't replace them.** Every new system should hook into `handleApiError`, `createTaggedLogger`, and `TypedSupabaseClient` rather than creating parallel infrastructure.

```
                        +-------------------+
                        |   Root Layout     |
                        |  (layout.tsx)     |
                        +---+-----------+---+
                            |           |
                   +--------+--+    +---+--------+
                   | PostHog   |    | Sentry     |
                   | Provider  |    | Client Init|
                   | (client)  |    | (3 files)  |
                   +-----------+    +------------+
                            |
              +-------------+-------------+
              |             |             |
        +-----+----+  +----+-----+  +----+-----+
        | Pages    |  | Client   |  | API      |
        | (SSR)    |  | Comps    |  | Routes   |
        |          |  | (SWR)    |  | (Zod)    |
        +----------+  +----------+  +----------+
              |                          |
              |    +------------------+  |
              +--->| Supabase Client  |<-+
                   | (typed + Zod)    |
                   +------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `sentry.client.config.ts` | Client-side error capture, performance tracing | Root layout, all client components |
| `sentry.server.config.ts` | Server-side error capture in API routes, RSC | All API routes via `handleApiError` |
| `sentry.edge.config.ts` | Edge runtime error capture (middleware) | `src/middleware.ts` |
| `instrumentation.ts` | Sentry server-side init hook (Next.js instrumentation) | Next.js runtime |
| `src/components/providers/posthog-provider.tsx` | PostHog client-side init + pageview tracking | Root layout, wraps children |
| `src/lib/posthog/server.ts` | Server-side PostHog node client (singleton) | API routes for server-side event capture |
| `src/lib/supabase/validated-queries.ts` | Zod-validated Supabase query wrappers | API routes, replacing `as unknown as` casts |
| `src/hooks/use-api.ts` | SWR-based data fetching hook | Client components (replaces raw `fetch` in `useEffect`) |
| `.github/workflows/ci.yml` | Lint + typecheck + test on PRs | GitHub, blocks merge on failure |
| `playwright.config.ts` + `e2e/` | E2E test configuration and test files | CI pipeline, local dev |

### Data Flow Changes

#### Current: Raw fetch in useEffect
```
Component -> useEffect -> fetch("/api/...") -> setState(data) -> render
                                                setState(loading)
                                                setState(error)
```

#### New: SWR-based fetching
```
Component -> useSWR("/api/...") -> { data, error, isLoading, mutate } -> render
                                   (auto-cache, auto-revalidation, deduplication)
```

#### Current: Supabase joins with unsafe casts
```
API Route -> supabase.from("x").select("..., y(...)") -> data as unknown as T
```

#### New: Zod-validated queries
```
API Route -> validatedQuery(supabase, "x", "..., y(...)", ZodSchema) -> typed data | ApiError
```

## Integration Details

### 1. Sentry Error Tracking

**Confidence:** HIGH (official Next.js SDK, well-documented)

**New files (4):**
- `sentry.client.config.ts` (project root) -- client-side Sentry init
- `sentry.server.config.ts` (project root) -- server-side Sentry init
- `sentry.edge.config.ts` (project root) -- edge runtime Sentry init
- `instrumentation.ts` (project root) -- Next.js instrumentation hook that loads Sentry server config

**Modified files (3):**
- `next.config.ts` -- wrap with `withSentryConfig()` from `@sentry/nextjs`
- `src/lib/api-error.ts` -- add `Sentry.captureException(error)` inside `handleApiError` for non-ApiError cases
- `src/app/global-error.tsx` (new) -- Next.js App Router global error boundary with Sentry reporting

**Integration with existing `handleApiError`:**
```typescript
// src/lib/api-error.ts — MODIFIED
import * as Sentry from "@sentry/nextjs";

export function handleApiError(error: unknown, source: string): Response {
  if (error instanceof ApiError) {
    // Known errors: log but don't send to Sentry (not bugs)
    void systemLog.warn(source, error.message, { statusCode: error.statusCode });
    return Response.json({ error: error.message }, { status: error.statusCode });
  }
  // Unknown errors: capture in Sentry + existing logging
  Sentry.captureException(error, { tags: { source } });
  void systemLog.error(source, "Unexpected error", {
    error: error instanceof Error ? error.message : String(error),
  });
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
```

**CSP update required:** Add `https://*.ingest.sentry.io` to `connect-src` in `next.config.ts` headers.

**Build impact:** `@sentry/nextjs` wraps the Next.js build via `withSentryConfig()`. Source maps are uploaded during build. Adds ~30s to build time. No bundle size impact in production (source maps are uploaded, not shipped).

### 2. PostHog Product Analytics

**Confidence:** HIGH (official Next.js guide, well-documented for App Router)

**New files (2):**
- `src/components/providers/posthog-provider.tsx` -- client component wrapping `PostHogProvider` from `posthog-js/react`
- `src/lib/posthog/server.ts` -- singleton PostHog Node client for server-side events

**Modified files (2):**
- `src/app/layout.tsx` -- add `<PostHogProvider>` inside `<AuthProvider>` (order matters: auth context should be available to PostHog for user identification)
- `next.config.ts` -- add `https://us.i.posthog.com` (or eu) to CSP `connect-src` and `script-src`

**Provider architecture:**
```typescript
// src/components/providers/posthog-provider.tsx — NEW
"use client";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Init once
if (typeof window !== "undefined") {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_pageview: false, // manual pageviews for App Router
  });
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();
  useEffect(() => {
    if (pathname) ph.capture("$pageview", { $current_url: window.location.href });
  }, [pathname, searchParams, ph]);
  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PageviewTracker />
      {children}
    </PHProvider>
  );
}
```

**Layout integration point** in existing `layout.tsx`:
```tsx
<AuthProvider>
  <PostHogProvider>    {/* NEW — wraps inside AuthProvider */}
    <TooltipProvider>
      ...existing tree...
    </TooltipProvider>
  </PostHogProvider>
</AuthProvider>
```

**User identification:** Hook into `AuthProvider`'s session state to call `posthog.identify(user.id)` when user logs in, and `posthog.reset()` on logout. This connects anonymous pageviews to authenticated users.

### 3. SWR for Client-Side Data Fetching

**Confidence:** HIGH (established pattern, minimal footprint)

**Recommendation: SWR over TanStack Query** because:
- The codebase is read-heavy (rankings, charts, ticker data) with very few client-side mutations
- SWR is 4.2KB gzipped vs TanStack Query's 13.4KB -- 3x smaller bundle
- SWR integrates natively with Next.js (same Vercel ecosystem)
- No DevTools or complex hydration setup needed (data loads client-side via API routes)
- The project already uses `@tanstack/react-table` (not the same as TanStack Query -- no shared dependency advantage)

**New files (1):**
- `src/hooks/use-api.ts` -- typed SWR wrapper with error handling

**Modified files (~15-20 client components):** Replace `useEffect` + `fetch` + `useState` trios with `useSWR`. Each modification is mechanical and independent.

**Pattern replacement:**
```typescript
// src/hooks/use-api.ts — NEW
import useSWR, { SWRConfiguration } from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};

export function useApi<T>(url: string | null, config?: SWRConfiguration) {
  return useSWR<T>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000, // 30s dedup for ranking data
    ...config,
  });
}
```

**Example migration** (top-movers.tsx):
```typescript
// BEFORE: 7 lines of boilerplate
const [data, setData] = useState<TopMoversData | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
useEffect(() => {
  fetch("/api/charts/top-movers?limit=10")
    .then((r) => r.json()).then((d) => setData(d))
    .catch(() => setError("Failed to load")).finally(() => setLoading(false));
}, []);

// AFTER: 1 line
const { data, error, isLoading } = useApi<TopMoversData>("/api/charts/top-movers?limit=10");
```

**Components to migrate (identified by `fetch` in `useEffect` pattern):**
1. `top-movers.tsx` -- chart data
2. `market-ticker.tsx` -- ticker data
3. `trading-chart.tsx` -- trading data
4. `benchmark-heatmap.tsx` -- heatmap data
5. `rank-timeline.tsx` -- timeline data
6. `notification-bell.tsx` -- notifications (2 fetches)
7. `activity-feed.tsx` -- activity data
8. `trending-models.tsx` -- trending data
9. `add-to-watchlist.tsx` -- watchlists list
10. `seller-listings-table.tsx` -- seller listings
11. `seller-orders-table.tsx` -- seller orders
12. `listing-reviews.tsx` -- reviews data

**Mutation-heavy components** (forms, purchases, bids) should NOT use SWR -- keep raw `fetch` for POST/PUT/DELETE with `mutate()` to invalidate related caches.

### 4. Zod Runtime Validation for Supabase Queries

**Confidence:** HIGH (Zod already in `package.json` at v4.3.6, used in input validation)

**New files (2):**
- `src/lib/supabase/schemas.ts` -- Zod schemas for common Supabase query results (models with joins, listings with profiles, etc.)
- `src/lib/supabase/validated-queries.ts` -- utility to parse Supabase results through Zod schemas

**Modified files (~15-20):** Every file currently using `as unknown as` casts on Supabase query results.

**Pattern:**
```typescript
// src/lib/supabase/validated-queries.ts — NEW
import { z } from "zod";

export function parseQueryResult<T>(
  data: unknown,
  schema: z.ZodType<T>,
  source: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Log the validation failure for debugging but don't crash
    console.warn(`[${source}] Supabase result validation failed:`, result.error.issues);
    // Fall back to unsafe cast (graceful degradation during migration)
    return data as T;
  }
  return result.data;
}

export function parseQueryArray<T>(
  data: unknown[],
  schema: z.ZodType<T>,
  source: string
): T[] {
  return z.array(schema).parse(data); // throws on invalid — catch in handleApiError
}
```

**Target `as unknown as` casts** (20+ found in codebase):
- `src/app/page.tsx` -- topModels join
- `src/components/models/comments-section.tsx` -- comments with profiles
- `src/lib/compute-scores/fetch-inputs.ts` -- benchmark scores with slugs
- `src/lib/marketplace/enrich-listings.ts` -- profiles enrichment
- `src/app/api/watchlists/[id]/route.ts` -- watchlist with items
- `src/app/(catalog)/skills/page.tsx` -- benchmark data, platforms, deployments
- `src/components/marketplace/seller-orders-table.tsx` -- orders with profiles
- `src/components/marketplace/seller-listings-table.tsx` -- listings
- `src/components/marketplace/listing-reviews.tsx` -- reviews with profiles
- `src/components/charts/quality-price-frontier.tsx` -- recharts data point

**Schema example:**
```typescript
// src/lib/supabase/schemas.ts — NEW
import { z } from "zod";

export const ModelWithJoinsSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  provider: z.string(),
  category: z.string(),
  overall_rank: z.number().nullable(),
  quality_score: z.number().nullable(),
  market_cap_estimate: z.number().nullable(),
  // ... remaining fields
  rankings: z.array(z.object({
    balanced_rank: z.number().nullable(),
  })).optional(),
  model_pricing: z.array(z.object({
    input_price_per_million: z.number().nullable(),
  })).optional(),
});
```

### 5. Component Testing (Vitest + React Testing Library)

**Confidence:** HIGH (Vitest already configured, RTL is standard)

**New files:**
- `vitest.config.ts` -- MODIFIED to add `jsdom` environment for component tests
- `src/test/setup.ts` -- RTL setup file (cleanup, custom matchers)
- `src/components/**/*.test.tsx` -- component test files co-located with components

**Modified files (1):**
- `vitest.config.ts` -- add `jsdom` environment, RTL setup file, separate test includes for unit vs component

**Updated vitest config:**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    environment: 'jsdom',        // changed from 'node'
    setupFiles: ['./src/test/setup.ts'],
    environmentMatchGlobs: [
      // Keep node env for pure logic tests
      ['src/lib/**/*.test.ts', 'node'],
    ],
  },
});
```

**Key constraint:** Async Server Components cannot be tested with RTL/Vitest (React ecosystem limitation). Only test Client Components (those with `"use client"` directive). Server Components should be covered by Playwright E2E tests.

**Priority components for testing:**
1. `leaderboard-explorer.tsx` -- core product, complex table interactions
2. `model-card.tsx` -- heavily used, many conditional renders
3. `search-dialog.tsx` -- user interaction heavy
4. `notification-bell.tsx` -- auth-dependent state
5. `market-ticker.tsx` -- animation + data display

### 6. Playwright E2E Testing

**Confidence:** HIGH (official Next.js integration, well-documented)

**New files:**
- `playwright.config.ts` (project root)
- `e2e/` directory with test files
- `e2e/fixtures/` -- shared test utilities (auth helpers, etc.)

**Configuration:**
```typescript
// playwright.config.ts — NEW
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

**Critical paths to test:**
1. Homepage loads with rankings table
2. Model detail page renders with all tabs
3. Search finds a model and navigates to it
4. Marketplace listing page loads
5. Login/logout flow (with Supabase test user)

### 7. GitHub Actions CI/CD Pipeline

**Confidence:** HIGH (standard pattern, no complexity)

**New files (1):**
- `.github/workflows/ci.yml` -- CI pipeline for PRs

**Existing file preserved:**
- `.github/workflows/cron-sync.yml` -- unchanged, separate concern

**Pipeline design:**
```yaml
# .github/workflows/ci.yml — NEW
name: CI
on:
  pull_request:
    branches: [main, feat/*]
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx eslint .
      - run: npx tsc --noEmit
      - run: npm test  # vitest run (170+ unit/component tests)

  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: validate  # only run E2E if lint/type/unit pass
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
```

**Sequencing rationale:** `validate` runs first (fast: ~2min). `e2e` only runs if validate passes (slow: ~5-10min). This avoids wasting CI minutes on E2E when there are type errors.

## Patterns to Follow

### Pattern 1: Provider Nesting Order
**What:** Providers in `layout.tsx` must nest in dependency order.
**When:** Adding any new provider (PostHog, Sentry, future providers).
**Rule:** `AuthProvider > PostHogProvider > TooltipProvider > children`. Auth must be outermost because PostHog needs user identity from auth context.

### Pattern 2: Error Boundary Integration
**What:** Sentry hooks into the existing `handleApiError` pattern -- single integration point for all 65 API routes.
**When:** Any new API route.
**Rule:** Always use `handleApiError` in catch blocks. Sentry capture happens automatically inside it. Never call `Sentry.captureException` directly in route handlers.

### Pattern 3: SWR Key Convention
**What:** SWR cache keys are the API URL strings.
**When:** Any client component fetching data.
**Rule:** Use the full API path as the key (e.g., `/api/charts/top-movers?limit=10`). This enables automatic deduplication when multiple components fetch the same endpoint. Pass `null` as key to conditionally skip fetching.

### Pattern 4: Zod Schema Co-location
**What:** Zod schemas for Supabase query results live in `src/lib/supabase/schemas.ts`.
**When:** Any Supabase query with joins or complex return types.
**Rule:** Define the schema once, import everywhere. Schema mirrors the `.select()` shape, not the full table shape. Use `.nullable()` and `.optional()` generously -- Supabase joins return nulls.

### Pattern 5: Test File Co-location
**What:** Component tests live next to their component as `*.test.tsx`.
**When:** Adding tests for any component.
**Rule:** `src/components/charts/top-movers.tsx` -> `src/components/charts/top-movers.test.tsx`. E2E tests live in `e2e/` directory, organized by user flow (not by component).

## Anti-Patterns to Avoid

### Anti-Pattern 1: Duplicate Error Tracking
**What:** Calling both `Sentry.captureException()` AND `systemLog.error()` separately.
**Why bad:** Double reporting, alert fatigue, inconsistent metadata.
**Instead:** Let `handleApiError` handle both. Sentry capture goes inside `handleApiError` once.

### Anti-Pattern 2: SWR for Mutations
**What:** Using `useSWR` for POST/PUT/DELETE operations.
**Why bad:** SWR is designed for GET requests (stale-while-revalidate pattern). Mutations need explicit error handling and success callbacks.
**Instead:** Keep raw `fetch` for mutations. Call `mutate("/api/...")` from SWR to invalidate related caches after successful mutation.

### Anti-Pattern 3: Zod Schemas Matching Full Table Types
**What:** Creating Zod schemas that mirror every column in `database.ts` types.
**Why bad:** Maintenance burden, schemas drift from actual queries, false validation failures.
**Instead:** Schema should match the `.select()` clause -- only validate what you actually query. Use `z.passthrough()` for schemas that may grow.

### Anti-Pattern 4: Testing Server Components with RTL
**What:** Trying to render async Server Components in Vitest with React Testing Library.
**Why bad:** RTL/Vitest cannot handle async Server Components (React ecosystem limitation as of 2026).
**Instead:** Test Server Components via Playwright E2E. Test only `"use client"` components with RTL.

### Anti-Pattern 5: PostHog on Server Components
**What:** Trying to use `usePostHog()` hook in Server Components.
**Why bad:** PostHog client hooks only work in Client Components.
**Instead:** Use `posthog-node` via `src/lib/posthog/server.ts` for server-side event tracking.

## Build Order (Dependency-Driven)

The integration order matters because some systems depend on others:

```
Phase 1: Sentry          (no deps, wraps existing handleApiError)
Phase 2: PostHog         (no deps on Sentry, but benefits from Sentry being present)
Phase 3: Zod schemas     (no deps, prepares for safer data flow)
Phase 4: SWR migration   (no deps, but Zod schemas help type the responses)
Phase 5: Component tests (needs Vitest config changes, SWR mocking patterns)
Phase 6: Playwright E2E  (needs running app, benefits from all above being stable)
Phase 7: CI/CD pipeline  (needs all tests defined to run them)
Phase 8: Component decomposition + simplification (benefits from test coverage safety net)
```

**Why this order:**
- Sentry first: immediate production visibility for errors already happening
- PostHog second: analytics start collecting data from day 1 of production
- Zod before SWR: validating API responses makes SWR migration safer
- Tests before CI: CI enforces tests that must already exist
- Decomposition last: test coverage provides safety net for refactoring

## Scalability Considerations

| Concern | Current (100 users) | At 10K users | At 1M users |
|---------|---------------------|--------------|-------------|
| Sentry events | Free tier sufficient | Team plan ($26/mo) | Business plan, sampling needed |
| PostHog events | Free tier (1M events/mo) | Free tier sufficient | Scale plan |
| SWR cache | In-memory per tab | In-memory per tab (no change) | Consider shared cache via service worker |
| Supabase queries | Direct queries | Direct queries + connection pooling | Read replicas, caching layer |
| CI minutes | ~5 min/PR | Same (code size, not user count) | Same |
| E2E test infra | Local + CI | Dedicated test Supabase project | Staging environment |

## Sources

- [Sentry Next.js SDK documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Next.js manual setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [PostHog Next.js App Router integration](https://posthog.com/docs/libraries/next-js)
- [PostHog App Router tutorial](https://posthog.com/tutorials/nextjs-app-directory-analytics)
- [Next.js official Playwright testing guide](https://nextjs.org/docs/app/guides/testing/playwright)
- [Next.js official Vitest testing guide](https://nextjs.org/docs/app/guides/testing/vitest)
- [SWR vs TanStack Query 2025 comparison](https://refine.dev/blog/react-query-vs-tanstack-query-vs-swr-2025/)
- [TanStack Query vs SWR for Next.js 15](https://corner.buka.sh/tanstack-query-vs-swr-a-comprehensive-guide-for-next-js-15-projects/)
- [Supabase TypeScript type generation](https://supabase.com/docs/guides/api/rest/generating-types)
- [supabase-to-zod schema generation](https://github.com/psteinroe/supabase-to-zod)
- [GitHub Actions CI/CD for Next.js 2026](https://tentoftech.com/blog/github-actions-tutorial-2026-automate-your-next-js-deployments/)
- [Next.js CI/CD with GitHub Actions](https://eastondev.com/blog/en/posts/dev/20251220-nextjs-cicd-github-actions/)
