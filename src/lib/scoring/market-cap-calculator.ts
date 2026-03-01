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

// --------------- Provider Usage Estimates ---------------

/**
 * Curated monthly active user estimates for major AI providers.
 * These are rough order-of-magnitude estimates used as a proxy signal.
 * Source: public reports, press releases, third-party analytics.
 *
 * Key: provider name (lowercase). Value: estimated monthly active users.
 */
export const PROVIDER_USAGE_ESTIMATES: Record<string, number> = {
  openai: 400_000_000,
  anthropic: 50_000_000,
  google: 200_000_000,
  meta: 100_000_000,
  mistral: 15_000_000,
  deepseek: 40_000_000,
  xai: 20_000_000,
  cohere: 5_000_000,
  amazon: 10_000_000,
  microsoft: 30_000_000,
  nvidia: 8_000_000,
  perplexity: 25_000_000,
  "alibaba cloud": 20_000_000,
  "stability ai": 10_000_000,
  "hugging face": 5_000_000,
};

/**
 * Look up the estimated monthly active users for a model's provider.
 * Falls back to 1M for unknown providers.
 */
export function getProviderUsageEstimate(providerName: string): number {
  const normalized = providerName.toLowerCase().trim();

  // Direct match
  if (PROVIDER_USAGE_ESTIMATES[normalized] !== undefined) {
    return PROVIDER_USAGE_ESTIMATES[normalized];
  }

  // Partial match
  for (const [key, value] of Object.entries(PROVIDER_USAGE_ESTIMATES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Default fallback for unknown providers
  return 1_000_000;
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

  return Math.round(Math.min(weightedSum, 100) * 10) / 10;
}

// --------------- Market Cap ---------------

/**
 * Compute an estimated "market cap" representing monthly revenue potential.
 *
 * Formula:
 *   marketCap = popularityScore^1.5 * blendedPrice * scaleFactor
 *
 * The power law (1.5) reflects that more popular models capture
 * disproportionately more revenue (winner-take-most dynamics).
 *
 * @param popularityScore - 0-100 composite popularity score
 * @param blendedApiPrice - Average of input + output price per 1M tokens (USD)
 * @returns Estimated monthly revenue in USD (can be 0 for open-weight/free models)
 */
export function computeMarketCap(
  popularityScore: number,
  blendedApiPrice: number
): number {
  if (popularityScore <= 0) return 0;

  // For open-weight / free models, use a small nominal price
  // to still rank them by popularity
  const effectivePrice = Math.max(blendedApiPrice, 0.01);

  // Scale factor calibrated so that:
  // - A model with 80 popularity and $5/M blended price ~ $50M/month
  // - A model with 50 popularity and $1/M blended price ~ $5M/month
  const SCALE_FACTOR = 1400;

  const rawMarketCap =
    Math.pow(popularityScore, 1.5) * effectivePrice * SCALE_FACTOR;

  // Round to nearest thousand
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
