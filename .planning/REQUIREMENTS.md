# Requirements: AI Market Cap — Codebase Health

**Defined:** 2026-03-03
**Core Value:** Most comprehensive, multi-lens ranking of AI models

## v1.0 Requirements

Requirements for the Codebase Health milestone. Each maps to roadmap phases.

### Scoring Simplification

- [x] **SCORE-01**: Scoring calculators use shared `addSignal()` and `logNormalizeSignal()` helpers instead of duplicated blocks
- [x] **SCORE-02**: Usage calculator has a single code path for open and proprietary models instead of duplicated branches
- [x] **SCORE-03**: Coverage penalty logic uses lookup tables instead of if/else chains across all calculators
- [x] **SCORE-04**: `calculateQualityScore()` is decomposed into sub-functions under 50 lines each
- [x] **SCORE-05**: `computeCommunitySignal()` is extracted as a standalone function from quality-calculator

### API Route Decomposition

- [x] **API-01**: Compute-scores route is split into `fetchInputs()`, `computeAllLenses()`, and `persistResults()` phases
- [x] **API-02**: Purchase route separates guest and authenticated flows into distinct functions
- [x] **API-03**: Each compute-scores phase is independently testable

### Adapter Deduplication

- [x] **ADAPT-01**: KNOWN_MODELS data is extracted from adapter files into shared JSON/TS data files
- [x] **ADAPT-02**: `inferCategory()` logic uses a shared function with provider-specific keyword maps
- [x] **ADAPT-03**: `buildRecord()` pattern is a shared factory function used by all model adapters
- [x] **ADAPT-04**: Adapter sync pipeline has a reusable `createAdapterSyncer()` factory for the static→scrape→API→upsert pattern

### Component Decomposition

- [x] **COMP-01**: `auction-detail-content.tsx` is split into BidHistoryTable, EnglishBidPanel, DutchBidPanel sub-components plus `useAuctionTimer()` hook
- [x] **COMP-02**: `seller-earnings-content.tsx` is split into BalanceCards, WithdrawalForm, TransactionTable sub-components plus `useEarningsData()` hook
- [ ] **COMP-03**: `purchase-button.tsx` is split into GuestCheckoutForm, WalletDepositPanel sub-components plus `useWalletBalance()` hook
- [ ] **COMP-04**: `benchmark-heatmap.tsx` is split into HeatmapGrid sub-component plus `useHeatmapTooltip()` hook

### Type Safety

- [ ] **TYPE-01**: All `catch (err: any)` blocks use `unknown` type with proper narrowing
- [ ] **TYPE-02**: Supabase join `.map()` operations use typed interfaces instead of `any`
- [ ] **TYPE-03**: Compare-client benchmark/pricing functions have proper model types instead of `any`
- [ ] **TYPE-04**: Admin enrichment operations use typed interfaces for joined data
- [ ] **TYPE-05**: Total `any` count is reduced from 152 to under 20

### Error Handling

- [ ] **ERR-01**: Silent `.catch(() => {})` handlers are replaced with proper error logging
- [ ] **ERR-02**: Error handling follows a consistent pattern across all API routes (ApiError class)
- [ ] **ERR-03**: All client components use structured error state with user-facing messages

### Logging

- [ ] **LOG-01**: All `console.error` / `console.warn` calls in src/lib/ use the structured logger from `logging.ts`
- [ ] **LOG-02**: All API routes use structured logging with request context (route, method, duration)
- [ ] **LOG-03**: Cron jobs and adapters use tagged loggers with source identification

### Constants

- [x] **CONST-01**: Market cap formula constants (1300 scale, 1.2 exponent, 20 max price) are named constants in a config file
- [x] **CONST-02**: Coverage penalty thresholds are lookup tables, not inline literals
- [x] **CONST-03**: Provider MAU estimates are externalized to a config file, not hardcoded in calculator source

### Testing

- [x] **TEST-01**: Vitest is configured with TypeScript support and path aliases
- [ ] **TEST-02**: All 7 scoring calculators have unit tests covering normal, edge, and null-input cases
- [ ] **TEST-03**: Market cap formula has regression tests with known model inputs/outputs
- [ ] **TEST-04**: Compute-scores decomposed functions have integration tests

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Performance

- **PERF-01**: React.memo applied to expensive chart components
- **PERF-02**: SWR/React Query for client-side data fetching deduplication
- **PERF-03**: Redis-backed rate limiting for multi-instance deployment

### Frontend Polish

- **UI-01**: Inline styles in chart components replaced with Tailwind classes
- **UI-02**: Missing `key` props added to all `.map()` calls
- **UI-03**: Semantic HTML for data table components (benchmark-heatmap)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New features or functionality | This is a pure refactoring milestone — zero behavior change |
| Database schema changes | Structural cleanup only, no data model modifications |
| Dependency upgrades | Keep versions stable during refactoring |
| Performance optimization | Separate milestone — need profiling data first |
| CI/CD pipeline changes | Separate concern, not codebase health |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 | Complete |
| CONST-01 | Phase 1 | Complete |
| CONST-02 | Phase 1 | Complete |
| CONST-03 | Phase 1 | Complete |
| SCORE-01 | Phase 2 | Complete |
| SCORE-02 | Phase 2 | Complete |
| SCORE-03 | Phase 2 | Complete |
| SCORE-04 | Phase 2 | Complete |
| SCORE-05 | Phase 2 | Complete |
| API-01 | Phase 3 | Complete |
| API-02 | Phase 3 | Complete |
| API-03 | Phase 3 | Complete |
| ADAPT-01 | Phase 4 | Complete |
| ADAPT-02 | Phase 4 | Complete |
| ADAPT-03 | Phase 4 | Complete |
| ADAPT-04 | Phase 4 | Complete |
| COMP-01 | Phase 5 | Complete |
| COMP-02 | Phase 5 | Complete |
| COMP-03 | Phase 5 | Pending |
| COMP-04 | Phase 5 | Pending |
| TYPE-01 | Phase 6 | Pending |
| TYPE-02 | Phase 6 | Pending |
| TYPE-03 | Phase 6 | Pending |
| TYPE-04 | Phase 6 | Pending |
| TYPE-05 | Phase 6 | Pending |
| ERR-01 | Phase 7 | Pending |
| ERR-02 | Phase 7 | Pending |
| ERR-03 | Phase 7 | Pending |
| LOG-01 | Phase 7 | Pending |
| LOG-02 | Phase 7 | Pending |
| LOG-03 | Phase 7 | Pending |
| TEST-02 | Phase 8 | Pending |
| TEST-03 | Phase 8 | Pending |
| TEST-04 | Phase 8 | Pending |

**Coverage:**
- v1.0 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after roadmap creation — traceability populated*
