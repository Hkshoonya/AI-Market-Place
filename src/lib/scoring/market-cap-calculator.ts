/**
 * Market Cap Calculator
 *
 * Computes an estimated "AI Market Cap" for models based on:
 *   - Popularity score: weighted combination of community signals
 *   - Blended API price: average of input + output pricing
 *
 * Market Cap = f(popularity, price) representing estimated monthly revenue potential.
 *
 * This is a synthetic metric designed for ranking and comparison,
 * not an actual financial valuation.
 */

import {
  MARKET_CAP_SCALE_FACTOR,
  USAGE_EXPONENT,
  MAX_PRICE_NORMALIZATION,
  MIN_EFFECTIVE_PRICE,
  POPULARITY_COVERAGE_PENALTY,
  getCoveragePenalty,
} from "@/lib/constants/scoring";

// Re-export for backward compatibility (consumers should import from @/lib/constants/scoring)
export { PROVIDER_USAGE_ESTIMATES, getProviderUsageEstimate } from "@/lib/constants/scoring";

// --------------- Types ---------------

export interface PopularityInputs {
  /** HuggingFace downloads (total or monthly) */
  downloads: number;
  /** HuggingFace likes */
  likes: number;
  /** GitHub stars */
  stars: number;
  /** News mentions in last 30 days */
  newsMentions: number;
  /** Provider-level monthly active user estimate */
  providerUsageEstimate: number;
  /** Trending score from external sources (0-100) */
  trendingScore: number;
}

export interface PopularityStats {
  /** Maximum downloads across all models */
  maxDownloads: number;
  /** Maximum likes across all models */
  maxLikes: number;
  /** Maximum stars across all models */
  maxStars: number;
  /** Maximum news mentions across all models */
  maxNewsMentions: number;
  /** Maximum provider usage estimate */
  maxUsageEstimate: number;
  /** Maximum trending score */
  maxTrendingScore: number;
}

// --------------- Popularity Score ---------------

/**
 * Compute a popularity score (0-100) for a model.
 *
 * Weights:
 *   - 30% downloads (HuggingFace)
 *   - 15% likes (HuggingFace)
 *   - 15% stars (GitHub)
 *   - 15% news mentions
 *   - 15% provider usage estimate
 *   - 10% trending score
 *
 * All signals are log-normalized relative to the max across all models.
 * Missing signals are excluded and remaining signals reweighted.
 */
export function computePopularityScore(
  inputs: PopularityInputs,
  stats: PopularityStats
): number {
  const weights = {
    downloads: 0.30,
    likes: 0.15,
    stars: 0.15,
    news: 0.15,
    usage: 0.15,
    trending: 0.10,
  };

  const signals: Array<{ score: number; weight: number }> = [];

  // Downloads (log-normalized)
  if (inputs.downloads > 0 && stats.maxDownloads > 0) {
    const score = (Math.log10(inputs.downloads + 1) / Math.log10(stats.maxDownloads + 1)) * 100;
    signals.push({ score: Math.min(score, 100), weight: weights.downloads });
  }

  // Likes (log-normalized)
  if (inputs.likes > 0 && stats.maxLikes > 0) {
    const score = (Math.log10(inputs.likes + 1) / Math.log10(stats.maxLikes + 1)) * 100;
    signals.push({ score: Math.min(score, 100), weight: weights.likes });
  }

  // Stars (log-normalized)
  if (inputs.stars > 0 && stats.maxStars > 0) {
    const score = (Math.log10(inputs.stars + 1) / Math.log10(stats.maxStars + 1)) * 100;
    signals.push({ score: Math.min(score, 100), weight: weights.stars });
  }

  // News mentions (log-normalized)
  if (inputs.newsMentions > 0 && stats.maxNewsMentions > 0) {
    const score = (Math.log10(inputs.newsMentions + 1) / Math.log10(stats.maxNewsMentions + 1)) * 100;
    signals.push({ score: Math.min(score, 100), weight: weights.news });
  }

  // Provider usage estimate (log-normalized)
  if (inputs.providerUsageEstimate > 0 && stats.maxUsageEstimate > 0) {
    const score = (Math.log10(inputs.providerUsageEstimate + 1) / Math.log10(stats.maxUsageEstimate + 1)) * 100;
    signals.push({ score: Math.min(score, 100), weight: weights.usage });
  }

  // Trending score (direct, already 0-100 scale)
  if (inputs.trendingScore > 0 && stats.maxTrendingScore > 0) {
    const score = (inputs.trendingScore / stats.maxTrendingScore) * 100;
    signals.push({ score: Math.min(score, 100), weight: weights.trending });
  }

  if (signals.length === 0) return 0;

  // Reweight proportionally for present signals
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const weightedSum = signals.reduce(
    (sum, s) => sum + s.score * (s.weight / totalWeight),
    0
  );

  // Signal coverage penalty: models with fewer active signals get a lower
  // confidence multiplier. This prevents a single signal (e.g., provider
  // usage alone) from inflating a model to 100 when there's no community
  // engagement data. Without this, every OpenAI model scores 100 regardless
  // of whether it's GPT-4o or a niche moderation endpoint.
  //
  // Coverage factors (from POPULARITY_COVERAGE_PENALTY):
  //   1 signal  → 0.50 (max score ~50)
  //   2 signals → 0.70 (max score ~70)
  //   3 signals → 0.85 (max score ~85)
  //   4+ signals → 1.00 (full score)
  const TOTAL_POSSIBLE_SIGNALS = 6;
  const coverageFactor = getCoveragePenalty(POPULARITY_COVERAGE_PENALTY, signals.length);

  const adjustedScore = weightedSum * coverageFactor;

  return Math.round(Math.min(adjustedScore, 100) * 10) / 10;
}

