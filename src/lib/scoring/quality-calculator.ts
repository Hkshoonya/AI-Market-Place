/**
 * Quality Score Calculator
 *
 * Computes a composite quality_score (0-100) for every model.
 *
 * Key design decisions:
 *  - Proprietary models (OpenAI, Anthropic, Google etc.) have NO HuggingFace
 *    presence, so HF-based signals (downloads, likes) are excluded from their
 *    scoring denominator entirely — they should not be penalized for this.
 *  - When benchmarks are missing but Chatbot Arena ELO is available, ELO
 *    absorbs the benchmark weight (both measure model quality).
 *  - Coverage penalty is softened: models with 3+ signals get near-full credit.
 *  - Category-specific weight profiles so LLMs prioritize benchmarks+ELO while
 *    image-gen models prioritize community+recency.
 *  - Proxy quality signals allow models without direct benchmarks/ELO to score
 *    above the base cap (up to 65) based on provider reputation and model size.
 */

export interface QualityInputs {
  /** Existing value_score from Artificial Analysis (may be null) */
  existingScore: number | null;
  /** HuggingFace downloads */
  hfDownloads: number | null;
  /** HuggingFace likes */
  hfLikes: number | null;
  /** Average normalized benchmark score (0-100, null if no benchmarks) */
  avgBenchmarkScore: number | null;
  /** Individual benchmark scores for weighted average calculation */
  benchmarkScores: Array<{ slug: string; score: number }> | null;
  /** Release date ISO string (null if unknown) */
  releaseDate: string | null;
  /** Whether the model has open weights */
  isOpenWeights: boolean;
  /** Trending/popularity score from external sources */
  trendingScore: number | null;
  /** Number of news mentions in last 30 days */
  newsMentions: number;
  /** Chatbot Arena ELO rating */
  eloScore: number | null;
  /** Rank in arena */
  eloRank: number | null;
  /** Model category for weight selection */
  category: string;
  /** Average benchmark score of other models from the same provider (proxy signal) */
  providerAvgBenchmark: number | null;
  /** Model parameter count in billions (proxy signal) */
  parameterCount: number | null;
}

export interface NormalizationStats {
  maxDownloads: number;
  maxLikes: number;
  maxNewsMentions: number;
}

/**
 * Compute normalization stats from the full model set.
 * Call once, then pass to calculateQualityScore for each model.
 */
export function computeNormalizationStats(
  allModels: Array<{
    hf_downloads: number | null;
    hf_likes: number | null;
    newsMentions: number;
  }>
): NormalizationStats {
  let maxDownloads = 1;
  let maxLikes = 1;
  let maxNewsMentions = 1;

  for (const m of allModels) {
    if (m.hf_downloads && m.hf_downloads > maxDownloads)
      maxDownloads = m.hf_downloads;
    if (m.hf_likes && m.hf_likes > maxLikes) maxLikes = m.hf_likes;
    if (m.newsMentions > maxNewsMentions) maxNewsMentions = m.newsMentions;
  }

  return { maxDownloads, maxLikes, maxNewsMentions };
}

interface WeightProfile {
  popularity: number;
  benchmarks: number;
  elo: number;
  recency: number;
  community: number;
  openness: number;
}

const CATEGORY_WEIGHTS: Record<string, WeightProfile> = {
  llm:              { popularity: 10, benchmarks: 30, elo: 30, recency: 10, community: 10, openness: 10 },
  multimodal:       { popularity: 10, benchmarks: 25, elo: 25, recency: 15, community: 15, openness: 10 },
  image_generation: { popularity: 20, benchmarks: 15, elo: 10, recency: 20, community: 25, openness: 10 },
  code:             { popularity: 10, benchmarks: 35, elo: 25, recency: 10, community: 10, openness: 10 },
  agentic_browser:  { popularity: 15, benchmarks: 30, elo: 15, recency: 15, community: 15, openness: 10 },
  default:          { popularity: 15, benchmarks: 25, elo: 20, recency: 15, community: 15, openness: 10 },
};

