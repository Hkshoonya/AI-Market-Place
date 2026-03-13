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

import { EVIDENCE_COVERAGE_PENALTY, getCoveragePenalty } from "@/lib/constants/scoring";
import {
  logNormalizeSignal,
  addSignal,
  weightedBenchmarkAvg,
  normalizeElo,
  computeRecencyScore,
} from "@/lib/scoring/scoring-helpers";
import { computeCommunitySignal } from "@/lib/scoring/community-signal";
import { getCorroborationMultiplier, type SourceCoverage } from "@/lib/source-coverage";
export { computeCommunitySignal } from "@/lib/scoring/community-signal";

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
  /** Diversity/corroboration information for this model's evidence graph */
  sourceCoverage: SourceCoverage | null;
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

type Signal = { name: string; score: number; weight: number } | null;

// --------------- Sub-functions ---------------

/**
 * Compute popularity signal from HF downloads (log-normalized).
 * Returns null if HF signals are not available for this model type,
 * or if there are no downloads to normalize.
 */
function computePopularitySignal(
  inputs: QualityInputs,
  stats: NormalizationStats,
  weights: WeightProfile,
  isHfAvailable: boolean
): Signal {
  if (!isHfAvailable) return null;
  if (inputs.hfDownloads == null || inputs.hfDownloads <= 0) return null;
  const logScore = logNormalizeSignal(inputs.hfDownloads, stats.maxDownloads);
  return { name: "popularity", score: logScore, weight: weights.popularity };
}

/**
 * Compute benchmark signal from individual or aggregated scores.
 * Returns null if no benchmark data is available.
 */
function computeBenchmarkSignal(
  inputs: QualityInputs,
  weights: WeightProfile
): Signal {
  const benchmarkScore =
    inputs.benchmarkScores && inputs.benchmarkScores.length > 0
      ? weightedBenchmarkAvg(inputs.benchmarkScores)
      : inputs.avgBenchmarkScore;

  if (benchmarkScore == null || benchmarkScore <= 0) return null;
  return { name: "benchmarks", score: benchmarkScore, weight: weights.benchmarks };
}

/**
 * Compute ELO signal from Chatbot Arena rating.
 * When benchmarks are absent, ELO absorbs benchmark weight (both measure quality).
 * Returns null if no ELO score is available.
 */
function computeEloSignal(
  inputs: QualityInputs,
  weights: WeightProfile,
  hasBenchmarks: boolean
): Signal {
  if (inputs.eloScore == null || inputs.eloScore <= 0) return null;
  const normalizedElo = normalizeElo(inputs.eloScore);
  let eloWeight = weights.elo;
  if (!hasBenchmarks) {
    eloWeight += weights.benchmarks;
  }
  return { name: "elo", score: normalizedElo, weight: eloWeight };
}

/**
 * Compute recency signal using exponential decay (half-life 18 months, floor 10).
 * Returns null if no release date is available.
 */
function computeRecencySignal(
  inputs: QualityInputs,
  weights: WeightProfile
): Signal {
  if (!inputs.releaseDate) return null;
  const recencyScore = computeRecencyScore(inputs.releaseDate, {
    halfLifeMonths: 18,
    floor: 10,
  });
  return { name: "recency", score: recencyScore, weight: weights.recency };
}

/**
 * Compute openness signal (open weights bonus).
 * Always returns a signal — open=100, proprietary=50.
 */
function computeOpennessSignal(
  inputs: QualityInputs,
  weights: WeightProfile
): Signal {
  return {
    name: "openness",
    score: inputs.isOpenWeights ? 100 : 50,
    weight: weights.openness,
  };
}

// --------------- Proxy Quality Gate ---------------

/**
 * Compute a proxy quality signal for models without direct benchmarks/ELO.
 * Returns 0-1 scale: 0 = no proxy evidence, 1 = strong proxy evidence.
 */
