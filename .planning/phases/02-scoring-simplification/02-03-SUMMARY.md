---
phase: 02-scoring-simplification
plan: "03"
subsystem: scoring
tags: [refactor, gap-closure, community-signal, addSignal, scoring]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [community-signal-module, uniform-addSignal-adoption]
  affects: [quality-calculator, usage-calculator, market-cap-calculator]
tech_stack:
  added: []
  patterns: [single-responsibility, shared-helper-module, structural-typing]
key_files:
  created:
    - src/lib/scoring/community-signal.ts
  modified:
    - src/lib/scoring/quality-calculator.ts
    - src/lib/scoring/usage-calculator.ts
    - src/lib/scoring/market-cap-calculator.ts
decisions:
  - "community-signal.ts uses structural parameter types (not imported interfaces) to avoid circular imports with quality-calculator"
  - "quality-calculator re-exports computeCommunitySignal from community-signal.ts for backward compatibility"
  - "addSignal() wired into usage-calculator (6 sites) and market-cap-calculator (6 sites) as mechanical 1:1 push replacement; scoring output unchanged"
  - "expert-calculator.ts intentionally NOT modified — uses a different accumulation pattern (communityParts array of plain numbers), not a signals array"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_created: 1
  files_modified: 3
---

# Phase 2 Plan 03: Gap Closure — Community Signal Module + addSignal Adoption — Summary

**One-liner:** Closed 2 Phase 2 verification gaps: extracted `computeCommunitySignal` into its own standalone module (`community-signal.ts`) and wired `addSignal()` into `usage-calculator` and `market-cap-calculator` replacing all raw `signals.push()` calls.

## What Was Built

### New: `src/lib/scoring/community-signal.ts`

Standalone module exporting `computeCommunitySignal`. Uses structural parameter types to avoid circular imports:

```typescript
export function computeCommunitySignal(
  inputs: { hfLikes: number | null; newsMentions: number; trendingScore: number | null },
  stats: { maxLikes: number; maxNewsMentions: number },
  weights: { community: number },
  isProprietary: boolean,
  isHfAvailable: boolean
): Signal
```

- Imports `logNormalizeSignal` from `scoring-helpers`
- Function body is identical to the original in `quality-calculator.ts` — zero behavior change

### Modified: `src/lib/scoring/quality-calculator.ts`

- Removed: local `computeCommunitySignal` function definition (34 lines)
- Added: `import { computeCommunitySignal } from "@/lib/scoring/community-signal"`
- Added: `export { computeCommunitySignal } from "@/lib/scoring/community-signal"` (backward compat re-export)
- Call site at line 256 unchanged — structural typing means `QualityInputs` and `NormalizationStats` are accepted as the narrower parameter types

### Modified: `src/lib/scoring/usage-calculator.ts`

- Added `addSignal` to import from `scoring-helpers`
- Updated signals array type: `Array<{ score; weight }>` → `Array<{ name; score; weight }>`
- Replaced 6 `signals.push()` calls with `addSignal(signals, name, score, weight)`

Signal name mapping:
| Signal | Name |
|--------|------|
| HF downloads | `"downloads"` |
| HF likes | `"likes"` |
| GitHub stars | `"stars"` |
| News mentions | `"news"` |
| Provider MAU | `"usage"` |
| Trending score | `"trending"` |

### Modified: `src/lib/scoring/market-cap-calculator.ts`

- Added `addSignal` to import from `scoring-helpers`
- Updated signals array type: `Array<{ score; weight }>` → `Array<{ name; score; weight }>`
- Replaced 6 `signals.push()` calls with `addSignal(signals, name, score, weight)`

Signal name mapping matches usage-calculator (same 6 signals, same names).

## Success Criteria Check

- [x] `computeCommunitySignal` lives in `src/lib/scoring/community-signal.ts` (SCORE-05 / ROADMAP SC4 gap closed)
- [x] `quality-calculator.ts` imports from `community-signal.ts` — no local definition
- [x] `quality-calculator.ts` re-exports `computeCommunitySignal` for backward compatibility
- [x] `addSignal()` used in `usage-calculator.ts` for all 6 signal accumulations (ROADMAP SC1 gap closed)
- [x] `addSignal()` used in `market-cap-calculator.ts` for all 6 signal accumulations (ROADMAP SC1 gap closed)
- [x] No raw `signals.push()` calls remain in either calculator
- [x] `npx tsc --noEmit` passes clean (zero errors)
- [x] Zero behavior changes — scoring output is identical

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash | Description |
|------|-------------|
| `f5fd899` | feat(02-03): extract computeCommunitySignal into community-signal.ts module |
| `f555633` | feat(02-03): wire addSignal() into usage-calculator and market-cap-calculator |

## Self-Check: PASSED

- FOUND: src/lib/scoring/community-signal.ts
- FOUND: src/lib/scoring/quality-calculator.ts (modified)
- FOUND: src/lib/scoring/usage-calculator.ts (modified)
- FOUND: src/lib/scoring/market-cap-calculator.ts (modified)
- FOUND commit: f5fd899 (feat(02-03): extract computeCommunitySignal)
- FOUND commit: f555633 (feat(02-03): wire addSignal)
- VERIFIED: `computeCommunitySignal` exported from community-signal.ts
- VERIFIED: quality-calculator.ts has only import/re-export lines for computeCommunitySignal
- VERIFIED: No `signals.push()` in usage-calculator.ts or market-cap-calculator.ts
- VERIFIED: `addSignal` imported and used in both calculators
- VERIFIED: `npx tsc --noEmit` passes clean