/**
 * Benchmark importance weights for weighted averaging.
 * Multiple slug variants are listed to handle DB inconsistencies
 * (some use hyphens, some use underscores).
 */
const BENCHMARK_IMPORTANCE: Record<string, number> = {
  // Core benchmarks (Artificial Analysis + Open LLM Leaderboard)
  "mmlu": 1.0,
  "humaneval": 1.2,
  "math": 1.1,
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
};

function computeWeightedBenchmarkAvg(scores: Array<{ slug: string; score: number }>): number {
  if (scores.length === 0) return 0;
  let weightedSum = 0;
  let totalImportance = 0;
  for (const s of scores) {
    // Normalize slug to handle both hyphen and underscore variants
    const normalizedSlug = s.slug.toLowerCase().replace(/_/g, "-");
    const importance = BENCHMARK_IMPORTANCE[s.slug] ?? BENCHMARK_IMPORTANCE[normalizedSlug] ?? 1.0;
    weightedSum += s.score * importance;
    totalImportance += importance;
  }
  return totalImportance > 0 ? weightedSum / totalImportance : 0;
}

/**
 * Compute a proxy quality signal for models without direct benchmarks/ELO.
 * Returns 0-1 scale: 0 = no proxy evidence, 1 = strong proxy evidence.
 */
function computeProxyQualitySignal(inputs: QualityInputs): number {
  let proxyScore = 0;
  let proxySignals = 0;

  // Provider reputation: if other models from this provider score well
  if (inputs.providerAvgBenchmark != null && inputs.providerAvgBenchmark > 0) {
    // Normalize to 0-1 (assuming avg benchmark around 50-80)
    const providerSignal = Math.min(inputs.providerAvgBenchmark / 80, 1.0);
    proxyScore += providerSignal * 0.6; // 60% weight to provider reputation
    proxySignals++;
  }

  // Parameter count: larger models in same family tend to be better
  if (inputs.parameterCount != null && inputs.parameterCount > 0) {
    // Log-scale: 1B=0.0, 10B=0.33, 100B=0.67, 1000B=1.0
    const paramSignal = Math.min(Math.log10(inputs.parameterCount) / 3, 1.0);
    proxyScore += paramSignal * 0.4; // 40% weight to model size
    proxySignals++;
  }

  if (proxySignals === 0) return 0;
  return Math.min(proxyScore, 1.0);
}

/**
 * Calculate quality score for a single model.
 *
 * Weights are category-dependent (see CATEGORY_WEIGHTS).
 * Missing signals are excluded and remaining signals reweighted proportionally.
 *
 * Proprietary models: HF-based signals (popularity, community/likes) are
 * structurally unavailable and excluded from the max weight denominator.
 */
