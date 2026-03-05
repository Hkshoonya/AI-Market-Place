# Technology Stack

**Project:** AI Market Cap v1.1 Production Readiness
**Researched:** 2026-03-05

## Existing Stack (DO NOT change)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.6 | App framework |
| React | 19.2.3 | UI library |
| TypeScript | ^5 | Type safety |
| Supabase | ^2.98.0 | Database, auth, RLS |
| Tailwind CSS | ^4.0.7 | Styling |
| Vitest | ^4.0.18 | Unit/integration tests (170 existing) |
| Zod | ^4.3.6 | Input validation (already in 10+ API routes) |
| ESLint | ^9 | Linting |

## Recommended New Additions

### Observability

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@sentry/nextjs` | ^10 | Error tracking, performance monitoring | First-party Next.js SDK with automatic route instrumentation, server/client/edge coverage. The only serious option for production error tracking in Next.js -- alternatives (Bugsnag, Rollbar) have weaker Next.js integration. Free tier covers 5K errors/month, sufficient for launch. |
| `posthog-js` | ^1.357 | Product analytics, session replay | Self-hostable (aligns with Hetzner deployment), generous free tier (1M events/month). Better than Google Analytics for product decisions because it tracks feature usage, funnels, and user paths. Lighter than Amplitude/Mixpanel which are overkill for this stage. Uses `instrumentation-client.ts` on Next.js 15.3+ for fast init. |

**Confidence:** HIGH -- both are the standard choices for Next.js production apps. Sentry docs explicitly cover Next.js 16. PostHog has first-party Next.js docs.

### E2E Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@playwright/test` | ^1.58 | End-to-end browser testing | Next.js official docs recommend Playwright over Cypress. Built-in auto-wait, cross-browser support, faster execution. The `webServer` config auto-starts `next dev` before tests. Existing Vitest handles unit tests; Playwright handles user-flow tests. |

**Confidence:** HIGH -- Next.js official testing guide recommends Playwright. Version 1.58 is current.

### Component Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@testing-library/react` | ^16 | Component render testing with Vitest | Standard for testing React components by user behavior rather than implementation. Works with Vitest via `jsdom` or `happy-dom` environment. |
| `@testing-library/jest-dom` | ^6 | Custom DOM matchers (toBeInTheDocument, etc.) | Provides readable assertions for DOM state. Works with Vitest despite the "jest" name. |
| `@testing-library/user-event` | ^14 | Simulating user interactions | More realistic than `fireEvent` -- simulates actual browser event sequences (click, type, etc.). |
| `jsdom` | ^26 | DOM environment for Vitest component tests | Required by Vitest to render React components in Node.js. Lighter than `happy-dom` and more battle-tested. |

**Confidence:** MEDIUM -- `@testing-library/react` v16 has React 19 peer dependency concerns. The library works with React 19 but may require `--legacy-peer-deps` or npm overrides. Multiple sources confirm it works in practice, but the peer dependency declaration may lag. Verify at install time. If peer dep conflict occurs, add `"overrides": { "@testing-library/react": { "react": "$react" } }` to package.json.

### Data Fetching

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `swr` | ^2 | Client-side data fetching with caching | Use SWR over TanStack React Query because: (1) 4.2KB vs 13.4KB bundle -- matters for a public-facing ranking site where every KB counts for Core Web Vitals; (2) Vercel/Next.js first-party library -- zero SSR/app-router friction; (3) simpler API for the use case (fetch + cache + revalidate); (4) this project does NOT need React Query's advanced features (mutations with optimistic updates, infinite queries, devtools) because writes go through API routes with Supabase, not client-side mutations. The project's existing pattern of server components + API routes means SWR only needs to handle client-side polling/revalidation for dynamic data (market tickers, leaderboard live updates). |

**Confidence:** HIGH -- SWR is the right choice for this project's read-heavy, server-component-first architecture. React Query would be better if this were a CRUD-heavy SPA.

### CI/CD

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GitHub Actions | N/A (service) | CI pipeline for PRs | Already used for cron-sync.yml. Extending to CI is zero new infrastructure. Free for public repos, 2000 min/month for private. |

No new npm packages needed -- GitHub Actions uses YAML workflow definitions.

### Runtime Validation (Zod for Supabase joins)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `zod` | ^4.3.6 (already installed) | Runtime validation of Supabase query results | Already in the project for API input validation. Extend usage to validate Supabase join results, replacing 56 `as unknown as` casts across 38 files. No new dependency needed. |

