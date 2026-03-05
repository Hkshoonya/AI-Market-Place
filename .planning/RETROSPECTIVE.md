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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 8 | 28 | First milestone — established wave-based parallel execution, gap closure cycle |

### Cumulative Quality

| Milestone | Tests | Any Count | Silent Catches |
|-----------|-------|-----------|----------------|
| v1.0 | 170 | 9 (from 152) | 0 (from 20+) |

### Top Lessons (Verified Across Milestones)

1. Structural cleanup before quality improvements — decompose first, then type/test
2. Factory patterns for repetitive code — high ROI, low risk