export function calculateQualityScore(
  inputs: QualityInputs,
  stats: NormalizationStats
): number {
  const weights = CATEGORY_WEIGHTS[inputs.category] ?? CATEGORY_WEIGHTS.default;
  const isProprietary = !inputs.isOpenWeights;

  // Track which signals are structurally available for this model type
  // Proprietary models can't have HF downloads/likes — don't penalize them
  const isHfAvailable = !isProprietary || (inputs.hfDownloads != null && inputs.hfDownloads > 0);

  const signals: Array<{ name: string; score: number; weight: number }> = [];
  let maxWeight = 0; // Total weight of signals that COULD be available

  // 1. Popularity: log-normalized downloads
  if (isHfAvailable) {
    maxWeight += weights.popularity;
    if (inputs.hfDownloads != null && inputs.hfDownloads > 0) {
      const logScore =
        (Math.log10(inputs.hfDownloads + 1) /
          Math.log10(stats.maxDownloads + 1)) *
        100;
      signals.push({ name: "popularity", score: Math.min(logScore, 100), weight: weights.popularity });
    }
  }

  // 2. Benchmarks: use weighted average if individual scores available
  const benchmarkScore = inputs.benchmarkScores && inputs.benchmarkScores.length > 0
    ? computeWeightedBenchmarkAvg(inputs.benchmarkScores)
    : inputs.avgBenchmarkScore;

  maxWeight += weights.benchmarks;
  if (benchmarkScore != null && benchmarkScore > 0) {
    signals.push({ name: "benchmarks", score: benchmarkScore, weight: weights.benchmarks });
  }

  // 3. ELO (Chatbot Arena)
  // If benchmarks are missing but ELO is present, ELO absorbs benchmark weight
  maxWeight += weights.elo;
  if (inputs.eloScore != null && inputs.eloScore > 0) {
    const normalizedElo = Math.min(Math.max((inputs.eloScore - 800) / (1400 - 800) * 100, 0), 100);
    let eloWeight = weights.elo;

    // If no benchmarks, let ELO absorb benchmark weight (both measure quality)
    if (benchmarkScore == null || benchmarkScore <= 0) {
      eloWeight += weights.benchmarks;
    }

    signals.push({ name: "elo", score: normalizedElo, weight: eloWeight });
  }

  // 4. Recency: smooth exponential decay (half-life ~12 months, floor at 10)
  maxWeight += weights.recency;
  if (inputs.releaseDate) {
    const ageMs = Date.now() - new Date(inputs.releaseDate).getTime();
    const ageMonths = ageMs / (30 * 24 * 60 * 60 * 1000);
    const recencyScore = Math.max(100 * Math.exp(-ageMonths / 18), 10);
    signals.push({ name: "recency", score: recencyScore, weight: weights.recency });
  }

  // 5. Community: log-normalized likes + news mentions + trending boost
  // For proprietary models without HF likes, only news matters
  const hasLikes = inputs.hfLikes != null && inputs.hfLikes > 0;
  const hasNews = inputs.newsMentions > 0;

  if (isHfAvailable || hasNews) {
    maxWeight += weights.community;
    if (hasLikes || hasNews) {
      const likeScore = hasLikes
        ? (Math.log10(inputs.hfLikes! + 1) / Math.log10(stats.maxLikes + 1)) * 100
        : 0;
      const newsScore = hasNews
        ? (Math.log10(inputs.newsMentions + 1) / Math.log10(stats.maxNewsMentions + 1)) * 100
        : 0;
      // For proprietary models, community = news only (full weight)
      // For open models, community = (likes + news) / 2
      let communityScore = hasLikes
        ? Math.min((likeScore + newsScore) / 2, 100)
        : Math.min(newsScore, 100);

      // Blend trendingScore as a boost (up to +20 on community sub-score)
      if (inputs.trendingScore != null && inputs.trendingScore > 0) {
        const trendingBoost = Math.min((inputs.trendingScore / 50) * 20, 20);
        communityScore = Math.min(communityScore + trendingBoost, 100);
      }

      signals.push({ name: "community", score: communityScore, weight: weights.community });
    }
  } else if (isProprietary && hasNews) {
    // Proprietary model with only news mentions
    maxWeight += weights.community;
    const newsScore = (Math.log10(inputs.newsMentions + 1) / Math.log10(stats.maxNewsMentions + 1)) * 100;
    signals.push({ name: "community", score: Math.min(newsScore, 100), weight: weights.community });
  }

  // 6. Openness: open weights get bonus
  maxWeight += weights.openness;
  signals.push({
    name: "openness",
    score: inputs.isOpenWeights ? 100 : 50,
    weight: weights.openness,
  });

  // Compute weighted average (reweight proportionally for present signals)
  if (signals.length === 0) return 0;

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const weightedSum = signals.reduce(
    (sum, s) => sum + s.score * (s.weight / totalWeight),
    0
  );

  // Coverage penalty: softer curve based on signal count and weight coverage
  // 3+ real signals = near full credit; 1-2 signals = moderate penalty
  const signalCount = signals.length;
  const weightCoverage = maxWeight > 0 ? totalWeight / maxWeight : 0;
  // Use the better of count-based or weight-based coverage
  const countCoverage = Math.min(signalCount / 4, 1.0);  // 4+ signals = full
  const coverageFraction = Math.max(countCoverage, weightCoverage);
  // Soft penalty: sqrt curve instead of linear (less harsh)
  const coveragePenalty = Math.sqrt(Math.max(coverageFraction, 0.25));

  let penalizedScore = weightedSum * coveragePenalty;

  // Quality-signal gate: models without ANY quality signal (benchmarks or ELO)
  // are capped based on proxy signals.
  // - No proxy signals: hard cap at 50
  // - With proxy signals: cap at 50 + (proxy * 15), max 65
  // This prevents popular-but-unverified models from ranking above quality-verified flagships,
  // while still allowing well-known models from top providers to score reasonably.
  const hasQualitySignal = signals.some(s => s.name === "benchmarks" || s.name === "elo");
  if (!hasQualitySignal) {
    const proxyScore = computeProxyQualitySignal(inputs);
    const cap = 50 + proxyScore * 15; // max 65
    penalizedScore = Math.min(penalizedScore, cap);
  }

  const computedScore = Math.round(Math.min(penalizedScore, 100) * 10) / 10;

  // Blend with existing AA score if available
  if (inputs.existingScore != null && inputs.existingScore > 0) {
    return Math.round((0.6 * inputs.existingScore + 0.4 * computedScore) * 10) / 10;
  }

  return computedScore;
}

