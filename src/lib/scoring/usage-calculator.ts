/**
 * Usage Score Calculator (Lens 2)
 *
 * Adoption-weighted ranking: "What are people actually using?"
 *
 * Formula:
 *   usageScore = downloads * 0.30 + providerMAU * 0.20 + stars * 0.15
 *              + news * 0.15 + trending * 0.10 + likes * 0.10
 *
 * Key design: separate normalization pools for open vs proprietary models.
 * No coverage penalty — missing signals contribute 0, remaining reweighted.
 */

export interface UsageInputs {
  downloads: number;
  likes: number;
  stars: number;
  newsMentions: number;
  providerUsageEstimate: number;
  trendingScore: number;
  isOpenWeights: boolean;
}

export interface UsageNormStats {
  // Open model pool
  openMaxDownloads: number;
  openMaxLikes: number;
  openMaxStars: number;
  openMaxTrending: number;
  // Proprietary model pool
  propMaxMAU: number;
  propMaxNews: number;
  propMaxTrending: number;
  // Shared (used for both pools)
  maxNews: number;
}

const WEIGHTS = {
  downloads: 0.30,
  likes: 0.10,
  stars: 0.15,
  news: 0.15,
  usage: 0.20,
  trending: 0.10,
};

function logNorm(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min((Math.log10(value + 1) / Math.log10(max + 1)) * 100, 100);
}

/**
 * Compute normalization stats with separate pools for open vs proprietary.
 */
export function computeUsageNormStats(
  models: Array<UsageInputs>
): UsageNormStats {
  const stats: UsageNormStats = {
    openMaxDownloads: 1, openMaxLikes: 1, openMaxStars: 1, openMaxTrending: 1,
    propMaxMAU: 1, propMaxNews: 1, propMaxTrending: 1,
    maxNews: 1,
  };

  for (const m of models) {
    if (m.newsMentions > stats.maxNews) stats.maxNews = m.newsMentions;

    if (m.isOpenWeights) {
      if (m.downloads > stats.openMaxDownloads) stats.openMaxDownloads = m.downloads;
      if (m.likes > stats.openMaxLikes) stats.openMaxLikes = m.likes;
      if (m.stars > stats.openMaxStars) stats.openMaxStars = m.stars;
      if (m.trendingScore > stats.openMaxTrending) stats.openMaxTrending = m.trendingScore;
    } else {
      if (m.providerUsageEstimate > stats.propMaxMAU) stats.propMaxMAU = m.providerUsageEstimate;
      if (m.newsMentions > stats.propMaxNews) stats.propMaxNews = m.newsMentions;
      if (m.trendingScore > stats.propMaxTrending) stats.propMaxTrending = m.trendingScore;
    }
  }

  return stats;
}

/**
 * Compute usage score for a single model.
 * Separate normalization for open vs proprietary.
 * No coverage penalty — missing signals reweighted proportionally.
 */
export function computeUsageScore(
  inputs: UsageInputs,
  stats: UsageNormStats
): number {
  const signals: Array<{ score: number; weight: number }> = [];

  if (inputs.isOpenWeights) {
    // Open model signals
    if (inputs.downloads > 0) {
      signals.push({ score: logNorm(inputs.downloads, stats.openMaxDownloads), weight: WEIGHTS.downloads });
    }
    if (inputs.likes > 0) {
      signals.push({ score: logNorm(inputs.likes, stats.openMaxLikes), weight: WEIGHTS.likes });
    }
    if (inputs.stars > 0) {
      signals.push({ score: logNorm(inputs.stars, stats.openMaxStars), weight: WEIGHTS.stars });
    }
    if (inputs.trendingScore > 0) {
      const norm = stats.openMaxTrending > 0 ? (inputs.trendingScore / stats.openMaxTrending) * 100 : 0;
      signals.push({ score: Math.min(norm, 100), weight: WEIGHTS.trending });
    }
    // Open models can also have news
    if (inputs.newsMentions > 0) {
      signals.push({ score: logNorm(inputs.newsMentions, stats.maxNews), weight: WEIGHTS.news });
    }
    // Provider MAU still applies (e.g., Meta's LLaMA has Meta's MAU)
    if (inputs.providerUsageEstimate > 0) {
      signals.push({ score: logNorm(inputs.providerUsageEstimate, stats.propMaxMAU), weight: WEIGHTS.usage });
    }
  } else {
    // Proprietary model signals
    if (inputs.providerUsageEstimate > 0) {
      signals.push({ score: logNorm(inputs.providerUsageEstimate, stats.propMaxMAU), weight: WEIGHTS.usage });
    }
    if (inputs.newsMentions > 0) {
      signals.push({ score: logNorm(inputs.newsMentions, stats.propMaxNews), weight: WEIGHTS.news });
    }
    if (inputs.trendingScore > 0) {
      const norm = stats.propMaxTrending > 0 ? (inputs.trendingScore / stats.propMaxTrending) * 100 : 0;
      signals.push({ score: Math.min(norm, 100), weight: WEIGHTS.trending });
    }
    // Proprietary models might have HF downloads (rare but possible)
    if (inputs.downloads > 0) {
      signals.push({ score: logNorm(inputs.downloads, stats.openMaxDownloads), weight: WEIGHTS.downloads });
    }
    if (inputs.likes > 0) {
      signals.push({ score: logNorm(inputs.likes, stats.openMaxLikes), weight: WEIGHTS.likes });
    }
    if (inputs.stars > 0) {
      signals.push({ score: logNorm(inputs.stars, stats.openMaxStars), weight: WEIGHTS.stars });
    }
  }

  if (signals.length === 0) return 0;

  // Reweight proportionally — no coverage penalty
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const score = signals.reduce((sum, s) => sum + s.score * (s.weight / totalWeight), 0);

  return Math.round(Math.min(score, 100) * 10) / 10;
}
