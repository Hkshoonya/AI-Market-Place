# Domain Pitfalls

**Domain:** Production readiness infrastructure for existing Next.js 16 + Supabase app
**Researched:** 2026-03-05

## Critical Pitfalls

Mistakes that cause rewrites, major performance regressions, or broken deployments.

### Pitfall 1: Sentry Wrapping next.config.ts Breaks Standalone Build

**What goes wrong:** Sentry's `withSentryConfig()` wrapper modifies the webpack config. When combined with `output: "standalone"` (already set for Coolify/Docker deployment), source map uploads can fail or the standalone output structure can break, causing Docker builds to fail silently with missing server files.

**Why it happens:** Sentry injects webpack plugins for source map upload and release management. The standalone build copies a minimal file set to `.next/standalone/`, and Sentry's modifications can interfere with what gets copied. Additionally, the CSP headers in `next.config.ts` already block external scripts -- Sentry's loader script will be blocked by `script-src 'self' 'unsafe-inline'`.

**Consequences:** Docker image builds succeed but app crashes on start. Or errors silently fail to report because CSP blocks the Sentry SDK from sending data.

**Prevention:**
- Add Sentry domains to CSP `connect-src` directive: `https://*.sentry.io https://*.ingest.sentry.io`
- Test Docker build locally after Sentry integration, before merging
- Use `disableServerWebpackPlugin: true` in CI if source maps are uploaded separately
- Verify `output: "standalone"` still works by running `node .next/standalone/server.js` after build

**Detection:** Build succeeds but no errors appear in Sentry dashboard. Or Docker container exits with code 1 on startup.

**Phase:** Observability (first phase -- must validate before other phases depend on error tracking)

**Confidence:** HIGH (verified against Sentry docs and existing next.config.ts)

---

### Pitfall 2: Sentry + PostHog Combined Bundle Bloat (200KB+)

**What goes wrong:** Adding both `@sentry/nextjs` (~70-100KB gzipped) and `posthog-js` (~22KB gzipped, 266KB parsed) to the client bundle adds 200KB+ of parsed JavaScript. For a data-heavy dashboard app with charts (recharts, lightweight-charts, three.js already in bundle), this can push First Contentful Paint past acceptable thresholds.

**Why it happens:** Both libraries initialize eagerly by default. Sentry instruments fetch, console, and DOM events globally. PostHog starts autocapture, session recording, and feature flag polling. Neither tree-shakes well without explicit configuration.

**Consequences:** 1-3 second increase in Time to Interactive on mobile. Lighthouse performance score drops. Users on slower connections (emerging markets) see blank screens longer.

**Prevention:**
- Sentry: Enable tree shaking via `withSentryConfig` options -- disable Session Replay and Browser Profiling unless actively used
- PostHog: Use `posthog-js/react` provider with lazy initialization; defer loading until after hydration
- Both: Use dynamic imports (`next/dynamic`) so neither blocks initial page render
- Measure before/after with `next build` bundle analyzer output

**Detection:** Run `npx @next/bundle-analyzer` before and after integration. Client-side JS should not increase more than 50KB gzipped total.

**Phase:** Observability (must be addressed during integration, not retrofitted)