/**
 * Compute rankings from scored models.
 * Returns models with overall_rank and category_rank assigned.
 */
export function computeRankings(
  models: Array<{
    id: string;
    category: string;
    qualityScore: number;
    marketCap?: number;
    popularityScore?: number;
  }>
): Array<{
  id: string;
  overall_rank: number;
  category_rank: number;
}> {
  // Composite ranking: 50% market cap rank + 30% quality rank + 20% popularity rank
  // This ensures models are ranked by real market importance first,
  // with quality and popularity as secondary signals.
  const withSignals = models.filter((m) => m.qualityScore > 0);

  // Sort by each signal to get per-signal ranks
  const byMarketCap = [...withSignals].sort(
    (a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)
  );
  const byQuality = [...withSignals].sort(
    (a, b) => b.qualityScore - a.qualityScore
  );
  const byPopularity = [...withSignals].sort(
    (a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0)
  );

  // Build rank maps (lower rank = better)
  const mcapRank = new Map(byMarketCap.map((m, i) => [m.id, i + 1]));
  const qualRank = new Map(byQuality.map((m, i) => [m.id, i + 1]));
  const popRank = new Map(byPopularity.map((m, i) => [m.id, i + 1]));

  // Composite score: weighted average of ranks
  const compositeScores = withSignals.map((m) => ({
    ...m,
    compositeRank:
      0.5 * (mcapRank.get(m.id) ?? withSignals.length) +
      0.3 * (qualRank.get(m.id) ?? withSignals.length) +
      0.2 * (popRank.get(m.id) ?? withSignals.length),
  }));

  const sorted = compositeScores.sort((a, b) => a.compositeRank - b.compositeRank);

  const result = sorted.map((m, i) => ({
    id: m.id,
    overall_rank: i + 1,
    category_rank: 0,
    category: m.category,
  }));

  const categoryGroups = new Map<string, typeof result>();
  for (const m of result) {
    if (!categoryGroups.has(m.category)) categoryGroups.set(m.category, []);
    categoryGroups.get(m.category)!.push(m);
  }
  for (const group of categoryGroups.values()) {
    group.forEach((m, i) => {
      m.category_rank = i + 1;
    });
  }

  return result.map((m) => ({
    id: m.id,
    overall_rank: m.overall_rank,
    category_rank: m.category_rank,
  }));
}
