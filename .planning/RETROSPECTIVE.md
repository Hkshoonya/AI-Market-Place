# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Codebase Health

**Shipped:** 2026-03-05
**Phases:** 8 | **Plans:** 28

### What Was Built
- Shared scoring infrastructure (addSignal, logNormalizeSignal, coverage penalty tables, community-signal module)
- Decomposed compute-scores pipeline and purchase route into independently testable functions
- Adapter deduplication via createAdapterSyncer, buildRecord, inferCategory factories (~1,700 lines eliminated)
- 4 monolithic components (985, 600+, 500+ lines) split into focused sub-components with custom hooks
- Type safety overhaul reducing `any` from 152 to 9 with TypedSupabaseClient across codebase
- Structured error handling (handleApiError in 149 usages) and logging (createTaggedLogger in 20+ modules)
- 170 regression tests covering all 7 scoring calculators + market cap formula + compute-scores pipeline

### What Worked
- Wave-based parallel execution — phases 4/5 ran in parallel with phases 2/3 since they only depended on phase 1
- Gap closure cycle (phases 2, 6) — verifier caught real gaps that manual review would have missed
- Dependency ordering — decomposing structure first (phases 2-5) before fixing types (phase 6) was the right call
- Factory pattern adoption — createAdapterSyncer eliminated massive duplication with minimal risk
- Parallel plan execution within waves — 3 plans running simultaneously in phases 7 and 8

### What Was Inefficient
- Phases 2 and 6 needed gap closure rounds — plans underestimated scope of community-signal extraction and any count reduction
- SUMMARY.md frontmatter lacked `requirements-completed` field in most plans — weakened 3-source cross-reference during audit
- Nyquist VALIDATION.md only created for 1 of 8 phases — late enablement meant most phases missed it

### Patterns Established
- handleApiError + createTaggedLogger as universal error/logging pattern
- TypedSupabaseClient from database.ts as single type source for Supabase
- Factory pattern (createAdapterSyncer, buildRecord) for adapter code reuse
- Custom hooks (useAuctionTimer, useEarningsData, useWalletBalance, useHeatmapTooltip) for component state extraction
- Coverage penalty lookup tables instead of if/else chains

### Key Lessons
1. Decompose monolithic code before fixing types — Phase 6 type safety was dramatically easier because Phases 2-5 had already broken down large files
2. Factory patterns (createAdapterSyncer) can eliminate thousands of lines of duplication with very low risk when the pattern is consistent
3. Gap closure is normal, not a failure — verifier catching missed requirements is the system working correctly
4. Pure refactoring milestones can be completed very fast (2 days for 28 plans) because there are no design decisions to debate

### Cost Observations
- Model mix: Opus orchestrator, Sonnet executors/verifiers/researchers
- Notable: Parallel execution within waves cut wall-clock time significantly for phases 7 and 8

---

## Milestone: v1.1 — Production Readiness

**Shipped:** 2026-03-11
**Phases:** 11 | **Plans:** 29 | **Timeline:** 7 days

### What Was Built
- Sentry error tracking (65 API routes) + PostHog analytics (6 custom events) with bundle-optimized integration
- GitHub Actions CI pipeline: 4 parallel jobs (lint, typecheck, test, E2E) with zero-warning ESLint gate
- Zod runtime validation replacing all 56 unsafe `as unknown as` casts across 33 production files
- 22 component tests (Vitest/Testing Library) + 18 Playwright E2E tests for 4 critical user journeys
- All mega-components decomposed below 300 lines with React.memo on expensive pure components
- SWR data fetching across 44 client components with tiered revalidation (FAST/MEDIUM/SLOW)
- MSW server-side interception for E2E tests running against RSC pages in CI

### What Worked
- Gap closure phases (17-19) — milestone audit identified 10 gaps; all 10 were closed by adding 3 focused phases
- MSW in instrumentation.ts pattern — solved the "RSC + E2E + CI" trilemma cleanly (Phase 18)
- Phase-level research before planning — each phase had RESEARCH.md that anticipated blockers
- Zod coercion patterns (z.coerce.number()) — solved PostgREST string-to-number problem once and applied everywhere
- SWR provider chain ordering — establishing SWRProvider as outermost avoided dependency issues
- Nyquist VALIDATION.md at creation — phases 16+ had validation from the start

### What Was Inefficient
- Phases 11 and 14 both needed gap closure rounds — initial plans underestimated scope of Zod migration and SWR conversion
- Phase 15 E2E tests for model detail had to skip in CI initially — should have planned MSW from the start
- SUMMARY frontmatter still incomplete in Phase 15 — 2 plans lack requirements-completed field (same issue as v1.0)
- Branch protection (CICD-04) took 3 phases to resolve only to accept it as a platform limitation
- Nyquist validation only completed for 2 of 11 phases — most remain in draft status

### Patterns Established
- parseQueryResult/parseQueryResultSingle for Zod-validated Supabase queries with Sentry reporting
- SWR_TIERS (FAST/MEDIUM/SLOW) for tiered revalidation intervals
- MSW + instrumentation.ts for server-side mocking in E2E tests
- Vitest 4 projects config (unit/node + component/jsdom) for mixed test environments
- injectMockAuth for Playwright E2E auth simulation via document.cookie
- Module-level particle generation + useRef for R3F animation state (avoiding React compiler purity rules)

### Key Lessons
1. Plan E2E infrastructure (MSW/fixtures) alongside E2E tests, not as a gap closure — Phase 18 could have been part of Phase 15
2. Zod migration at scale requires multiple passes — initial audit counts (56 casts) don't capture edge cases (coercion, nullable, enrichment patterns)
3. Zero-warning lint gates should be established early — adding --max-warnings 0 late means fixing accumulated warnings in a separate phase
4. SUMMARY frontmatter discipline matters — missing requirements-completed fields create audit noise (same lesson from v1.0, still not fully addressed)
5. Platform limitations (GitHub Free branch protection) should be identified during research, not discovered during execution

### Cost Observations
- Model mix: Opus orchestrator, Sonnet executors/verifiers/researchers/auditors
- Notable: Phase 18 (MSW fixture) was the longest single plan at ~120min due to debugging server-side interception
- Parallel plan execution underutilized in v1.1 — most phases were sequential due to dependencies

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 8 | 28 | Established wave-based parallel execution, gap closure cycle |
| v1.1 | 11 | 29 | Added milestone audit → gap closure loop; Nyquist validation introduced |

### Cumulative Quality

| Milestone | Tests | Type Casts | ESLint Warnings | E2E Tests |
|-----------|-------|------------|-----------------|-----------|
| v1.0 | 170 | 152 → 9 `any` | not tracked | 0 |
| v1.1 | 222 | 56 → 0 `as unknown as` | 0 (enforced) | 18 |

### Top Lessons (Verified Across Milestones)

1. Structural cleanup before quality improvements — decompose first, then type/test (v1.0 + v1.1)
2. Gap closure is normal and valuable — verifier/auditor catching gaps is the system working (v1.0 + v1.1)
3. SUMMARY frontmatter discipline needs enforcement — requirements-completed missing in both milestones
4. Plan infrastructure alongside tests — E2E mocking should ship with E2E tests, not as a separate gap closure phase
