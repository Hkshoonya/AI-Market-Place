# Phase 2: Scoring Simplification - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Decompose `calculateQualityScore()` into sub-functions under 50 lines each. Extract shared helpers (`addSignal`, `logNormalizeSignal`, `weightedBenchmarkAvg`, ELO normalization, recency calculation) used across all 7 scoring calculators. Merge duplicated open/proprietary code paths in the usage calculator. Extract `computeCommunitySignal()` as a standalone function. Zero behavior changes — scoring output must be identical before and after.

</domain>

<decisions>
## Implementation Decisions

### Shared helpers location
- New file: `src/lib/scoring/scoring-helpers.ts` — alongside the calculators, NOT in constants/scoring.ts (constants = config values, helpers = runtime logic)
- Exports: `logNormalizeSignal()`, `addSignal()`, `weightedBenchmarkAvg()`, `normalizeElo()`, `computeRecencyScore()`
- All calculators import from `@/lib/scoring/scoring-helpers`
- Follow existing kebab-case file naming and named-export conventions

### BENCHMARK_IMPORTANCE consolidation
- One canonical `BENCHMARK_IMPORTANCE` record in `scoring-helpers.ts`
- Use the fuller list from quality-calculator (28 entries) as the canonical version — expert's 18-entry list is a subset with identical weights
- Both quality and expert calculators import the same list
- `weightedBenchmarkAvg()` becomes a shared function using the canonical list

### Usage calculator unification
- Single code path that processes all 6 signal types in one loop
- Normalization pool selection is conditional per-signal (not per-branch): each signal checks `isOpenWeights` to pick the right max value
- Result: one `for` loop or sequential block instead of duplicated open/proprietary branches
- Preserve dual-pool normalization — the pools stay separate, just the code path is unified

### Quality score decomposition
- `calculateQualityScore()` becomes a coordinator calling sub-functions:
  - `computePopularitySignal()` — HF downloads log-normalization
  - `computeBenchmarkSignal()` — weighted benchmark average with ELO absorption
  - `computeEloSignal()` — ELO normalization
  - `computeRecencySignal()` — exponential decay
  - `computeCommunitySignal()` — likes + news + trending (SCORE-05: standalone exported function in its own module)
  - `computeOpennessSignal()` — simple open/proprietary bonus
- Each sub-function returns `{ name, score, weight } | null`
- Coverage penalty and proxy quality gate remain in the coordinator (they operate on the assembled signals array)

### Claude's Discretion
- Exact function signatures and parameter types for helpers
- Whether `computeCommunitySignal()` goes in its own file or stays in quality-calculator as an export
- Internal structure of the unified usage calculator loop
- Whether to extract the quality proxy signal computation into a helper

</decisions>

<specifics>
## Specific Ideas

No specific requirements — this is mechanical refactoring guided by the requirements (SCORE-01 through SCORE-05). The key constraint is zero behavior change: all scoring output must be identical before and after.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/constants/scoring.ts`: Coverage penalty tables and market cap constants (Phase 1)
- `logNorm()` already exists in `usage-calculator.ts:47` and `expert-calculator.ts:53` — same implementation, ready to extract
- `weightedBenchmarkAvg()` in `quality-calculator.ts:142` is the fuller version to canonicalize

### Established Patterns
- Signal accumulation pattern: `signals.push({ score, weight })` then `reduce` for weighted average — used in all calculators
- Coverage penalty applied after weighted average — quality, expert, market-cap all follow this
- Proprietary/open model distinction: quality and usage calculators handle this, others don't

### Integration Points
- 7 calculator files to update: quality, usage, expert, market-cap, capability, balanced, agent-score
- `computePopularityScore()` in market-cap-calculator uses same log-normalize pattern
- `computeExpertScore()` in expert-calculator has own `weightedBenchmarkAvg` and `logNorm` to replace
- `calculateQualityScore()` has the most work: 140 lines → 6 sub-functions + coordinator

### Duplication Map
- `logNorm()`: usage-calculator:47, expert-calculator:53 (identical)
- `weightedBenchmarkAvg()`: quality-calculator:142, expert-calculator:41 (identical logic)
- `BENCHMARK_IMPORTANCE`: quality-calculator:106 (28 entries), expert-calculator:33 (18 entries, subset)
- ELO normalization: quality-calculator:233, expert-calculator:90, capability-calculator:113
- Recency calculation: quality-calculator:248, expert-calculator:112, capability-calculator:119

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-scoring-simplification*
*Context gathered: 2026-03-03*
