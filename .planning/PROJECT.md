# AI Market Cap

## What This Is

A CoinMarketCap-style ranking platform for AI models. Aggregates data from 27 sources (HuggingFace, OpenAI, Anthropic, Google, Replicate, etc.), computes 4 ranking lenses (Capability, Usage, Expert, Balanced), and generates synthetic market cap valuations. Includes a marketplace for buying/selling AI model access, blockchain payments (Solana, EVM), and autonomous agent infrastructure.

## Core Value

Provide the most comprehensive, multi-lens ranking of AI models so users can discover, compare, and evaluate models from a single source of truth.

## Requirements

### Validated

<!-- Shipped and confirmed working. -->

- ✓ 27 data source adapters with tiered sync (4 tiers, pg_cron scheduled)
- ✓ 4 ranking lenses: Capability, Usage, Expert, Balanced
- ✓ Market cap formula: usageScore^1.2 × log-normalized-price × 1300
- ✓ Marketplace with listings, auctions (English + Dutch), escrow, reviews
- ✓ Blockchain payments: Solana + EVM (Base, Polygon) USDC
- ✓ Stripe payment integration
- ✓ Authentication via Supabase (JWT, RLS, API keys with SHA-256 hashing)
- ✓ Agent infrastructure: MCP server, chat, code quality agent, UX monitor
- ✓ Rate limiting (in-memory sliding window, 5 profiles)
- ✓ Input validation (Zod schemas, sanitize utilities)
- ✓ Admin dashboard with moderation, verification, sync controls
- ✓ Docker deployment config (Hetzner CAX21 + Coolify)

### Active

<!-- Current scope: Codebase Health milestone -->

- [ ] Reduce structural complexity across scoring, adapters, and components
- [ ] Eliminate code duplication (~1,700 lines in adapters, ~200 in scoring)
- [ ] Break down monolithic components (4 files over 500 lines)
- [ ] Replace 152 `any` types with proper TypeScript types
- [ ] Standardize error handling patterns across codebase
- [ ] Adopt structured logging universally
- [ ] Add test coverage for scoring calculators and critical business logic

### Out of Scope

- Performance optimization (React.memo, SWR/React Query) — separate milestone
- Redis-backed rate limiting — separate milestone (scaling)
- WebSocket/real-time updates — separate milestone (UX)
- Email notifications — separate milestone (engagement)
- Audit logging for financial transactions — separate milestone (compliance)

## Context

- **Codebase size:** 394 TypeScript files, 63,961 LOC
- **Build health:** `npx tsc --noEmit` passes clean, zero compilation errors
- **Test coverage:** Zero — no test files, no test framework configured
- **Complexity hotspots:** quality-calculator.ts (35+ branches, 4 nesting levels), compute-scores route (612 lines, 8+ responsibilities), auction-detail-content.tsx (985 lines), model-matcher.ts (7 nesting levels)
- **Duplication:** 904 lines of KNOWN_MODELS blocks repeated across 4 adapters, inferCategory() reimplemented 4 times, buildRecord() pattern in 3+ adapters
- **Domain:** aimarketcap.com
- **Deployment:** Hetzner CAX21 + Coolify + Supabase Cloud (~$32/mo)

## Constraints

- **Tech stack**: Next.js 16 + TypeScript + Supabase + Tailwind — no framework changes
- **Zero behavior change**: All refactoring must preserve existing functionality exactly
- **Build must stay green**: `npx tsc --noEmit` must pass after every phase
- **No new dependencies**: Except Vitest for testing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single milestone for complexity + quality | Natural dependency: structural cleanup enables type safety work | — Pending |
| Vitest over Jest | Faster, better ESM support, native TypeScript | — Pending |
| Complexity before quality | Must decompose monoliths before fixing types within them | — Pending |
| Include testing in this milestone | Scoring calculators are the core product, need regression safety | — Pending |

---
*Last updated: 2026-03-03 after milestone v1.0 initialization*
