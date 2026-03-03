---
phase: 02-scoring-simplification
plan: "01"
subsystem: scoring
tags: [refactor, helpers, deduplication, scoring]
dependency_graph:
  requires: []
  provides: [scoring-helpers.ts, unified-usage-calculator]
  affects: [expert-calculator, market-cap-calculator, capability-calculator, usage-calculator]
tech_stack:
  added: []
  patterns: [shared-helper-module, single-source-of-truth, single-code-path]
key_files:
  created:
    - src/lib/scoring/scoring-helpers.ts
  modified:
    - src/lib/scoring/expert-calculator.ts
    - src/lib/scoring/market-cap-calculator.ts
    - src/lib/scoring/capability-calculator.ts
    - src/lib/scoring/usage-calculator.ts
decisions:
  - "BENCHMARK_IMPORTANCE canonical 28-entry list lives in scoring-helpers.ts; quality-calculator still has local copy pending Plan 02 wiring"
  - "computeRecencyScore defaults to halfLifeMonths=18 matching quality-calculator; expert and capability pass halfLifeMonths=12"
  - "usage-calculator unified into single code path using per-signal pool selection variables (newsMax, trendingMax)"
  - "trending normalization remains linear (not log) in both usage and market-cap calculators"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-03"
  tasks_completed: 2
  files_created: 1
  files_modified: 4
---

# Phase 2 Plan 01: Shared Scoring Helpers — Summary

**One-liner:** Created `scoring-helpers.ts` with 5 shared helpers + canonical BENCHMARK_IMPORTANCE, eliminating duplicated math across 4 calculators and merging usage-calculator's duplicated open/proprietary branches into a single code path.

## What Was Built

### New: `src/lib/scoring/scoring-helpers.ts`

The shared helper module exports:

| Export | Description |
|--------|-------------|
| `BENCHMARK_IMPORTANCE` | 28-entry canonical importance weights (single source of truth) |
| `logNormalizeSignal(value, max)` | log10 normalisation relative to pool max, returns 0-100 |
| `addSignal(signals, name, score, weight)` | Append a named signal to the accumulation array |
| `weightedBenchmarkAvg(scores)` | Importance-weighted average with slug normalisation |
| `normalizeElo(eloScore)` | Maps ELO 800-1400 range onto 0-100, clamped |
| `computeRecencyScore(date, options?)` | Exponential decay with configurable halfLifeMonths and floor |

### Modified Calculators

**expert-calculator.ts:**
- Removed: local `BENCHMARK_IMPORTANCE` (18-entry subset), `weightedBenchmarkAvg()`, `logNorm()`
- Added: import from scoring-helpers
- Replaced: 3 `logNorm()` calls with `logNormalizeSignal()`, inline ELO with `normalizeElo()`, inline recency block (4 lines) with `computeRecencyScore(date, { halfLifeMonths: 12 })`

**market-cap-calculator.ts:**
- Added: import `logNormalizeSignal`
- Replaced: 5 inline log-normalization blocks in `computePopularityScore()` with `logNormalizeSignal()` calls
- Preserved: trending score linear normalization (not log, left as-is per plan)

**capability-calculator.ts:**
- Added: import `normalizeElo`, `computeRecencyScore`
- Replaced: inline ELO normalization (1 line) with `normalizeElo()`, inline recency block (4 lines) with `computeRecencyScore(date, { halfLifeMonths: 12 })`

**usage-calculator.ts:**
- Added: import `logNormalizeSignal`
- Removed: local `logNorm()` function (4 lines)
- Merged: the two duplicated open/proprietary signal branches (46 lines) into a single sequential code path (36 lines) using `newsMax` and `trendingMax` variables for pool selection

## Success Criteria Check

- [x] `scoring-helpers.ts` exports: `logNormalizeSignal`, `addSignal`, `weightedBenchmarkAvg`, `normalizeElo`, `computeRecencyScore`, `BENCHMARK_IMPORTANCE`
- [x] `expert-calculator` has zero local helper duplicates (no `logNorm`, no `weightedBenchmarkAvg`, no `BENCHMARK_IMPORTANCE`)
- [x] `market-cap-calculator` uses `logNormalizeSignal` for all 5 log-normalized signals
- [x] `capability-calculator` uses `normalizeElo` and `computeRecencyScore` from helpers
- [x] `usage-calculator` has ONE code path processing all signal types
- [x] `npx tsc --noEmit` passes clean (zero errors)

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash | Description |
|------|-------------|
| `129c04a` | feat(02-01): create scoring-helpers.ts with shared helper functions |
| `9c8c40b` | feat(02-01): wire calculators to scoring-helpers, unify usage calculator |

## Self-Check: PASSED

- FOUND: src/lib/scoring/scoring-helpers.ts
- FOUND commit: 129c04a (feat(02-01): create scoring-helpers.ts)
- FOUND commit: 9c8c40b (feat(02-01): wire calculators to scoring-helpers)
