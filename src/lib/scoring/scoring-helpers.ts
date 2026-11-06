/**
 * Shared Scoring Helpers
 *
 * Canonical helpers and constants used across all scoring calculators.
 * Centralises repeated math so each calculator focuses on its own logic.
 *
 * Exports:
 *   BENCHMARK_IMPORTANCE  — 28-entry importance weights (single source of truth)
 *   logNormalizeSignal    — log10 normalisation relative to a pool maximum
 *   addSignal             — push a named signal onto a signals array
 *   weightedBenchmarkAvg  — importance-weighted average of benchmark scores
 *   normalizeElo          — map an ELO rating (800-1400) onto 0-100
 *   computeRecencyScore   — exponential decay recency score with configurable half-life
 */

// --------------- Benchmark Importance ---------------

/**
 * Benchmark importance weights for weighted averaging.
 * This is the single source of truth; all calculators that need benchmark
 * weighting should import from here.
 *
 * Multiple slug variants are listed to handle DB inconsistencies
 * (some use hyphens, some use underscores).
 */
export const BENCHMARK_IMPORTANCE: Record<string, number> = {
  // Core benchmarks (Artificial Analysis + Open LLM Leaderboard)
  "mmlu": 1.0,
  "humaneval": 1.2,
  "math": 1.1,
  "aime": 1.15,
  "math-benchmark": 1.1,
  "gpqa": 1.3,
  "ifeval": 0.9,
  "bbh": 1.0,
  "musr": 0.8,
  "mmlu-pro": 1.2,
  "mmlu_pro": 1.2,
  // SWE-bench (both slug forms)
  "swe-bench": 1.3,
  "swe_bench": 1.3,
  // ARC (both slug forms)
  "arc-challenge": 0.9,
  "arc": 0.9,
  "hellaswag": 0.8,
  "winogrande": 0.8,
  "truthfulqa": 0.9,
  // LiveBench benchmarks
  "livebench-reasoning": 1.1,
  "livebench-math": 1.1,
  "livebench-coding": 1.2,
  "livebench-language": 0.9,
  "livebench-if": 0.9,
  "livebench-data-analysis": 1.0,
  // Vision/multimodal benchmarks
  "mmmu": 1.0,
  "mathvista": 1.0,
  "ocrbench": 0.9,
  // BigCodeBench
  "bigcodebench": 1.2,
  "livecodebench": 1.2,
  "aider-polyglot": 1.25,
  "arena-hard-auto": 1.1,
};

// --------------- Signal Helpers ---------------

/**
 * Log-normalise a value relative to a pool maximum.
 * Returns a score in [0, 100].
 *
 * Formula: (log10(value + 1) / log10(max + 1)) * 100, clamped to 100.
 * Returns 0 if value or max is non-positive.
 */
export function logNormalizeSignal(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min((Math.log10(value + 1) / Math.log10(max + 1)) * 100, 100);
}

/**
 * Append a scored signal to a signals array.
 * Standardises the accumulation pattern used across all calculators.
 */
export function addSignal(
  signals: Array<{ name: string; score: number; weight: number }>,
  name: string,
  score: number,
  weight: number
): void {
  signals.push({ name, score, weight });
}

/**
 * Compute an importance-weighted average of benchmark scores.
 * Uses BENCHMARK_IMPORTANCE for weights; falls back to 1.0 for unknown slugs.
 * Normalises slugs so both hyphen and underscore variants resolve correctly.
 *
 * Returns 0 if the scores array is empty.
 */
export function weightedBenchmarkAvg(
  scores: Array<{ slug: string; score: number }>
): number {
  if (scores.length === 0) return 0;
  let wSum = 0;
  let wTotal = 0;
  for (const s of scores) {
    const norm = s.slug.toLowerCase().replace(/_/g, "-");
    const imp = BENCHMARK_IMPORTANCE[s.slug] ?? BENCHMARK_IMPORTANCE[norm] ?? 1.0;
    wSum += s.score * imp;
    wTotal += imp;
  }
  return wTotal > 0 ? wSum / wTotal : 0;
}

/**
 * Normalise an Arena rating onto 0-100, extending the historical 1400 ceiling
 * with the latest observed maximum from the same arena (never across arenas).
 */
export function normalizeElo(eloScore: number, observedMaximum = 1400): number {
  if (!Number.isFinite(eloScore)) return 0;
  const ceiling = Number.isFinite(observedMaximum) ? Math.max(1400, observedMaximum) : 1400;
  return Math.min(Math.max((eloScore - 800) / (ceiling - 800) * 100, 0), 100);
}

/**
 * Compute an exponential-decay recency score (0-100).
 *
 * @param releaseDate - ISO date string, or null
 * @param options.halfLifeMonths - Half-life in months (default 18, matching quality-calculator)
 * @param options.floor          - Minimum score (default 10)
 *
 * Returns 50 when releaseDate is null (neutral default).
 */
export function computeRecencyScore(
  releaseDate: string | null,
  options?: { halfLifeMonths?: number; floor?: number }
): number {
  const requestedHalfLife = options?.halfLifeMonths ?? 18;
  const halfLife = Number.isFinite(requestedHalfLife) && requestedHalfLife > 0 ? requestedHalfLife : 18;
  const requestedFloor = options?.floor ?? 10;
  const floor = Number.isFinite(requestedFloor) ? Math.min(100, Math.max(0, requestedFloor)) : 10;

  if (!releaseDate) return 50;

  const releasedAt = Date.parse(releaseDate);
  if (!Number.isFinite(releasedAt)) return 50;
  const ageMs = Math.max(0, Date.now() - releasedAt);
  const ageMonths = ageMs / (30 * 24 * 60 * 60 * 1000);
  return Math.max(100 * Math.pow(2, -ageMonths / halfLife), floor);
}
