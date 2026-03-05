# AI Market Cap

## What This Is

A CoinMarketCap-style ranking platform for AI models. Aggregates data from 27 sources (HuggingFace, OpenAI, Anthropic, Google, Replicate, etc.), computes 4 ranking lenses (Capability, Usage, Expert, Balanced), and generates synthetic market cap valuations. Includes a marketplace for buying/selling AI model access, blockchain payments (Solana, EVM), and autonomous agent infrastructure.

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
- ✓ Component decomposition (auction, seller, purchase, heatmap sub-components) — v1.0
- ✓ Type safety (`any` reduced from 152 to 9, TypedSupabaseClient, catch unknown) — v1.0
- ✓ Structured error handling (handleApiError across 65 routes, zero silent catches) — v1.0
- ✓ Structured logging (createTaggedLogger in 20+ modules) — v1.0
- ✓ Regression test suite (170 tests, 14 files, all 7 calculators covered) — v1.0

### Active

<!-- Next milestone scope — to be defined -->

(None yet — define with `/gsd:new-milestone`)

### Out of Scope

- Performance optimization (React.memo, SWR/React Query) — separate milestone
- Redis-backed rate limiting — separate milestone (scaling)
- WebSocket/real-time updates — separate milestone (UX)
- Email notifications — separate milestone (engagement)
- Audit logging for financial transactions — separate milestone (compliance)

## Context

- **Codebase size:** 394+ TypeScript files, 68,434 LOC
- **Build health:** `npx tsc --noEmit` passes clean, zero compilation errors
- **Test coverage:** 170 tests across 14 files, all passing (Vitest)
- **Error handling:** `handleApiError` in 149 usages across 65 API routes, zero `console.error` in src/lib/ or src/app/api/
- **Type safety:** 9 remaining `any` usages (all justified — library incompatibilities)
- **Domain:** aimarketcap.com
- **Deployment:** Hetzner CAX21 + Coolify + Supabase Cloud (~$32/mo)

## Constraints

- **Tech stack**: Next.js 16 + TypeScript + Supabase + Tailwind — no framework changes
- **Build must stay green**: `npx tsc --noEmit` must pass after every phase
- **170 tests must pass**: `npx vitest run` exit code 0

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single milestone for complexity + quality | Natural dependency: structural cleanup enables type safety work | ✓ Good — all 8 phases completed in 2 days |
| Vitest over Jest | Faster, better ESM support, native TypeScript | ✓ Good — 170 tests in 504ms |
| Two coverage penalty tables | Market-cap uses distinct thresholds from quality/expert | ✓ Good — clear separation |
| Complexity before quality | Must decompose monoliths before fixing types within them | ✓ Good — Phase 6 built on Phase 2-5 decomposition |
| Include testing in this milestone | Scoring calculators are the core product, need regression safety | ✓ Good — 6 market cap regression snapshots catch formula drift |
| createAdapterSyncer factory | Unified pattern for 3 adapters (anthropic, openai, google) | ✓ Good — eliminated ~1,700 lines of duplication |
| handleApiError + createTaggedLogger | Consistent error/logging pattern across all routes | ✓ Good — 149 usages, zero console.error leakage |
| TypedSupabaseClient from database.ts | Single source of truth for Supabase types | ✓ Good — used in 16+ files |

---
*Last updated: 2026-03-05 after v1.0 Codebase Health milestone*
