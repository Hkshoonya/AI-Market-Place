---
phase: 02-scoring-simplification
plan: "02"
subsystem: scoring
tags: [refactor, decomposition, quality-calculator, community-signal, scoring]
dependency_graph:
  requires: [02-01]
  provides: [decomposed-quality-calculator, computeCommunitySignal-export]
  affects: [quality-calculator, scoring-helpers]
tech_stack:
  added: []
  patterns: [coordinator-pattern, single-responsibility, shared-helpers]
key_files:
  created: []
  modified:
    - src/lib/scoring/quality-calculator.ts
decisions:
  - "calculateQualityScore refactored to coordinator calling 6 named sub-functions; body is 57 lines"
  - "maxWeight accumulator removed as dead code — it was computed but never used in score calculation"
  - "computeCommunitySignal exported standalone per SCORE-05; isHfAvailable/isProprietary flags passed as parameters"
  - "balanced-calculator.ts confirmed as pure meta-ranker with no shared helpers needed (no changes)"
  - "agent-score-calculator.ts confirmed: continuous sqrt coverage formula is algorithmic, not a lookup table (no changes)"
metrics:
  duration: "5 minutes"
  completed_date: "2026-03-03"
  tasks_completed: 2
  files_created: 0
  files_modified: 1
---

# Phase 2 Plan 02: Quality Calculator Decomposition — Summary

**One-liner:** Decomposed 140-line monolithic `calculateQualityScore()` into a 57-line coordinator calling 6 sub-functions under 34 lines each, extracting `computeCommunitySignal` as a standalone export and wiring quality-calculator to shared scoring-helpers.

## What Was Built

### Modified: `src/lib/scoring/quality-calculator.ts`

**New imports from scoring-helpers:**

| Import | Replaces |
|--------|----------|
| `weightedBenchmarkAvg` | Local `computeWeightedBenchmarkAvg()` (13-line duplicate) |
| `normalizeElo` | Inline `(eloScore - 800) / (1400 - 800) * 100` |
| `computeRecencyScore` | Inline 3-line exponential decay block |
| `logNormalizeSignal` | Inline `log10(x+1) / log10(max+1) * 100` pattern |
| `addSignal` | Direct `signals.push()` calls |

**Removed local duplicates:**
- `BENCHMARK_IMPORTANCE` constant (35-line lookup table) — now imported from scoring-helpers
- `computeWeightedBenchmarkAvg()` function (13 lines) — replaced by `weightedBenchmarkAvg()` from helpers

**New sub-functions (each under 50 lines):**

| Function | Lines | Description |
|----------|-------|-------------|
| `computePopularitySignal` | 11 | HF downloads log-normalization |
| `computeBenchmarkSignal` | 12 | Weighted benchmark average with fallback |
| `computeEloSignal` | 13 | ELO normalization + benchmark weight absorption |
| `computeRecencySignal` | 11 | 18-month half-life exponential decay |
| `computeCommunitySignal` | 34 | Likes + news + trending boost (EXPORTED) |
| `computeOpennessSignal` | 10 | Open=100, proprietary=50 |

**Coordinator `calculateQualityScore`:** 57-line function body — resolves flags, collects signals via sub-functions, applies coverage penalty and proxy gate, blends with existing score.

### Verified: `src/lib/scoring/balanced-calculator.ts`

No changes needed. Pure meta-ranker combining ranks from other lenses — no signal math, no shared helpers applicable.

### Verified: `src/lib/scoring/agent-score-calculator.ts`

No changes made (per Phase 1 decision). Coverage penalty `0.5 + 0.5 * Math.sqrt(coverageFraction)` is a continuous formula, not a lookup table. `computePercentile()` is agent-specific. No logNorm, weightedBenchmarkAvg, or ELO normalization patterns.

## Success Criteria Check

- [x] `calculateQualityScore` is a coordinator calling 6 named sub-functions
- [x] Every sub-function is under 50 lines with max 4 nesting levels
- [x] `computeCommunitySignal` is exported and standalone-callable (SCORE-05)
- [x] `quality-calculator` imports from `scoring-helpers` — no local BENCHMARK_IMPORTANCE or weightedBenchmarkAvg duplicates
- [x] All 7 calculators verified — no remaining helper duplication
- [x] TypeScript compiles clean: `npx tsc --noEmit` passes with zero errors

## Deviations from Plan

**[Rule 1 - Bug/Dead Code] Removed unused maxWeight accumulator**
- **Found during:** Task 1
- **Issue:** The original code accumulated `maxWeight` across all signal sections but the variable was never read in any calculation — it was dead code in both the original and the refactored version.
- **Fix:** Removed the `maxWeight` accumulation entirely from the coordinator, reducing the body by 4 lines.
- **Files modified:** `src/lib/scoring/quality-calculator.ts`
- **Commit:** `6556644`

## Commits

| Hash | Description |
|------|-------------|
| `6556644` | feat(02-02): decompose calculateQualityScore into 6 sub-functions |

## Self-Check: PASSED

- FOUND: src/lib/scoring/quality-calculator.ts
- FOUND commit: 6556644 (feat(02-02): decompose calculateQualityScore into 6 sub-functions)
- VERIFIED: `computeCommunitySignal` is exported
- VERIFIED: No local BENCHMARK_IMPORTANCE in quality-calculator.ts
- VERIFIED: No duplicate logNorm, ELO normalization, or recency decay outside scoring-helpers.ts
- VERIFIED: `npx tsc --noEmit` passes clean
