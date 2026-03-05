---
phase: 08-regression-testing
plan: 02
subsystem: scoring
tags: [testing, regression, calculators, market-cap]
dependency_graph:
  requires: []
  provides: [TEST-02, TEST-03]
  affects: [scoring-calculators]
tech_stack:
  added: []
  patterns: [vitest-unit-tests, regression-snapshots]
key_files:
  created:
    - src/lib/scoring/quality-calculator.test.ts
    - src/lib/scoring/expert-calculator.test.ts
    - src/lib/scoring/agent-score-calculator.test.ts
    - src/lib/scoring/market-cap-calculator.test.ts
  modified: []
decisions:
  - "Regression snapshots use exact hand-computed values (not tolerance ranges) for maximum drift detection"
  - "Coverage penalty behavior tested comparatively (more signals > fewer signals) rather than exact penalty values"
  - "computeMarketCap regression includes 6 profiles covering GPT-4o, Claude-3.5, open-source, niche, zero, and high-price"
metrics:
  duration: 4min
  completed: "2026-03-05T04:21:42Z"
  tasks: 2
  files: 4
  tests_added: 44
---

# Phase 08 Plan 02: Scoring Calculator Unit Tests + Market Cap Regression Summary

Unit tests for quality-calculator, expert-calculator, agent-score-calculator with 26 assertions, plus market-cap-calculator with 18 assertions including 6 regression snapshots that lock down the market cap formula against drift.

## Task Results

### Task 1: Unit tests for quality, expert, and agent score calculators
**Commit:** 5978a96
**Files:** quality-calculator.test.ts, expert-calculator.test.ts, agent-score-calculator.test.ts

- quality-calculator: 8 tests (normal LLM, proprietary, all-null, image_generation category weights, proxy signals, AA blending, normalization stats)
- expert-calculator: 7 tests (full-signal, zero-signal, null benchmarks fallback, coverage penalty comparison, ELO weight absorption, norm stats)
- agent-score-calculator: 11 tests (slug normalization for 16 aliases, non-agent slug rejection, case-insensitivity, weights computation, zero/multiple benchmarks, breakdown shape, deduplication, coverage penalty)

### Task 2: Market cap unit tests and regression snapshots
**Commit:** 12d4db0
**Files:** market-cap-calculator.test.ts

- computePopularityStats: 2 tests (max computation, all-zero defaults)
- computePopularityScore: 5 tests (all-max near 100, all-zero = 0, single-signal penalty <= 50, 4+ signals full credit, comparative more-signals > fewer)
- computeMarketCap regression: 6 exact snapshot assertions
  1. GPT-4o (usage=95, price=$15) -> $280,000
  2. Claude-3.5 (usage=85, price=$12) -> $226,000
  3. Llama-3 (usage=60, price=$0) -> $6,000 (MIN_EFFECTIVE_PRICE)
  4. Niche (usage=20, price=$10) -> $37,000
  5. Zero usage -> $0
  6. High price (usage=50, price=$50) -> $184,000
- Edge cases: 4 tests (negative usage, MIN_EFFECTIVE_PRICE fallback, priceWeight > 1, rounding to nearest 1000)
- Constants guard: verifies MARKET_CAP_SCALE_FACTOR, USAGE_EXPONENT, MAX_PRICE_NORMALIZATION, MIN_EFFECTIVE_PRICE

## Verification

```
Test Files  14 passed (14)
Tests       170 passed (170)
```

All 4 new test files pass. Full suite (170 tests across 14 files) exits with code 0.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] src/lib/scoring/quality-calculator.test.ts exists
- [x] src/lib/scoring/expert-calculator.test.ts exists
- [x] src/lib/scoring/agent-score-calculator.test.ts exists
- [x] src/lib/scoring/market-cap-calculator.test.ts exists
- [x] Commit 5978a96 exists (Task 1)
- [x] Commit 12d4db0 exists (Task 2)