function computeProxyQualitySignal(inputs: QualityInputs): number {
  let proxyScore = 0;
  let proxySignals = 0;

  // Provider reputation: if other models from this provider score well
  if (inputs.providerAvgBenchmark != null && inputs.providerAvgBenchmark > 0) {
    const providerSignal = Math.min(inputs.providerAvgBenchmark / 80, 1.0);
    proxyScore += providerSignal * 0.6;
    proxySignals++;
  }

  // Parameter count: larger models in same family tend to be better
  if (inputs.parameterCount != null && inputs.parameterCount > 0) {
    const paramSignal = Math.min(Math.log10(inputs.parameterCount) / 3, 1.0);
    proxyScore += paramSignal * 0.4;
    proxySignals++;
  }

  if (proxySignals === 0) return 0;
  return Math.min(proxyScore, 1.0);
}

// --------------- Coordinator ---------------

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
  const isHfAvailable = !isProprietary || (inputs.hfDownloads != null && inputs.hfDownloads > 0);

  const signals: Array<{ name: string; score: number; weight: number }> = [];

  // Collect signals (each sub-function returns null when data is unavailable)
  const benchmarkSignal = computeBenchmarkSignal(inputs, weights);
  const hasBenchmarks = benchmarkSignal != null;

  const rawSignals = [
    computePopularitySignal(inputs, stats, weights, isHfAvailable),
    benchmarkSignal,
    computeEloSignal(inputs, weights, hasBenchmarks),
    computeRecencySignal(inputs, weights),
    computeCommunitySignal(inputs, stats, weights, isProprietary, isHfAvailable),
    computeOpennessSignal(inputs, weights),
  ];
  for (const sig of rawSignals) {
    if (sig) addSignal(signals, sig.name, sig.score, sig.weight);
  }

  // Compute weighted average (reweight proportionally for present signals)
  if (signals.length === 0) return 0;

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const weightedSum = signals.reduce(
    (sum, s) => sum + s.score * (s.weight / totalWeight),
    0
  );

  // Coverage penalty: discrete steps based on EVIDENCE signal count.
  const evidenceSignals = signals.filter(s => s.name !== "openness" && s.name !== "recency");
  const evidenceCount = evidenceSignals.length;

  if (evidenceCount === 0) return 0;
  const coveragePenalty = getCoveragePenalty(EVIDENCE_COVERAGE_PENALTY, evidenceCount);

  let penalizedScore = weightedSum * coveragePenalty;

  // Quality-signal gate: models without ANY quality signal (benchmarks or ELO)
  const hasQualitySignal = signals.some(s => s.name === "benchmarks" || s.name === "elo");
  if (!hasQualitySignal) {
    const proxyScore = computeProxyQualitySignal(inputs);
    const cap = 50 + proxyScore * 15;
    penalizedScore = Math.min(penalizedScore, cap);
  }

  const computedScore = Math.round(Math.min(penalizedScore, 100) * 10) / 10;
  const corroborationAdjusted = Math.round(
    Math.min(computedScore * getCorroborationMultiplier(inputs.sourceCoverage), 100) * 10
  ) / 10;

  // Blend with existing AA score if available
  if (inputs.existingScore != null && inputs.existingScore > 0) {
    return Math.round((0.6 * inputs.existingScore + 0.4 * corroborationAdjusted) * 10) / 10;
  }

  return corroborationAdjusted;
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
  const withSignals = models.filter((m) => m.qualityScore > 0);

  const byMarketCap = [...withSignals].sort(
    (a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)
  );
  const byQuality = [...withSignals].sort(
    (a, b) => b.qualityScore - a.qualityScore
  );
  const byPopularity = [...withSignals].sort(
    (a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0)
  );

  const mcapRank = new Map(byMarketCap.map((m, i) => [m.id, i + 1]));
  const qualRank = new Map(byQuality.map((m, i) => [m.id, i + 1]));
  const popRank = new Map(byPopularity.map((m, i) => [m.id, i + 1]));

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
