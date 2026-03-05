# Feature Landscape

**Domain:** Production readiness infrastructure for Next.js 16 data platform
**Researched:** 2026-03-05

## Table Stakes

Features users (developers/operators) expect. Missing = production feels fragile.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Sentry error tracking | Unhandled errors in 68 API routes + client-side crash silently without it; `handleApiError` logs but doesn't alert | Low | None -- `@sentry/nextjs` wraps existing config | Wizard generates 3 config files + wraps `next.config.ts` with `withSentryConfig` |
| CI lint + typecheck on PRs | Without gatekeeping, `tsc --noEmit` clean status will regress; already have 170 tests but no enforcement | Low | GitHub Actions (already have `.github/workflows/`) | Single workflow: `npm ci` -> `eslint` -> `tsc --noEmit` -> `vitest run` |
| CI test enforcement on PRs | 170 unit tests exist but nothing blocks merging if they fail | Low | CI lint pipeline (same workflow) | Run `vitest run` in CI; already passing in ~504ms |
| Zod runtime validation for Supabase joins | 56 `as unknown as` casts across 38 files; Supabase `.select()` with joins returns `unknown` at runtime regardless of generated types | Med | Zod v4 already installed | Pattern: define Zod schema per query shape, parse result, infer type from schema |
| React.memo on expensive list items | Leaderboard table re-renders 100+ model cards on every parent state change (sort, filter); chart components re-render on unrelated state | Low | None -- React built-in | Wrap `ModelCard`, chart components, `ListingCard`; combine with `useMemo` for derived data |
| Client-side data fetching with SWR | Zero client-side caching today; every `useState`+`useEffect`+`fetch` pattern means waterfall requests, no deduplication, no stale-while-revalidate | Med | New dependency: `swr` | SWR over TanStack Query because: lighter bundle (~4KB vs ~13KB), Vercel-maintained so better Next.js integration, project doesn't need mutations/optimistic updates |

## Differentiators

Features that elevate production quality beyond baseline. Not expected but valued.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| PostHog product analytics | Know which models users view, which lenses they prefer, marketplace conversion funnel; actual product intelligence vs just error tracking | Low | New dependency: `posthog-js` | Client-side only via `PostHogProvider`; free tier generous (1M events/mo) |
| Playwright E2E tests for critical paths | Unit tests cover scoring logic; nothing validates that leaderboard loads, model detail page renders, marketplace purchase flow works end-to-end | High | New dependencies: `@playwright/test`; needs `next build` + `next start` in CI | Start with 5-8 critical path tests, not comprehensive coverage |
| Component tests (Vitest + Testing Library) | Bridge gap between unit tests (pure logic) and E2E (full browser); validate component rendering, user interactions without browser overhead | Med | New dependencies: `@testing-library/react`, `@testing-library/dom`, `jsdom` | Vitest already configured; add `jsdom` environment for component tests |
| Session replay (Sentry) | See exactly what users did before an error; eliminates "cannot reproduce" debugging | Low | Included in `@sentry/nextjs` | `Sentry.replayIntegration()` -- set low sample rate (0.1) to control costs |
| Component decomposition of remaining mega-files | `ranking-weight-controls.tsx` (517 lines), `rank-timeline.tsx` (500 lines), `search-dialog.tsx` (485 lines), `models-filter-bar.tsx` (470 lines), `models/[slug]/page.tsx` (878 lines) | Med | None | Extract sub-components; enables targeted React.memo and targeted component testing |
| Code simplification pass | Reduce cognitive load across 394 files; identify redundant abstractions, over-engineered patterns, dead code | Med | Component decomposition should happen first | Review after all other changes; simplify what emerged as over-built |

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full test coverage (>80% target) | Diminishing returns; 170 tests cover the scoring core which IS the product; chasing coverage % leads to brittle snapshot tests of UI | Add targeted component tests for complex interactive components only; add E2E for critical user journeys |
| TanStack Query instead of SWR | Heavier bundle, mutation framework unnecessary (Supabase handles writes via RPC/server actions), devtools add complexity | Use SWR for client-side GET caching; keep server-side Supabase calls as-is |
| DataDog / New Relic APM | Expensive, overkill for $32/mo Hetzner deployment; Sentry performance monitoring covers 80% of the need | Sentry `tracesSampleRate` provides transaction-level performance data |
| Comprehensive Playwright test suite (50+ tests) | E2E tests are slow, flaky, expensive to maintain; at this scale (one developer) the maintenance cost exceeds the value | Write 5-8 tests for critical paths: homepage load, model detail, leaderboard sorting, marketplace listing, auth flow |
| Custom error boundary components everywhere | Next.js `error.tsx` convention already handles route-level errors; Sentry captures unhandled errors globally | Use `error.tsx` at route group level + Sentry global handler; custom boundaries only for isolated widget failures |
| GraphQL layer over Supabase | Adds unnecessary indirection; Supabase PostgREST is sufficient; Zod validation at query boundaries achieves the same type safety | Zod schemas at Supabase query sites replace `as unknown as` casts directly |
| Storybook for component development | Overhead of maintaining stories for 90+ components; not justified for a solo/small team project | Component tests with Testing Library validate rendering without Storybook infrastructure |
| Redis caching layer | Already out of scope per PROJECT.md; Next.js built-in caching sufficient at current scale | SWR handles client-side caching; Next.js fetch cache + `revalidate` handles server-side |

## Feature Dependencies

```
Sentry setup          --> Session replay (replay is a Sentry integration)
Sentry setup          --> CI pipeline (Sentry source maps upload in build step)
CI lint/typecheck     --> CI test enforcement (same workflow, sequential jobs)
CI test enforcement   --> Playwright E2E in CI (E2E runs after unit tests pass)
jsdom + Testing Lib   --> Component tests (need DOM environment)
Component decomposition --> React.memo optimization (memo smaller components, not monoliths)
Component decomposition --> Component tests (test extracted sub-components individually)
Zod schemas           --> Remove `as unknown as` casts (Zod parse replaces cast)
SWR setup             --> Client-side performance (caching, deduplication, revalidation)
```

