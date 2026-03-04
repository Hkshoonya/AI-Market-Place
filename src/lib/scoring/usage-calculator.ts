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

import { logNormalizeSignal, addSignal } from "@/lib/scoring/scoring-helpers";

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
  const signals: Array<{ name: string; score: number; weight: number }> = [];

  // Single code path: select the correct normalization pool per signal based on isOpenWeights.
  // Downloads, likes, and stars always use the open-model pool (proprietary models rarely have
  // HF presence but when they do, they are benchmarked against open-model peers).
  // News max: open uses the global pool, proprietary uses its own pool.
  // Trending max: open uses its pool, proprietary uses its pool.
  // Provider MAU (usage): always uses the proprietary pool.

  const newsMax = inputs.isOpenWeights ? stats.maxNews : stats.propMaxNews;
  const trendingMax = inputs.isOpenWeights ? stats.openMaxTrending : stats.propMaxTrending;

  // Downloads (HF; open pool for both)
  if (inputs.downloads > 0) {
    addSignal(signals, "downloads", logNormalizeSignal(inputs.downloads, stats.openMaxDownloads), WEIGHTS.downloads);
  }

  // Likes (HF; open pool for both)
  if (inputs.likes > 0) {
    addSignal(signals, "likes", logNormalizeSignal(inputs.likes, stats.openMaxLikes), WEIGHTS.likes);
  }

  // Stars (GitHub; open pool for both)
  if (inputs.stars > 0) {
    addSignal(signals, "stars", logNormalizeSignal(inputs.stars, stats.openMaxStars), WEIGHTS.stars);
  }

  // News mentions (pool differs by model type)
  if (inputs.newsMentions > 0) {
    addSignal(signals, "news", logNormalizeSignal(inputs.newsMentions, newsMax), WEIGHTS.news);
  }

  // Provider MAU / usage estimate (proprietary pool)
  if (inputs.providerUsageEstimate > 0) {
    addSignal(signals, "usage", logNormalizeSignal(inputs.providerUsageEstimate, stats.propMaxMAU), WEIGHTS.usage);
  }

  // Trending score (linear, not log; pool differs by model type)
  if (inputs.trendingScore > 0) {
    const norm = trendingMax > 0 ? (inputs.trendingScore / trendingMax) * 100 : 0;
    addSignal(signals, "trending", Math.min(norm, 100), WEIGHTS.trending);
  }

  if (signals.length === 0) return 0;

  // Reweight proportionally — no coverage penalty
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const score = signals.reduce((sum, s) => sum + s.score * (s.weight / totalWeight), 0);

  return Math.round(Math.min(score, 100) * 10) / 10;
}