// --------------- Market Cap ---------------

/**
 * Compute an estimated "market cap" representing monthly revenue potential.
 *
 * Revised formula:
 *   marketCap = usageScore^USAGE_EXPONENT * priceWeight * MARKET_CAP_SCALE_FACTOR
 *
 * Where:
 *   - usageScore = usage lens score (0-100)
 *   - priceWeight = log10(blendedPrice + 1) / log10(MAX_PRICE_NORMALIZATION + 1) — log-normalized
 *   - MARKET_CAP_SCALE_FACTOR calibrated so GPT-4o ~ $200M/month
 *
 * @param usageScore - 0-100 usage lens score (replaces raw popularityScore)
 * @param blendedApiPrice - Average of input + output price per 1M tokens (USD)
 * @returns Estimated monthly revenue in USD
 */
export function computeMarketCap(
  usageScore: number,
  blendedApiPrice: number
): number {
  if (usageScore <= 0) return 0;

  // Minimum effective price: MIN_EFFECTIVE_PRICE for free/open models
  const effectivePrice = Math.max(blendedApiPrice, MIN_EFFECTIVE_PRICE);

  // Log-normalize price so it matters but doesn't dominate
  // $0.10 -> 0.08, $1 -> 0.23, $5 -> 0.53, $15 -> 0.90, $20 -> 1.0
  const priceWeight = Math.log10(effectivePrice + 1) / Math.log10(MAX_PRICE_NORMALIZATION + 1);

  // MARKET_CAP_SCALE_FACTOR calibrated:
  // usage=95, price=$15 (GPT-4o) -> 95^1.2 * 0.90 * 1300 ~ $200M
  // usage=80, price=$5 (mid-tier) -> 80^1.2 * 0.53 * 1300 ~ $90M
  const rawMarketCap =
    Math.pow(usageScore, USAGE_EXPONENT) * priceWeight * MARKET_CAP_SCALE_FACTOR;

  return Math.round(rawMarketCap / 1000) * 1000;
}

/**
 * Compute normalization stats from a set of models.
 * Call once for the full model set, then pass to computePopularityScore for each model.
 */
export function computePopularityStats(
  models: Array<{
    downloads: number;
    likes: number;
    stars: number;
    newsMentions: number;
    providerUsageEstimate: number;
    trendingScore: number;
  }>
): PopularityStats {
  let maxDownloads = 1;
  let maxLikes = 1;
  let maxStars = 1;
  let maxNewsMentions = 1;
  let maxUsageEstimate = 1;
  let maxTrendingScore = 1;

  for (const m of models) {
    if (m.downloads > maxDownloads) maxDownloads = m.downloads;
    if (m.likes > maxLikes) maxLikes = m.likes;
    if (m.stars > maxStars) maxStars = m.stars;
    if (m.newsMentions > maxNewsMentions) maxNewsMentions = m.newsMentions;
    if (m.providerUsageEstimate > maxUsageEstimate) maxUsageEstimate = m.providerUsageEstimate;
    if (m.trendingScore > maxTrendingScore) maxTrendingScore = m.trendingScore;
  }

  return { maxDownloads, maxLikes, maxStars, maxNewsMentions, maxUsageEstimate, maxTrendingScore };
}