## MVP Recommendation

Prioritize in this order:

1. **Sentry error tracking** -- Immediate production value; know when things break. Low effort, high payoff. Install, configure, ship.
2. **CI pipeline (lint + typecheck + test)** -- Protect existing 170 tests and clean `tsc` status. One GitHub Actions workflow file. Non-negotiable for production.
3. **Zod runtime validation** -- 56 `as unknown as` casts are latent runtime bugs. Zod v4 already in `package.json`. Define schemas progressively, starting with most-used queries.
4. **SWR for client-side fetching** -- Replace `useState`+`useEffect`+`fetch` patterns with cached, deduplicated fetching. Improves perceived performance immediately.
5. **React.memo + useMemo** -- After SWR reduces unnecessary fetches, memo prevents unnecessary re-renders in list/chart components.
6. **PostHog analytics** -- Product intelligence. Low effort to install; high value for understanding user behavior.
7. **Component decomposition** -- Break down 5 remaining 450+ line files. Enables better testing and memoization.
8. **Component tests (Vitest + Testing Library)** -- Test interactive components (search dialog, filter bar, ranking controls) after they're decomposed.
9. **Playwright E2E** -- Last because highest setup cost and maintenance burden. 5-8 tests for critical paths only.
10. **Code simplification pass** -- Final sweep after everything else is stable.

Defer: **Session replay** -- enable after Sentry is running and you've seen error patterns worth replaying. Trivial to turn on later.

## Complexity Assessment by Area

| Area | Setup Complexity | Maintenance Burden | Risk |
|------|-----------------|-------------------|------|
| Sentry | Low (wizard-driven) | Low (runs passively) | Low |
| PostHog | Low (provider + script) | Low (event tracking is additive) | Low |
| CI pipeline | Low (single YAML file) | Low (rarely changes) | Low |
| SWR migration | Med (touch many components) | Low (SWR API is stable) | Med -- must not break SSR/ISR pages |
| Zod schemas | Med (38 files to update) | Low (schemas co-located with queries) | Low -- additive, doesn't break existing |
| React.memo | Low (wrap + measure) | Low | Low -- worst case is no performance change |
| Component decomposition | Med (careful extraction) | Low (smaller files = easier maintenance) | Med -- must preserve functionality exactly |
| Component tests | Med (new test infrastructure) | Med (tests break when UI changes) | Low |
| Playwright E2E | High (browser setup, CI config, fixture management) | High (flaky tests, slow CI) | Med -- can become a maintenance drag |
| Code simplification | Med (judgment calls) | Low (one-time pass) | Med -- risk of breaking things while "simplifying" |

## Existing Infrastructure to Build On

| What Exists | How New Features Use It |
|-------------|------------------------|
| 170 Vitest unit tests | CI pipeline runs these; component tests extend same Vitest config |
| `handleApiError` in 65 routes | Sentry captures errors these handlers throw; no need to instrument each route |
| `createTaggedLogger` in 20+ modules | Sentry breadcrumbs supplement structured logging; no replacement needed |
| Zod v4 already installed | Runtime validation schemas use existing dependency; no new install |
| `vitest.config.ts` configured | Component tests add `jsdom` environment; same config file |
| `.github/workflows/cron-sync.yml` | CI workflow is a new file alongside existing workflow; same Actions infrastructure |
| `TypedSupabaseClient` | Zod schemas validate what `TypedSupabaseClient` returns; complementary layers |
| Docker + Coolify deployment | Sentry DSN + PostHog key added as environment variables in Coolify |

## Critical Path Tests (Playwright Scope)

When Playwright is added, these are the 5-8 tests worth writing:

1. **Homepage loads** -- leaderboard table renders with model data
2. **Model detail page** -- navigate to `/models/[slug]`, verify scores/charts render
3. **Leaderboard sorting** -- change lens (Capability/Usage/Expert/Balanced), verify re-sort
4. **Search** -- open search dialog, type query, verify results appear
5. **Marketplace listing** -- browse marketplace, click listing, verify detail page
6. **Auth flow** -- sign in, verify profile page accessible (mock Supabase auth)
7. **Admin dashboard** -- verify admin page loads with data (authenticated)
8. **Compare page** -- select 2 models, verify comparison renders

## Sources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Next.js Manual Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [PostHog Next.js Documentation](https://posthog.com/docs/libraries/next-js)
- [PostHog Next.js Tutorial](https://posthog.com/tutorials/nextjs-analytics)
- [Next.js Testing: Playwright Guide](https://nextjs.org/docs/app/guides/testing/playwright)
- [Next.js Testing: Vitest Guide](https://nextjs.org/docs/app/guides/testing/vitest)
- [TanStack Query vs SWR Comparison 2025](https://refine.dev/blog/react-query-vs-tanstack-query-vs-swr-2025/)
- [SWR vs TanStack Query for Next.js 15](https://corner.buka.sh/tanstack-query-vs-swr-a-comprehensive-guide-for-next-js-15-projects/)
- [supabase-to-zod Generator](https://github.com/psteinroe/supabase-to-zod)
- [Next.js CI/CD with GitHub Actions](https://eastondev.com/blog/en/posts/dev/20251220-nextjs-cicd-github-actions/)
- [Vitest Component Testing Guide](https://vitest.dev/guide/browser/component-testing.html)
- [Playwright E2E Testing Guide 2026](https://www.deviqa.com/blog/guide-to-playwright-end-to-end-testing-in-2025/)
