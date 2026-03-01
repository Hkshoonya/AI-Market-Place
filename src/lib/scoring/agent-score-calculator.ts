/**
 * Agent Score Calculator
 *
 * Computes a composite "agent score" (0-100) for AI models based on
 * their performance across agent-specific benchmarks:
 *   - TerminalBench (CLI/terminal tasks)
 *   - OSWorld (OS-level desktop automation)
 *   - GAIA (general assistant tasks)
 *   - WebArena (web browsing tasks)
 *   - TAU-Bench (tool-augmented understanding)
 *
 * Key design:
 *   - Dynamic weighting: benchmarks with more data coverage get higher weight
 *   - Percentile normalization: raw scores are normalized to 0-100 within
 *     each benchmark's score distribution
 *   - Coverage penalty: models with fewer benchmark scores get penalized
 *   - Separate from quality_score (which focuses on general LLM benchmarks)
 */

// --------------- Types ---------------

export interface AgentBenchmarkScore {
  benchmarkSlug: string;
  score: number;
  scoreNormalized: number;
}

export interface AgentScoreResult {
  /** Composite agent score 0-100 */
  agentScore: number;
  /** Number of agent benchmarks this model has scores for */
  benchmarkCount: number;
  /** Per-benchmark normalized scores */
  breakdown: Array<{
    benchmarkSlug: string;
    rawScore: number;
    normalizedScore: number;
    weight: number;
  }>;
}

export interface BenchmarkWeight {
  slug: string;
  weight: number;
}

// --------------- Constants ---------------

/** Canonical agent benchmark slugs */
const AGENT_BENCHMARK_SLUGS = [
  "terminal-bench",
  "os-world",
  "gaia",
  "webarena",
  "tau-bench",
] as const;

/** Default weights when all benchmarks have equal coverage */
const DEFAULT_WEIGHTS: Record<string, number> = {
  "terminal-bench": 0.20,
  "os-world": 0.20,
  "gaia": 0.20,
  "webarena": 0.20,
  "tau-bench": 0.20,
};

/** Minimum number of agent benchmarks required to compute a score */
const MIN_BENCHMARKS_FOR_SCORE = 2;

// --------------- Slug Normalization ---------------

/** Map various slug formats to canonical agent benchmark slugs */
const SLUG_ALIASES: Record<string, string> = {
  "terminal-bench": "terminal-bench",
  "terminalbench": "terminal-bench",
  "terminal_bench": "terminal-bench",
  "os-world": "os-world",
  "osworld": "os-world",
  "os_world": "os-world",
  "gaia": "gaia",
  "gaia-benchmark": "gaia",
  "gaia_benchmark": "gaia",
  "webarena": "webarena",
  "web-arena": "webarena",
  "web_arena": "webarena",
  "tau-bench": "tau-bench",
  "taubench": "tau-bench",
  "tau_bench": "tau-bench",
};

/**
 * Normalize an agent benchmark slug to its canonical form.
 * Returns null if the slug is not an agent benchmark.
 */
export function normalizeAgentSlug(slug: string): string | null {
  const normalized = slug.toLowerCase().trim();
  return SLUG_ALIASES[normalized] ?? null;
}

// --------------- Weight Computation ---------------

/**
 * Compute dynamic weights based on data coverage across all models.
 *
 * Benchmarks with more model scores get slightly higher weight,
 * reflecting greater statistical reliability. The adjustment is mild
 * (sqrt-based) to avoid over-weighting popular benchmarks.
 *
 * @param allScores - All agent benchmark scores for all models
 * @returns Weight per benchmark slug
 */
export function computeAgentBenchmarkWeights(
  allScores: Array<{ benchmarkSlug: string; modelId: string }>
): BenchmarkWeight[] {
  // Count unique models per benchmark
  const coverageMap = new Map<string, Set<string>>();
  for (const slug of AGENT_BENCHMARK_SLUGS) {
    coverageMap.set(slug, new Set());
  }

  for (const score of allScores) {
    const canonical = normalizeAgentSlug(score.benchmarkSlug);
    if (canonical && coverageMap.has(canonical)) {
      coverageMap.get(canonical)!.add(score.modelId);
    }
  }

  // Compute raw coverage counts
  const coverageCounts: Array<{ slug: string; count: number }> = [];
  for (const [slug, models] of coverageMap) {
    coverageCounts.push({ slug, count: models.size });
  }

  // If no data at all, return default equal weights
  const maxCount = Math.max(...coverageCounts.map((c) => c.count), 1);
  if (maxCount === 0) {
    return AGENT_BENCHMARK_SLUGS.map((slug) => ({
      slug,
      weight: DEFAULT_WEIGHTS[slug],
    }));
  }

  // Sqrt-based adjustment: benchmarks with more coverage get mild boost
  const rawWeights = coverageCounts.map((c) => ({
    slug: c.slug,
    rawWeight: c.count > 0
      ? DEFAULT_WEIGHTS[c.slug] * (0.7 + 0.3 * Math.sqrt(c.count / maxCount))
      : DEFAULT_WEIGHTS[c.slug] * 0.5, // Penalize benchmarks with zero data
  }));

  // Normalize to sum to 1.0
  const totalRaw = rawWeights.reduce((sum, w) => sum + w.rawWeight, 0);
  return rawWeights.map((w) => ({
    slug: w.slug,
    weight: totalRaw > 0 ? w.rawWeight / totalRaw : DEFAULT_WEIGHTS[w.slug],
  }));
}