**No new package.** Zod 4 is already installed. The work is writing schemas for Supabase join shapes and using `z.parse()` / `z.safeParse()` on query results instead of type assertions.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Error tracking | Sentry | Bugsnag, Rollbar | Weaker Next.js integration, smaller community, no first-party SDK |
| Analytics | PostHog | Google Analytics, Amplitude | GA lacks product analytics (funnels, feature flags); Amplitude expensive at scale |
| E2E testing | Playwright | Cypress | Cypress slower, no native multi-tab support, heavier runtime, not recommended by Next.js docs |
| Component testing | Testing Library | Enzyme | Enzyme is dead (no React 18/19 support). Testing Library is the React ecosystem standard |
| Data fetching | SWR | TanStack React Query | 3x bundle size, unnecessary complexity for read-heavy use case. React Query shines for mutation-heavy SPAs |
| Data fetching | SWR | No library (raw fetch) | Loses deduplication, caching, revalidation, error retry -- all needed for live data displays |
| CI/CD | GitHub Actions | CircleCI, GitLab CI | Already using GitHub Actions for crons; adding another CI tool adds unnecessary complexity |
| Runtime validation | Zod (existing) | supazod, supabase-to-zod | These generate Zod schemas from Supabase types automatically, but Zod 4 compatibility is uncertain and hand-written schemas for join results are more precise for the 56 specific casts |

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| `posthog-node` (server SDK) | Not needed initially. `posthog-js` client SDK covers product analytics. Add server SDK only if you need server-side event tracking (e.g., cron job telemetry). |
| `@sentry/profiling-node` | Profiling is overkill at this stage. Basic error tracking + performance traces are sufficient. |
| Datadog / New Relic | Enterprise-grade APM. Way too expensive and complex for a $32/mo Hetzner deployment. |
| React Query DevTools | Not using React Query. |
| `msw` (Mock Service Worker) | Tempting for API mocking in tests, but adds complexity. Vitest's `vi.mock()` and manual mocks are sufficient for the existing test patterns. Revisit if API integration tests become painful. |
| `happy-dom` | Alternative to jsdom. Faster but less compatible. jsdom is more battle-tested with Testing Library. |
| `supabase-to-zod` / `supazod` | Auto-generates Zod schemas from Supabase types. Zod 4 support is uncertain (LOW confidence), and the 56 casts are for specific join shapes that benefit from hand-crafted schemas matching exact query select patterns. |

## Installation

```bash
# Observability
npm install @sentry/nextjs posthog-js

# Component testing (dev only)
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# E2E testing (dev only)
npm install -D @playwright/test
npx playwright install --with-deps chromium  # Only Chromium needed for CI

# Data fetching
npm install swr
```

**Total new dependencies:** 3 production, 5 dev

## Integration Points

### Sentry Integration
- **next.config.ts**: Wrap with `withSentryConfig()` -- this is the main integration point
- **instrumentation.ts**: Server-side Sentry init (Next.js instrumentation hook)
- **instrumentation-client.ts**: Client-side Sentry init
- **CSP update**: Add `*.sentry.io` to `connect-src` and `script-src` in next.config.ts headers
- **handleApiError**: Extend existing error handler to call `Sentry.captureException()` -- single integration point for all 65 API routes
- **Source maps**: `withSentryConfig` handles upload automatically during build

### PostHog Integration
- **providers.tsx**: Create PostHog provider component with `'use client'` directive
- **layout.tsx**: Wrap app with PostHogProvider
- **CSP update**: Add `*.posthog.com` or `us.i.posthog.com` to `connect-src`
- **Environment variables**: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`

### Vitest Component Testing
- **vitest.config.ts**: Add second test project config with `environment: 'jsdom'` for component tests (keep `environment: 'node'` for existing unit tests)
- **test setup file**: Create `src/test/setup-component.ts` with Testing Library matchers import
- **Component test location**: Co-locate as `*.test.tsx` alongside components

### Playwright E2E
- **playwright.config.ts**: New file at project root with `webServer` pointing to `npm run dev`
- **e2e/ directory**: Separate from unit tests (not in src/)
- **package.json scripts**: Add `"test:e2e": "playwright test"`, `"test:e2e:ui": "playwright test --ui"`

### SWR Integration
- **SWR provider**: Optional global `SWRConfig` in layout for default options (revalidateOnFocus, errorRetryCount)
- **Custom hooks**: Create `src/hooks/use-*.ts` hooks wrapping SWR for specific data (leaderboard, model details, market ticker)
- **Existing fetch patterns**: Replace manual `useEffect` + `useState` + `fetch` patterns in client components

### Zod for Supabase Joins
- **Schema location**: `src/lib/supabase/schemas/` directory with schemas per domain (models, marketplace, scores)
- **Pattern**: `const result = ModelWithScoresSchema.parse(data)` instead of `data as unknown as ModelWithScores`
- **Error handling**: Use `safeParse` in API routes (return 500 on validation failure with Sentry alert), use `parse` in server components (let error propagate to error boundary)

### GitHub Actions CI
- **Workflow file**: `.github/workflows/ci.yml`
- **Jobs**: lint, typecheck, unit-tests (parallel), then e2e-tests (sequential, needs build)
- **Caching**: Use `actions/cache` for node_modules and Next.js build cache
- **Branch protection**: Require CI pass before merge to main/feat branches

## Environment Variables Needed

```env
# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx  # For source map upload during build
SENTRY_ORG=your-org
SENTRY_PROJECT=ai-market-cap

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## Sources

- [Sentry Next.js SDK docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/) -- HIGH confidence
- [PostHog Next.js docs](https://posthog.com/docs/libraries/next-js) -- HIGH confidence
- [Next.js Playwright testing guide](https://nextjs.org/docs/app/guides/testing) -- HIGH confidence
- [TanStack Query vs SWR comparison](https://tanstack.com/query/latest/docs/framework/react/comparison) -- HIGH confidence
- [@testing-library/react npm](https://www.npmjs.com/package/@testing-library/react) -- MEDIUM confidence (React 19 peer dep status unclear)
- [@sentry/nextjs npm](https://www.npmjs.com/package/@sentry/nextjs) -- v10.42.0 latest per npm
- [Supazod for Zod/Supabase](https://github.com/dohooo/supazod) -- LOW confidence (Zod 4 compat uncertain)