**Confidence:** HIGH (bundle size concerns well-documented in Sentry GitHub issues #9048, #7680 and PostHog issue #1905)

---

### Pitfall 3: Vitest Config Split -- Component Tests Need jsdom, Existing Tests Need node

**What goes wrong:** The existing 170 tests run in `environment: 'node'` (confirmed in vitest.config.ts). Component tests with Testing Library require `environment: 'jsdom'`. Naively switching the global environment to jsdom breaks the existing scoring/compute tests because jsdom doesn't fully implement Node APIs used in those tests (crypto, fs, Buffer).

**Why it happens:** Vitest only supports one default environment per config. The existing config explicitly sets `environment: 'node'` and includes `src/**/*.test.ts`. Adding `.test.tsx` files for components requires jsdom.

**Consequences:** Either existing 170 tests break (switched to jsdom), or new component tests fail (no DOM APIs in node environment).

**Prevention:**
- Use Vitest's per-file environment annotation: add `// @vitest-environment jsdom` at the top of component test files
- OR use `environmentMatchGlobs` in vitest config: `['src/components/**/*.test.tsx', 'jsdom']`
- Update the include pattern to `['src/**/*.test.{ts,tsx}']`
- Install `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, and `jsdom` as dev dependencies
- Run the full existing test suite FIRST after config changes to verify zero regressions

**Detection:** `npx vitest run` fails with "document is not defined" (node env for component tests) or "crypto.randomUUID is not a function" (jsdom env for scoring tests).

**Phase:** Testing expansion (component tests phase)

**Confidence:** HIGH (verified against existing vitest.config.ts)

---

### Pitfall 4: Async Server Components Cannot Be Unit-Tested with Vitest

**What goes wrong:** Next.js App Router pages are async Server Components. Vitest + React Testing Library cannot render async Server Components -- React's test renderer does not support the `async function Component()` pattern. Developers write component tests for pages, they all fail with cryptic errors.

**Why it happens:** Async Server Components are a React Server Components feature that requires the React server runtime, which is not available in Vitest's jsdom or node environments. This is a known limitation documented by both Next.js and Vitest.

**Consequences:** Wasted time writing tests that cannot work. Confusion about what should be unit-tested vs E2E-tested.

**Prevention:**
- Unit test ONLY Client Components (`"use client"` directive) and pure logic functions with Vitest
- Test Server Components and pages exclusively through Playwright E2E tests
- Extract logic from Server Components into testable pure functions (e.g., data transformation, filtering)
- Document this boundary clearly in a testing strategy guide

**Detection:** Tests fail with "Objects are not valid as a React child (found: [object Promise])" or similar async rendering errors.

**Phase:** Testing expansion (must define testing strategy BEFORE writing tests)

**Confidence:** HIGH (documented in Next.js testing guide and Vitest docs)

---

### Pitfall 5: CI Pipeline That Runs Full E2E on Every PR Commit

**What goes wrong:** E2E tests with Playwright require a running Next.js dev/preview server + potentially a Supabase instance. Running the full suite on every push makes PRs take 10-20 minutes, developers stop waiting for CI, and GitHub Actions costs spike.

**Why it happens:** Copy-pasting CI configs that run everything in sequence. Not separating fast checks (lint, typecheck, unit tests) from slow checks (E2E).

**Consequences:** Developer velocity drops. CI costs increase. Developers push `[skip ci]` or ignore failing checks. The 45-minute build problem (documented in multiple engineering blogs).

**Prevention:**
- Split CI into two workflows:
  1. **Fast gate** (every push): lint + typecheck + vitest unit tests (~2 min)
  2. **Full gate** (PR to main only, or label-triggered): E2E tests (~10 min)
- Cache `node_modules` and `.next` build output between runs
- Use `paths-ignore` to skip CI for docs-only changes
- Start with `npx playwright install --with-deps chromium` (one browser, not all three)

**Detection:** CI takes more than 5 minutes for the fast gate. Developers complain about slow PRs.

**Phase:** CI/CD pipeline

**Confidence:** HIGH (well-documented anti-pattern)

---

### Pitfall 6: Replacing fetch() with SWR/React Query Without Addressing Cache Invalidation

**What goes wrong:** The app has 19+ components using raw `fetch()` in `useEffect`. Wrapping them in `useSWR()` or `useQuery()` seems simple but introduces stale data bugs. The marketplace (auctions with real-time bidding, order status) and leaderboard (score recalculation on cron) have different staleness tolerances. A single default `staleTime` breaks either the marketplace (too stale) or the dashboard (too many refetches).

**Why it happens:** SWR/React Query defaults are designed for general use. SWR refetches on window focus by default. React Query has a 0ms stale time by default (always refetches). Neither default is right for a mixed app with both real-time financial data and slowly-changing leaderboards.

**Consequences:** Marketplace shows stale auction prices. Or leaderboard hammers API with unnecessary refetches every window focus. Or both -- different bugs in different parts of the app.

**Prevention:**
- Define staleness tiers matching the existing cron sync tiers:
  - Tier 1 (auctions, bids): `staleTime: 10_000` (10s), `refetchInterval: 10_000`
  - Tier 2 (leaderboards, scores): `staleTime: 300_000` (5min), `revalidateOnFocus: false`
  - Tier 3 (model metadata, providers): `staleTime: 3_600_000` (1hr)
- Create typed wrapper hooks (`useAuctionData`, `useLeaderboardData`) that encode these tiers
- Migrate incrementally -- one component group at a time, not a big bang replacement
- Keep raw fetch for cron API routes (server-side, no caching needed)

**Detection:** Users report seeing outdated auction prices or bids. API route logs show 10x increase in request volume.

**Phase:** Performance optimization

**Confidence:** HIGH (cache invalidation is the canonical hard problem; the cron tier system already exists for server-side)

## Moderate Pitfalls

### Pitfall 7: CSP Headers Block PostHog and Sentry

**What goes wrong:** The existing `Content-Security-Policy` header in `next.config.ts` has a restrictive `connect-src 'self' https://*.supabase.co wss://*.supabase.co`. PostHog and Sentry both need to send data to external domains. Without CSP updates, both tools silently fail to report -- no errors in console because CSP violations are often swallowed.

**Prevention:**
- Update CSP `connect-src` to include: `https://*.posthog.com https://*.sentry.io https://*.ingest.sentry.io`
- Update CSP `script-src` to include PostHog's script domain if using the snippet loader (or avoid the snippet and use the npm package exclusively)
- Add CSP reporting endpoint to catch future violations
- Test CSP changes in browser DevTools Network tab -- look for blocked requests

**Phase:** Observability (first thing to do when adding either tool)

**Confidence:** HIGH (verified against existing next.config.ts CSP headers)

---

### Pitfall 8: Playwright Tests Depend on Seed Data That Does Not Exist

**What goes wrong:** E2E tests assert on specific model names, prices, or marketplace listings. But the test environment has an empty database. Tests fail not because of bugs but because there's no data.

**Prevention:**
- Create a `playwright/fixtures/seed.sql` file with deterministic test data
- Use Supabase CLI `supabase db reset` + seed in CI before E2E runs
- OR mock API responses with Playwright's `page.route()` for data-independent UI tests
- Never assert on production data values -- assert on structure and behavior

**Phase:** Testing expansion (E2E setup)

**Confidence:** MEDIUM (depends on whether E2E tests use real or mocked Supabase)

---

### Pitfall 9: Zod Schema Drift from Supabase Generated Types

**What goes wrong:** Zod schemas are written manually to validate Supabase query results. The database schema evolves (new columns, renamed fields), but the Zod schemas don't get updated. Now Zod strips the new fields, or worse, validation fails silently and the app shows empty data.

**Prevention:**
- Use `supazod` or similar tool to generate Zod schemas from `supabase gen types` output, keeping them in sync
- OR write a CI check that compares Zod schema keys against the TypeScript types from `database.ts`
- Start Zod validation at API route boundaries (the 65 routes), not inside components
- Use `.passthrough()` on Zod schemas initially to avoid stripping unknown fields during migration

**Detection:** After a database migration, components show missing data or API routes return 500s with Zod validation errors.

**Phase:** Runtime type safety

**Confidence:** MEDIUM (56 `as unknown as` casts identified -- each is a potential Zod migration point)

---

### Pitfall 10: React.memo Applied to Components That Always Re-render Anyway

**What goes wrong:** Developers add `React.memo()` to every component as a "performance optimization." But most components receive new object/array references as props on every render (common with Supabase query results), so memo's shallow comparison always returns false, adding overhead without benefit.

**Prevention:**
- Profile FIRST with React DevTools Profiler to identify actual slow renders
- Only memo components where: (a) they render expensively AND (b) parent re-renders frequently with same props
- Use `useMemo`/`useCallback` in parent to stabilize prop references BEFORE wrapping child in `React.memo`
- Focus memo effort on the chart components (recharts, lightweight-charts, three.js) which are genuinely expensive to re-render

**Phase:** Performance optimization

**Confidence:** HIGH (standard React performance anti-pattern)

---

### Pitfall 11: Playwright Tests Flaky Due to Data Fetching Timing

**What goes wrong:** Tests click a button, immediately assert on the result, but the UI hasn't updated yet because it's waiting for a fetch response. Tests pass locally (fast network) but fail in CI (slower GitHub Actions runner).

**Prevention:**
- Never use `page.waitForTimeout()` -- use `page.waitForResponse()` or `expect(locator).toBeVisible()` with auto-retry
- Use Playwright's built-in auto-waiting: `await expect(page.getByText('Model Name')).toBeVisible()` retries automatically
- Set `actionTimeout` and `navigationTimeout` in playwright.config.ts to reasonable values (10s action, 30s navigation)
- Enable trace collection on CI failures: `trace: 'retain-on-failure'`

**Phase:** Testing expansion (E2E)

**Confidence:** HIGH (most common Playwright mistake per official docs)

---

### Pitfall 12: SWR/React Query DevTools Left in Production Bundle

**What goes wrong:** React Query DevTools (`@tanstack/react-query-devtools`) or SWR DevTools are imported without lazy loading or environment checks. They add 50-100KB to the production bundle and show a floating panel in production.

**Prevention:**
- Use `React.lazy()` with environment check: only import devtools when `process.env.NODE_ENV === 'development'`
- OR use Next.js `dynamic()` with `ssr: false` inside a dev-only wrapper
- Verify with production build: `next build && next start`, check for devtools panel

**Phase:** Performance optimization

**Confidence:** HIGH (trivial to prevent, embarrassing if missed)

## Minor Pitfalls

### Pitfall 13: GitHub Actions Secrets Not Available in Fork PRs

**What goes wrong:** Open-source contributors (or Dependabot) create PRs from forks. GitHub Actions does not expose secrets to fork PRs for security. CI fails because `NEXT_PUBLIC_SUPABASE_URL` is undefined.

**Prevention:**
- Make the fast CI gate (lint, typecheck, unit tests) work WITHOUT any secrets
- Use mock/stub Supabase clients in tests instead of real connections
- Document which CI jobs require secrets and which don't

**Phase:** CI/CD pipeline

**Confidence:** MEDIUM (relevant if the repo ever accepts external contributions)

---

### Pitfall 14: PostHog Autocapture Creates Noise in Analytics

**What goes wrong:** PostHog's autocapture feature captures every click, input change, and page view. For a data-dense dashboard with tables, charts, and frequent interactions, this generates thousands of events per session, making analytics data noisy and hard to analyze.

**Prevention:**
- Disable autocapture initially: `autocapture: false` in PostHog init
- Define explicit events for key user journeys: model comparison, marketplace purchase, watchlist creation
- Enable autocapture selectively later once you know what questions to answer

**Phase:** Observability

**Confidence:** MEDIUM (depends on analytics goals)

---

### Pitfall 15: Component Tests Mock Too Much or Too Little

**What goes wrong:** Component tests mock every dependency (Supabase client, router, context providers), making tests fragile and testing mock behavior rather than real behavior. Or tests mock nothing and fail because jsdom doesn't have `window.matchMedia`, `IntersectionObserver`, or Supabase auth.

**Prevention:**
- Create a shared test utilities file with standard mocks: Supabase client, Next.js router, auth context
- Use `@testing-library/user-event` instead of `fireEvent` for realistic interactions
- Mock at the API boundary (MSW or fetch mocking), not at the component dependency level
- Start with simple components (UI components, forms) before tackling complex ones (charts, marketplace flows)

**Phase:** Testing expansion (component tests)

**Confidence:** HIGH (universal testing challenge)

---

### Pitfall 16: Forgetting to Instrument API Routes with Sentry

**What goes wrong:** Sentry auto-instruments pages and client-side errors, but API Route Handlers in the App Router need explicit wrapping. The 65 API routes each need `Sentry.withSentryConfig()` or the `onRequestError` hook. Without this, server-side errors in cron jobs, marketplace transactions, and blockchain webhooks go unreported.

**Prevention:**
- Use the `instrumentation.ts` file (Next.js instrumentation hook) to set up Sentry server-side globally
- Use `Sentry.captureException()` inside the existing `handleApiError` utility (single integration point for all 65 routes)
- Verify server-side errors appear in Sentry by triggering a test error in a non-critical route

**Detection:** Client errors appear in Sentry but server errors don't.

**Phase:** Observability

**Confidence:** HIGH (the existing `handleApiError` pattern makes this straightforward -- it's the natural integration point)

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Observability (Sentry) | CSP blocks Sentry/PostHog network requests | Update CSP headers FIRST before any SDK integration |
| Observability (Sentry) | Bundle bloat from both SDKs | Tree-shake Sentry, lazy-load PostHog, measure with bundle analyzer |
| Observability (Sentry) | Server errors not captured in API routes | Integrate Sentry.captureException into existing handleApiError utility |
| Testing (Component) | Vitest environment conflict (node vs jsdom) | Use environmentMatchGlobs or per-file annotations |
| Testing (Component) | Trying to test async Server Components | Only unit-test Client Components; use Playwright for pages |
| Testing (E2E) | Flaky tests from timing issues | Use Playwright auto-waiting, never waitForTimeout |
| Testing (E2E) | No test data in CI environment | Seed data fixtures or mock API responses |
| CI/CD | Slow pipeline kills developer velocity | Split into fast gate (2min) and full gate (10min) |
| CI/CD | Secrets unavailable in fork PRs | Design fast gate to work without secrets |
| Performance (SWR/RQ) | Wrong staleness defaults for mixed-use app | Define staleness tiers matching existing cron sync tiers |
| Performance (memo) | Premature React.memo without profiling | Profile first, memo only expensive components with stable props |
| Runtime types (Zod) | Schema drift from database changes | Generate or cross-check Zod schemas against database.ts types |
| Component decomp | N/A -- lower risk, already practiced in v1.0 | Follow existing decomposition patterns from v1.0 |

## Integration Pitfalls (Cross-Cutting)

### Sentry + handleApiError Integration Order

The existing `handleApiError` utility (149 usages across 65 routes) is the single best integration point for Sentry server-side error tracking. Adding `Sentry.captureException(error)` inside `handleApiError` immediately instruments all 65 API routes. However, this must happen BEFORE adding Zod validation to those routes, because Zod validation errors (expected, user-facing) should NOT be sent to Sentry. Add error classification to `handleApiError` first.

### SWR/React Query + PostHog Event Tracking

If PostHog tracks data-fetching patterns (cache hit/miss, refetch frequency), it can generate massive event volumes. Keep PostHog tracking at the user-action level (clicked, searched, purchased), not at the data-fetching level.

### Playwright + CI + Supabase

E2E tests that hit real Supabase need a test project or local Supabase (via CLI). Using the production Supabase in CI is a security risk (exposes real data) and reliability risk (rate limits, data mutations). Use `supabase start` in CI for a local Postgres instance, or mock API responses entirely.

## Sources

- [Sentry Next.js Manual Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [Sentry Tree Shaking](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/tree-shaking/)
- [Sentry Build Options](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/build/)
- [Sentry Bundle Size Discussion #9048](https://github.com/getsentry/sentry-javascript/discussions/9048)
- [PostHog Next.js Docs](https://posthog.com/docs/libraries/next-js)
- [PostHog Bundle Size Issue #1905](https://github.com/PostHog/posthog-js/issues/1905)
- [Next.js Testing with Vitest](https://nextjs.org/docs/app/guides/testing/vitest)
- [Next.js Testing with Playwright](https://nextjs.org/docs/app/guides/testing/playwright)
- [Prevent Flaky Tests with Playwright](https://dev.to/spo0q/prevent-flaky-tests-with-playwright-l2k)
- [Supabase CI Testing Docs](https://supabase.com/docs/guides/deployment/ci/testing)
- [supazod - Generate Zod from Supabase Types](https://github.com/dohooo/supazod)