// --------------- Score Computation ---------------

/**
 * Compute the composite agent score for a single model.
 *
 * @param modelScores - This model's agent benchmark scores
 * @param weights - Benchmark weights (from computeAgentBenchmarkWeights)
 * @param allModelScoresForRanking - Optional: all models' scores for percentile normalization.
 *   If not provided, raw normalized scores are used directly.
 * @returns AgentScoreResult or null if insufficient data
 */
export function computeAgentScore(
  modelScores: AgentBenchmarkScore[],
  weights: BenchmarkWeight[],
  allModelScoresForRanking?: Map<string, number[]>
): AgentScoreResult | null {
  // Filter to only agent benchmark scores
  const agentScores: Array<{
    canonical: string;
    rawScore: number;
    normalizedScore: number;
  }> = [];

  for (const score of modelScores) {
    const canonical = normalizeAgentSlug(score.benchmarkSlug);
    if (!canonical) continue;

    // Percentile normalization if ranking data is available
    let normalizedScore = score.scoreNormalized;
    if (allModelScoresForRanking && allModelScoresForRanking.has(canonical)) {
      const allScoresForBench = allModelScoresForRanking.get(canonical)!;
      normalizedScore = computePercentile(score.score, allScoresForBench);
    }

    agentScores.push({
      canonical,
      rawScore: score.score,
      normalizedScore,
    });
  }

  // Deduplicate: keep best score per benchmark
  const bestPerBenchmark = new Map<
    string,
    { rawScore: number; normalizedScore: number }
  >();
  for (const s of agentScores) {
    const existing = bestPerBenchmark.get(s.canonical);
    if (!existing || s.rawScore > existing.rawScore) {
      bestPerBenchmark.set(s.canonical, {
        rawScore: s.rawScore,
        normalizedScore: s.normalizedScore,
      });
    }
  }

  // Need minimum benchmark coverage
  if (bestPerBenchmark.size < MIN_BENCHMARKS_FOR_SCORE) {
    return null;
  }

  // Build weight lookup
  const weightMap = new Map<string, number>();
  for (const w of weights) {
    weightMap.set(w.slug, w.weight);
  }

  // Compute weighted average
  let weightedSum = 0;
  let totalWeight = 0;
  const breakdown: AgentScoreResult["breakdown"] = [];

  for (const [slug, scores] of bestPerBenchmark) {
    const weight = weightMap.get(slug) ?? 0.2;
    weightedSum += scores.normalizedScore * weight;
    totalWeight += weight;

    breakdown.push({
      benchmarkSlug: slug,
      rawScore: scores.rawScore,
      normalizedScore: scores.normalizedScore,
      weight,
    });
  }

  if (totalWeight === 0) return null;

  // Raw weighted average (rescaled to available weights)
  let agentScore = weightedSum / totalWeight;

  // Coverage penalty: models with fewer benchmarks get penalized
  // 2 benchmarks = 0.7x, 3 = 0.85x, 4 = 0.95x, 5 = 1.0x
  const coverageFraction = bestPerBenchmark.size / AGENT_BENCHMARK_SLUGS.length;
  const coveragePenalty = 0.5 + 0.5 * Math.sqrt(coverageFraction);
  agentScore *= coveragePenalty;

  // Clamp to 0-100
  agentScore = Math.round(Math.min(Math.max(agentScore, 0), 100) * 10) / 10;

  return {
    agentScore,
    benchmarkCount: bestPerBenchmark.size,
    breakdown,
  };
}

// --------------- Helpers ---------------

/**
 * Compute percentile rank of a value within a distribution.
 * Returns 0-100 where 100 means the value is the highest.
 */
function computePercentile(value: number, distribution: number[]): number {
  if (distribution.length === 0) return 50;
  if (distribution.length === 1) return value >= distribution[0] ? 100 : 0;

  const sorted = [...distribution].sort((a, b) => a - b);
  let rank = 0;
  for (const v of sorted) {
    if (v < value) rank++;
    else if (v === value) rank += 0.5;
  }

  return Math.round((rank / sorted.length) * 100 * 10) / 10;
}
