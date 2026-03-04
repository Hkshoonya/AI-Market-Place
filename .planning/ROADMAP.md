# Roadmap: AI Market Cap — Codebase Health (v1.0)

## Overview

This milestone eliminates structural complexity accumulated during rapid feature development. 27 data adapters, 4 ranking calculators, and multiple monolithic components are decomposed and deduplicated. The work follows a dependency-ordered path: externalize magic constants first, then simplify scoring logic, then decompose API routes and adapters, then fix types (which are easier to fix once structure is clean), then standardize error handling and logging, and finally add regression test coverage that locks in the refactored behavior.

## Phases

**Phase Numbering:**
- Integer phases (1–8): Planned milestone work
- Decimal phases: Urgent insertions via `/gsd:insert-phase`

- [x] **Phase 1: Test Infrastructure + Constants** - Configure Vitest and externalize all magic numbers before any refactoring begins (completed 2026-03-03)
- [ ] **Phase 2: Scoring Simplification** - Decompose quality-calculator and eliminate duplicated branches across all 7 scoring calculators (gap closure in progress)
- [x] **Phase 3: API Route Decomposition** - Split compute-scores and purchase routes into independently testable functions (completed 2026-03-04)
- [x] **Phase 4: Adapter Deduplication** - Extract KNOWN_MODELS, shared factory functions, and reusable syncer to eliminate ~904 lines of duplication (completed 2026-03-04)
- [x] **Phase 5: Component Decomposition** - Break 4 oversized components into focused sub-components and hooks (completed 2026-03-04)
- [ ] **Phase 6: Type Safety** - Replace all `any` types with proper TypeScript types now that structure is clean (gap closure in progress)
- [ ] **Phase 7: Error Handling + Logging** - Standardize error patterns and structured logging across codebase
- [ ] **Phase 8: Regression Testing** - Add unit and integration tests for scoring calculators and decomposed API functions

## Phase Details

### Phase 1: Test Infrastructure + Constants
**Goal**: A working Vitest environment exists and all magic numbers/thresholds are in named constants, creating a safe foundation for all subsequent refactoring
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, CONST-01, CONST-02, CONST-03
**Success Criteria** (what must be TRUE):
  1. `npx vitest run` executes without errors (even with zero test files, the runner starts cleanly)
  2. The market cap formula constants (1300, 1.2, 20) are imported from a config file in all files that use them — no inline literals
  3. Coverage penalty thresholds are defined as lookup table entries, not scattered if/else literals
  4. Provider MAU estimates are in a config file and the usage calculator imports from it
**Plans:** 2/2 plans complete
Plans:
- [x] 01-01-PLAN.md — Set up Vitest + create scoring constants file
- [x] 01-02-PLAN.md — Wire all calculators to import from constants

### Phase 2: Scoring Simplification
**Goal**: All 7 scoring calculators share utility helpers and calculateQualityScore() is decomposed into readable sub-functions under 50 lines each
**Depends on**: Phase 1
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05
**Success Criteria** (what must be TRUE):
  1. A shared `addSignal()` helper and `logNormalizeSignal()` helper exist and are used by all calculators — no duplicated signal blocks
  2. The usage calculator has one code path that handles both open and proprietary models (conditional branches exist, but the duplicated logic blocks are gone)
  3. `calculateQualityScore()` is composed of sub-functions, each under 50 lines, with no sub-function exceeding 4 nesting levels
  4. `computeCommunitySignal()` is a standalone exported function in its own module, no longer embedded in quality-calculator
  5. `npx tsc --noEmit` passes clean after all scoring changes
**Plans:** 3 plans (2 complete, 1 gap closure)
Plans:
- [x] 02-01-PLAN.md — Create shared scoring helpers + wire calculators + unify usage calculator
- [x] 02-02-PLAN.md — Decompose quality-calculator into sub-functions + final verification
- [ ] 02-03-PLAN.md — Gap closure: extract computeCommunitySignal to own module + wire addSignal uniformly

