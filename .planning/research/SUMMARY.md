# Research Summary: AI Market Cap v1.1 Production Readiness

**Domain:** Production infrastructure for AI model ranking platform
**Researched:** 2026-03-05
**Overall confidence:** HIGH

## Executive Summary

The v1.1 milestone adds production-readiness infrastructure to an existing Next.js 16 + Supabase application with 394 TypeScript files, 170 passing tests, and clean type-checking. The stack additions are well-understood, mainstream choices with strong Next.js integration.

The core additions are: Sentry for error tracking (v10, first-party Next.js SDK), PostHog for product analytics (client-side only), Playwright for E2E testing, Testing Library for component tests with Vitest, SWR for client-side data fetching, and Zod runtime validation for Supabase joins (extending existing Zod v4 usage). GitHub Actions CI/CD extends the existing cron workflow infrastructure.

No exotic technology is needed. The highest-risk item is the Zod runtime validation work -- not because Zod is risky, but because 56 `as unknown as` casts across 38 files each need a hand-crafted schema matching the exact Supabase `.select()` join shape. This is labor-intensive and error-prone if schemas drift from actual queries.

The lowest-risk items are Sentry and CI -- both are install-and-configure with minimal code changes.

## Key Findings

**Stack:** 3 new production deps (sentry, posthog, swr) + 5 new dev deps (testing-library, playwright, jsdom). No framework changes.
**Architecture:** Provider-wrapper pattern for Sentry + PostHog. Extend existing handleApiError for Sentry integration. SWR hooks replace useEffect+fetch patterns.
**Critical pitfall:** `@testing-library/react` may have peer dependency conflicts with React 19.2.3. Prepare npm overrides.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Observability (Sentry + PostHog)** - Install-and-configure, immediate production value
   - Addresses: Error tracking, product analytics
   - Avoids: Deploying without crash visibility

2. **CI Pipeline** - Single workflow file, protects all subsequent work
   - Addresses: Regression prevention
   - Avoids: Breaking existing 170 tests or type safety during later phases

3. **Zod Runtime Validation** - Highest effort, highest safety impact
   - Addresses: 56 unsafe type casts
   - Avoids: Runtime type mismatches on schema changes

4. **Component Testing Infrastructure** - Setup jsdom + Testing Library
   - Addresses: UI test coverage gap
   - Avoids: Testing decomposed components before infrastructure exists

5. **Component Decomposition + React.memo** - Break down mega-components
   - Addresses: 5 files over 450 lines, re-render performance
   - Avoids: Decomposing before test infrastructure exists to validate

6. **SWR Data Fetching** - Replace client-side fetch patterns
   - Addresses: Stale data, waterfall requests, no caching
   - Avoids: Premature optimization before observability shows bottlenecks

7. **E2E Tests (Playwright)** - Last because highest maintenance cost
   - Addresses: Integration test coverage for critical paths
   - Avoids: Flaky test debt from writing E2E before app is stable

8. **Code Simplification** - Final pass after all changes
   - Addresses: Accumulated complexity
   - Avoids: Simplifying code that's about to change

**Phase ordering rationale:**
- Observability first because all subsequent work benefits from error visibility
- CI second because it gates quality for all subsequent PRs
- Zod before component work because schema validation is foundational safety
- Component infrastructure before decomposition so decomposed components can be tested immediately
- SWR after decomposition because smaller components are easier to refactor to SWR hooks
- E2E last because it tests the finished product

**Research flags for phases:**
- Phase 4 (Component Testing): May need deeper research on React 19 + Testing Library compatibility
- Phase 6 (SWR): Standard patterns, unlikely to need research
- Phase 7 (Playwright): May need research on auth mocking strategy for Supabase

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries are mainstream with official Next.js docs |
| Features | HIGH | Clear scope from PROJECT.md, no ambiguity |
| Architecture | HIGH | Provider pattern, hook pattern -- well-documented |
| Pitfalls | MEDIUM | React 19 peer dep situation needs verification at install time |

## Gaps to Address

- `@testing-library/react` React 19 peer dependency: verify at install time, prepare overrides
- Supabase auth mocking for Playwright E2E tests: needs phase-specific research
- PostHog CSP integration: exact domains need verification against PostHog docs
- Sentry source map upload in Coolify Docker builds: may need `SENTRY_AUTH_TOKEN` in Coolify build env
