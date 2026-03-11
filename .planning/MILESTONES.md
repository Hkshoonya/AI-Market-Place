# Milestones
## v1.1 Production Readiness (Shipped: 2026-03-11)

**Phases completed:** 11 phases, 29 plans, ~57 tasks
**Timeline:** 7 days (2026-03-05 to 2026-03-11)
**Requirements:** 30/30 satisfied (1 acknowledged limitation: CICD-04)
**Tests:** 222 unit/component tests + 18 E2E tests, all passing
**Codebase:** 71,065 LOC TypeScript
**Git range:** v1.0..v1.1 (163 commits, 314 files changed, +36,260/-5,743 lines)

**Key accomplishments:**
1. Sentry error tracking + PostHog analytics — error capture on 65 API routes, 6 custom events, bundle-optimized (<50KB gzipped)
2. GitHub Actions CI — 4-job pipeline (lint, typecheck, test, E2E) with zero-warning ESLint gate
3. Zod runtime validation — all 56 unsafe `as unknown as` casts replaced with Zod schemas across 33 production files
4. Component testing + E2E — 22 component tests (Vitest/Testing Library) + 18 Playwright E2E tests covering 4 critical user journeys
5. Component decomposition — all mega-components below 300 lines, React.memo on expensive pure components (ComparisonRow, ScoreBar)
6. SWR data fetching — 44 client components converted with tiered revalidation (FAST/MEDIUM/SLOW)

**Tech debt accepted:**
- 3 watchlist API routes missing handleApiError (errors bypass Sentry)
- SWR_TIERS constants used by ~4 of 44 consumers (most set refreshInterval ad-hoc)
- Auth E2E Test 1 has weakened assertion for error text in offline mode
- Phase 15 SUMMARY frontmatter missing requirements-completed in 2 plans

| Phase | Name | Plans | Completed |
|-------|------|-------|-----------|
| 9 | Observability | 2/2 | 2026-03-05 |
| 10 | CI Pipeline | 1/1 | 2026-03-05 |
| 11 | Zod Runtime Validation | 5/5 | 2026-03-08 |
| 12 | Component Testing Infrastructure | 3/3 | 2026-03-09 |
| 13 | Component Decomposition + React.memo | 4/4 | 2026-03-09 |
| 14 | SWR Data Fetching | 6/6 | 2026-03-09 |
| 15 | E2E Testing | 3/3 | 2026-03-11 |
| 16 | Code Simplification | 2/2 | 2026-03-11 |
| 17 | CI Verification + Branch Protection | 1/1 | 2026-03-11 |
| 18 | E2E Model Detail CI Fixture | 1/1 | 2026-03-11 |
| 19 | Tech Debt Hardening | 1/1 | 2026-03-11 |

---


## v1.0 Codebase Health (Shipped: 2026-03-05)

**Phases completed:** 8 phases, 28 plans
**Timeline:** 2 days (2026-03-03 to 2026-03-05)
**Requirements:** 34/34 satisfied
**Tests:** 170 tests across 14 files, all passing
**Codebase:** 68,434 LOC TypeScript

**Key accomplishments:**
1. Shared scoring infrastructure — `addSignal()`, `logNormalizeSignal()`, coverage penalty tables, `computeCommunitySignal()` eliminating ~200 lines of duplication
2. API route decomposition — 612-line compute-scores monolith split into 3-stage pipeline, purchase route split into guest/auth flows
3. Adapter deduplication — `createAdapterSyncer()` factory, shared `buildRecord()`, `inferCategory()`, known-models data eliminating ~1,700 lines across 6 adapters
4. Component decomposition — 4 monolithic components (985, 600+, 500+ lines) split into focused sub-components with custom hooks
5. Type safety overhaul — `any` reduced from 152 to 9 (all justified), `TypedSupabaseClient` across codebase
6. Error handling + structured logging — 149 `handleApiError` usages across 65 routes, zero silent catches, `createTaggedLogger` in 20+ modules
7. Regression test suite — 170 tests covering all 7 scoring calculators, market cap regression snapshots, and compute-scores integration

**Tech debt accepted:**
- 9 justified `any` usages (library incompatibilities, unregistered RPCs)
- `seller-listings-table.tsx` has 2 `console.error` calls not migrated
- `auction-detail-content.tsx` at 418 lines (exceeds plan estimate)

| Phase | Name | Plans | Completed |
|-------|------|-------|-----------|
| 1 | Test Infrastructure + Constants | 2/2 | 2026-03-03 |
| 2 | Scoring Simplification | 3/3 | 2026-03-04 |
| 3 | API Route Decomposition | 2/2 | 2026-03-04 |
| 4 | Adapter Deduplication | 3/3 | 2026-03-04 |
| 5 | Component Decomposition | 3/3 | 2026-03-04 |
| 6 | Type Safety | 7/7 | 2026-03-04 |
| 7 | Error Handling + Logging | 5/5 | 2026-03-05 |
| 8 | Regression Testing | 3/3 | 2026-03-05 |

---
