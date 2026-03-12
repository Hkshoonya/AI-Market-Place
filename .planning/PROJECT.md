# AI Market Cap

## What This Is

A CoinMarketCap-style ranking platform for AI models. Aggregates data from 27 sources (HuggingFace, OpenAI, Anthropic, Google, Replicate, etc.), computes 4 ranking lenses (Capability, Usage, Expert, Balanced), and generates synthetic market cap valuations. Includes a marketplace for buying/selling AI model access, blockchain payments (Solana, EVM), and autonomous agent infrastructure. Production-hardened with observability, CI/CD, runtime validation, and E2E testing.

## Core Value

Provide the most comprehensive, multi-lens ranking of AI models so users can discover, compare, and evaluate models from a single source of truth.

## Requirements

### Validated

- ✓ 27 data source adapters with tiered sync (4 tiers, pg_cron scheduled)
- ✓ 4 ranking lenses: Capability, Usage, Expert, Balanced
- ✓ Market cap formula: usageScore^1.2 x log-normalized-price x 1300
- ✓ Marketplace with listings, auctions (English + Dutch), escrow, reviews
- ✓ Blockchain payments: Solana + EVM (Base, Polygon) USDC
- ✓ Stripe payment integration
- ✓ Authentication via Supabase (JWT, RLS, API keys with SHA-256 hashing)
- ✓ Agent infrastructure: MCP server, chat, code quality agent, UX monitor
- ✓ Rate limiting (in-memory sliding window, 5 profiles)
- ✓ Input validation (Zod schemas, sanitize utilities)
- ✓ Admin dashboard with moderation, verification, sync controls
- ✓ Docker deployment config (Hetzner CAX21 + Coolify)
- ✓ Shared scoring helpers (`addSignal`, `logNormalizeSignal`, coverage penalty tables) — v1.0
- ✓ Decomposed compute-scores pipeline (fetchInputs, computeAllLenses, persistResults) — v1.0
- ✓ Adapter deduplication (createAdapterSyncer, buildRecord, inferCategory factories) — v1.0
- ✓ Component decomposition (all mega-components below 300 lines) — v1.0 + v1.1
- ✓ Type safety (`any` reduced from 152 to 9, TypedSupabaseClient, catch unknown) — v1.0
- ✓ Structured error handling (handleApiError across 65 routes, zero silent catches) — v1.0
- ✓ Structured logging (createTaggedLogger in 20+ modules) — v1.0
- ✓ Regression test suite (222 tests, all passing) — v1.0 + v1.1
- ✓ Sentry error tracking + PostHog product analytics with optimized bundle — v1.1
- ✓ GitHub Actions CI pipeline (lint, typecheck, test, E2E) with zero-warning gate — v1.1
- ✓ Zod runtime validation replacing all unsafe type casts at query boundaries — v1.1
- ✓ Component tests (Vitest + Testing Library) for 5+ high-value interactive components — v1.1
- ✓ Playwright E2E tests for 4 critical user journeys (auth, model detail, leaderboard, marketplace) — v1.1
- ✓ SWR data fetching with tiered revalidation across 44 client components — v1.1
- ✓ React.memo on expensive pure components (ComparisonRow, ScoreBar) — v1.1
- ✓ Code simplification: zero ESLint warnings, zero dead code — v1.1

### Active

## Current Milestone: v1.2 Data Pipeline & Launch

**Goal:** Fix the broken data sync pipeline, make sync failures visible to admins, and deploy the app to Railway + Supabase Cloud for production launch.

**Target features:**
- Seed and validate data_sources table so adapters actually run
- Fix silent failure modes across all 27 adapters (fail-fast on missing keys, escalate errors)
- Admin dashboard shows sync job status, failures, stale sources, and pipeline health
- Deploy to Railway with all env vars configured, node-cron for scheduling
- DNS + SSL for aimarketcap.com via Cloudflare
- End-to-end verification that data flows from adapters → DB → UI

### Out of Scope

- WebSocket/real-time updates — separate milestone (UX)
- Email notifications — separate milestone (engagement)
- Audit logging for financial transactions — separate milestone (compliance)
- Redis caching — Next.js built-in sufficient for current scale
- Full component test coverage — diminishing returns; focused on high-value components
- E2E for admin flows — low user impact; admin is internal-only

## Context

- **Codebase size:** 394+ TypeScript files, 71,065 LOC
- **Build health:** `npx tsc --noEmit` passes clean, `npm run lint` zero warnings
- **Test coverage:** 222 unit/component tests + 18 E2E tests, all passing
- **Error handling:** `handleApiError` in 149 usages across 65 API routes
- **Runtime validation:** Zod schemas at 62 query boundary call sites across 33 files
- **Type safety:** 9 remaining `any` usages (all justified — library incompatibilities)
- **Observability:** Sentry error tracking (errors-only, no tracing), PostHog analytics (6 custom events)
- **CI/CD:** GitHub Actions — lint, typecheck, test, E2E on every PR; `--max-warnings 0`
- **Domain:** aimarketcap.tech
- **Deployment:** Hetzner CAX21 + Coolify + Supabase Cloud (~$32/mo)

## Constraints

- **Tech stack**: Next.js 16 + TypeScript + Supabase + Tailwind — no framework changes
- **Build must stay green**: `npx tsc --noEmit` must pass after every change
- **222 tests must pass**: `npx vitest run` exit code 0
- **18 E2E tests must pass**: `npx playwright test` exit code 0
- **Zero ESLint warnings**: `npm run lint` (includes `--max-warnings 0`)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single milestone for complexity + quality | Natural dependency: structural cleanup enables type safety work | ✓ Good — all 8 v1.0 phases completed in 2 days |
| Vitest over Jest | Faster, better ESM support, native TypeScript | ✓ Good — 222 tests in <2s |
| Two coverage penalty tables | Market-cap uses distinct thresholds from quality/expert | ✓ Good — clear separation |
| createAdapterSyncer factory | Unified pattern for 3 adapters (anthropic, openai, google) | ✓ Good — eliminated ~1,700 lines |
| handleApiError + createTaggedLogger | Consistent error/logging pattern across all routes | ✓ Good — 149 usages |
| Sentry errors-only mode | tracesSampleRate=0, no replay to minimize bundle (<50KB) | ✓ Good — error capture without performance overhead |
| PostHog manual pageview | capture_pageview: false for App Router compatibility | ✓ Good — works with RSC |
| Zod parseQueryResult pattern | Wraps Supabase {data,error} + z.array().safeParse() + Sentry reporting | ✓ Good — 62 call sites |
| SWR over React Query | Simpler API, smaller bundle, sufficient for current needs | ✓ Good — 44 components converted |
| MSW in instrumentation.ts | Server-side interception for RSC E2E testing | ✓ Good — model detail tests pass in CI |
| CICD-04 accept-limitation | GitHub Free + private repo returns HTTP 403 on branch protection | ⚠️ Revisit — upgrade to Pro or make public |

---
*Last updated: 2026-03-11 after v1.2 Data Pipeline & Launch milestone started*
