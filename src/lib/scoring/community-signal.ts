/**
 * Community Signal Calculator
 *
 * Standalone module for computing the community quality signal from
 * HuggingFace likes, news mentions, and trending score.
 *
 * Extracted from quality-calculator.ts per SCORE-05: community signal
 * computation must be independently usable outside the quality lens.
 */

import { logNormalizeSignal } from "@/lib/scoring/scoring-helpers";

type Signal = { name: string; score: number; weight: number } | null;

/**
 * Compute community signal from HF likes, news mentions, and trending score.
 *
 * For open models: community = (likes + news) / 2 (or news-only if no likes).
 * For proprietary models: community = news-only (HF likes not applicable).
 * A trending boost of up to +20 is applied regardless of model type.
 *
 * Returns null if no community data is available for this model type.
 *
 * SCORE-05: Exported as a standalone function for use outside quality-calculator.
 */
export function computeCommunitySignal(
  inputs: { hfLikes: number | null; newsMentions: number; trendingScore: number | null },
  stats: { maxLikes: number; maxNewsMentions: number },
  weights: { community: number },
  isProprietary: boolean,
  isHfAvailable: boolean
): Signal {
  const hasLikes = inputs.hfLikes != null && inputs.hfLikes > 0;
  const hasNews = inputs.newsMentions > 0;

  if (!isHfAvailable && !hasNews) return null;
  if (!hasLikes && !hasNews) return null;

  const likeScore = hasLikes
    ? logNormalizeSignal(inputs.hfLikes!, stats.maxLikes)
    : 0;
  const newsScore = hasNews
    ? logNormalizeSignal(inputs.newsMentions, stats.maxNewsMentions)
    : 0;

  // Proprietary models: community = news only (HF likes not applicable)
  // Open models: community = (likes + news) / 2
  let communityScore = hasLikes
    ? Math.min((likeScore + newsScore) / 2, 100)
    : Math.min(newsScore, 100);

  // Trending boost: up to +20 on community sub-score
  if (inputs.trendingScore != null && inputs.trendingScore > 0) {
    const trendingBoost = Math.min((inputs.trendingScore / 50) * 20, 20);
    communityScore = Math.min(communityScore + trendingBoost, 100);
  }

  return { name: "community", score: communityScore, weight: weights.community };
}