### Phase 3: API Route Decomposition
**Goal**: The compute-scores route and purchase route are split into discrete, named functions that can be called and tested independently
**Depends on**: Phase 2
**Requirements**: API-01, API-02, API-03
**Success Criteria** (what must be TRUE):
  1. The compute-scores route body delegates to three named functions: `fetchInputs()`, `computeAllLenses()`, and `persistResults()` — each importable from a test
  2. The purchase route has distinct `handleGuestCheckout()` and `handleAuthenticatedCheckout()` functions rather than a single branching block
  3. Each decomposed compute-scores function can be imported and called in a Vitest test file without instantiating a Next.js server
  4. `npx tsc --noEmit` passes clean after route decomposition
**Plans:** 2/2 plans complete
Plans:
- [ ] 03-01-PLAN.md — Extract compute-scores pipeline into fetchInputs + computeAllLenses + persistResults
- [ ] 03-02-PLAN.md — Decompose purchase route into handleGuestCheckout + handleAuthenticatedCheckout

### Phase 4: Adapter Deduplication
**Goal**: The ~904 lines of KNOWN_MODELS duplication and the repeated inferCategory/buildRecord patterns across adapters are replaced by shared modules
**Depends on**: Phase 1
**Requirements**: ADAPT-01, ADAPT-02, ADAPT-03, ADAPT-04
**Success Criteria** (what must be TRUE):
  1. KNOWN_MODELS data lives in shared JSON/TS data files; adapter source files contain no inline KNOWN_MODELS blocks
  2. A single `inferCategory()` function with provider-specific keyword maps handles all category inference — no per-adapter reimplementations
  3. All model adapters use a shared `buildRecord()` factory function rather than local implementations
  4. A `createAdapterSyncer()` factory encapsulates the static → scrape → API → upsert pipeline, used by adapters that previously duplicated this flow
  5. `npx tsc --noEmit` passes clean after adapter deduplication
**Plans:** 3/3 plans complete
Plans:
- [ ] 04-01-PLAN.md — Extract KNOWN_MODELS data files + unified KnownModelMeta + shared inferCategory/inferModalities
- [ ] 04-02-PLAN.md — Implement buildRecord() factory + rewire replicate/openrouter/github-trending
- [ ] 04-03-PLAN.md — Create adapter-syncer factory + rewire anthropic/openai/google to slim wrappers

### Phase 5: Component Decomposition
**Goal**: The four components over 500 lines are split into focused sub-components and custom hooks, each with a single clear responsibility
**Depends on**: Phase 1
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04
**Success Criteria** (what must be TRUE):
  1. `auction-detail-content.tsx` delegates to BidHistoryTable, EnglishBidPanel, and DutchBidPanel; timer logic lives in `useAuctionTimer()` hook
  2. `seller-earnings-content.tsx` delegates to BalanceCards, WithdrawalForm, and TransactionTable; data fetching lives in `useEarningsData()` hook
  3. `purchase-button.tsx` delegates to GuestCheckoutForm and WalletDepositPanel; wallet state lives in `useWalletBalance()` hook
  4. `benchmark-heatmap.tsx` delegates to HeatmapGrid; tooltip state lives in `useHeatmapTooltip()` hook
  5. The application builds and all decomposed components render correctly (`next build` passes)
**Plans:** 3/3 plans complete
Plans:
- [ ] 05-01-PLAN.md — Decompose auction-detail-content into sub-components + useAuctionTimer hook
- [ ] 05-02-PLAN.md — Decompose seller-earnings-content into sub-components + useEarningsData hook
- [ ] 05-03-PLAN.md — Decompose purchase-button + benchmark-heatmap into sub-components + hooks

