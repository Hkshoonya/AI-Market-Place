---
phase: 03-api-route-decomposition
plan: 01
subsystem: compute-scores pipeline
tags: [decomposition, pipeline, injectable, scoring]
dependency_graph:
  requires: []
  provides: [compute-scores/types, compute-scores/fetch-inputs, compute-scores/compute-all-lenses, compute-scores/persist-results]
  affects: [src/app/api/cron/compute-scores/route.ts]
tech_stack:
  added: []
  patterns: [parameter-injection, pipeline-stages, data-contracts]
key_files:
  created:
    - src/lib/compute-scores/types.ts
    - src/lib/compute-scores/fetch-inputs.ts
    - src/lib/compute-scores/compute-all-lenses.ts
    - src/lib/compute-scores/persist-results.ts
  modified:
    - src/app/api/cron/compute-scores/route.ts
decisions:
  - "fetchInputs() includes pipeline health check (staleCount) per user decision"
  - "computeAllLenses() is a single exported function — no sub-function exports"
  - "Supabase client injected as parameter into all three functions (no internal createClient)"
  - "modelsWithValueMetric and modelsWithValueScore both use normalizedValueMap.size (no valueMetricMap in results)"
metrics:
  duration: ~8min
  completed: "2026-03-04"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 3 Plan 1: Compute-Scores Route Decomposition Summary

**One-liner:** Decomposed 612-line compute-scores cron route into three injectable pipeline functions (fetchInputs, computeAllLenses, persistResults) with typed ScoringInputs/ScoringResults contracts, reducing route.ts to 67 lines.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create compute-scores types and extract all three pipeline functions | 1a1ec99 | types.ts, fetch-inputs.ts, compute-all-lenses.ts, persist-results.ts |
| 2 | Rewrite compute-scores route as thin wrapper | c13c5ab | route.ts |

## What Was Built

**src/lib/compute-scores/types.ts** — Pipeline data contracts:
- `ScoringInputs`: models array + 5 Maps (benchmarkMap, benchmarkDetailMap, eloMap, newsMentionMap, providerBenchmarkAvg) + staleCount
- `ScoringResults`: 16 Maps/arrays covering all lens scores, ranks, pricing, and computed values
- `PersistStats`: updated, errors, snapshotsCreated counts

**src/lib/compute-scores/fetch-inputs.ts** — `fetchInputs(supabase: SupabaseClient)`:
- Fetches active models, benchmark scores (with detail map), ELO ratings, news mentions (30-day window)
- Computes per-provider benchmark averages
- Calls `getStaleSourceCount()` and logs warning if > 3 stale sources
- Returns `Promise<ScoringInputs>`
- Throws on models query failure (caught by route try/catch)

**src/lib/compute-scores/compute-all-lenses.ts** — `computeAllLenses(inputs, supabase)`:
- Quality scores via `calculateQualityScore` + `computeNormalizationStats`
- Pricing sync to model_pricing table via Supabase upsert
- Value metric normalization (log10 scale, 0-100)
- Agent scores via `computeAgentBenchmarkWeights` + `computeAgentScore`
- Capability lens (benchmarks + ELO + recency)
- Usage lens (downloads, likes, stars, news, provider estimate, trending)
- Expert lens (benchmark-weighted + ELO + community)
- Popularity scores + market cap computation
- Balanced composite rankings via `computeBalancedRankings`
- Returns `Promise<ScoringResults>`

**src/lib/compute-scores/persist-results.ts** — `persistResults(supabase, inputs, results)`:
- Batch updates models table (BATCH=50, Promise.all pattern)
- Creates model_snapshots with signal_coverage via `buildSignalCoverage`
- Returns `Promise<PersistStats>`

**src/app/api/cron/compute-scores/route.ts** (67 lines, down from 612):
- Auth check (Bearer token vs CRON_SECRET)
- Supabase client creation
- `trackCronRun("compute-scores")` + try/catch
- `fetchInputs -> computeAllLenses -> persistResults` pipeline
- `tracker.complete({...})` assembling stats from all three phases

## Verification Results

- `npx tsc --noEmit`: PASS (zero errors)
- Route line count: 67 (well under 100 limit)
- Import count in route: 6 (at limit)
- No `NextRequest`/`NextResponse` in `src/lib/compute-scores/`: PASS
- All three functions export correctly and are importable

## Deviations from Plan

None - plan executed exactly as written.

The `modelsWithValueMetric` stat in tracker.complete() uses `results.normalizedValueMap.size` instead of a separate `valueMetricMap` (which stays internal to `compute-all-lenses.ts`). This matches the original route's stat semantics since valueMetricMap and normalizedValueMap have the same size (only models with pricing get normalized values).

## Self-Check: PASSED

Files exist:
- src/lib/compute-scores/types.ts: FOUND
- src/lib/compute-scores/fetch-inputs.ts: FOUND
- src/lib/compute-scores/compute-all-lenses.ts: FOUND
- src/lib/compute-scores/persist-results.ts: FOUND
- src/app/api/cron/compute-scores/route.ts: FOUND (67 lines)

Commits exist:
- 1a1ec99: feat(03-01): extract compute-scores pipeline into three injectable functions
- c13c5ab: feat(03-01): rewrite compute-scores route as thin HTTP wrapper