### Phase 6: Type Safety
**Goal**: The `any` type count is reduced from 152 to under 20, with all catch blocks and Supabase joins using properly typed interfaces
**Depends on**: Phase 2, Phase 3, Phase 4, Phase 5
**Requirements**: TYPE-01, TYPE-02, TYPE-03, TYPE-04, TYPE-05
**Success Criteria** (what must be TRUE):
  1. All `catch (err: any)` blocks use `catch (err: unknown)` with explicit type narrowing before accessing properties
  2. All Supabase join query `.map()` calls use typed interfaces instead of `any` — no implicit `any` from untyped join results
  3. Compare-client benchmark and pricing functions have explicit parameter and return types for model data
  4. Admin enrichment operations use typed interfaces for joined row data
  5. `grep -r "any" src/ --include="*.ts" --include="*.tsx" | grep -v "//.*any" | wc -l` reports under 20
**Plans:** 6/7 plans executed
Plans:
- [x] 06-01-PLAN.md — Database type foundation (add Relationships to all tables) + catch block fixes
- [x] 06-02-PLAN.md — Remove supabase-as-any from src/lib/ (adapters, agents, marketplace, utilities)
- [x] 06-03-PLAN.md — Remove supabase-as-any from API routes
- [x] 06-04-PLAN.md — Fix compare-client types + admin enrichment + pages/components
- [x] 06-05-PLAN.md — Final any count verification + remaining cleanup
- [ ] 06-06-PLAN.md — Gap closure: fix any in src/lib/ (marketplace, payments, compute-scores, data-sources)
- [ ] 06-07-PLAN.md — Gap closure: fix any in API routes + admin pages + remove orphaned eslint comments

### Phase 7: Error Handling + Logging
**Goal**: Silent catch blocks are eliminated, all API routes use a consistent ApiError pattern, and all library/route/adapter code uses the structured logger
**Depends on**: Phase 3, Phase 4
**Requirements**: ERR-01, ERR-02, ERR-03, LOG-01, LOG-02, LOG-03
**Success Criteria** (what must be TRUE):
  1. No `.catch(() => {})` or `.catch((_) => {})` silent handlers exist anywhere in the codebase — each has at minimum a structured log call
  2. All API routes return errors via the ApiError class with consistent HTTP status codes and message shapes
  3. All client components surface error state to users with a visible message rather than silently failing
  4. All `console.error` and `console.warn` calls in `src/lib/` are replaced with calls to the structured logger from `logging.ts`
  5. All cron job and adapter log calls use tagged loggers that include a source identifier in every log entry
**Plans**: TBD

### Phase 8: Regression Testing
**Goal**: All 7 scoring calculators have unit tests covering normal, edge, and null cases; the market cap formula has regression tests; decomposed API functions have integration tests
**Depends on**: Phase 2, Phase 3
**Requirements**: TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. `npx vitest run` reports test suites for all 7 calculators with at least 3 test cases each (normal input, edge input, null/missing input)
  2. The market cap formula test suite contains at least 5 known-input/expected-output assertions using real model data snapshots
  3. The decomposed compute-scores functions (`fetchInputs`, `computeAllLenses`, `persistResults`) each have at least one integration test that calls them directly
  4. All tests pass; `npx vitest run` exits with code 0
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

Note: Phase 4 (Adapter Deduplication) depends only on Phase 1 and can run in parallel with Phase 2/3 if desired. Phase 5 (Component Decomposition) also depends only on Phase 1. In practice, execute sequentially to keep the build green at each step.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Test Infrastructure + Constants | 2/2 | Complete   | 2026-03-03 |
| 2. Scoring Simplification | 2/3 | Gap closure | - |
| 3. API Route Decomposition | 2/2 | Complete   | 2026-03-04 |
| 4. Adapter Deduplication | 3/3 | Complete   | 2026-03-04 |
| 5. Component Decomposition | 3/3 | Complete   | 2026-03-04 |
| 6. Type Safety | 6/7 | In Progress|  |
| 7. Error Handling + Logging | 0/TBD | Not started | - |
| 8. Regression Testing | 0/TBD | Not started | - |
