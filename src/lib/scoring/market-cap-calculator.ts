/**
 * Market Cap Calculator
 *
 * Keeps the legacy synthetic market-cap estimate for backward compatibility,
 * while delegating popularity scoring to the newer grouped popularity model.
 */

import {
  MARKET_CAP_SCALE_FACTOR,
  USAGE_EXPONENT,
  MAX_PRICE_NORMALIZATION,
  MIN_EFFECTIVE_PRICE,
} from "@/lib/constants/scoring";
import {
  computePopularityScore as computePopularityScoreV2,
  computePopularityStats as computePopularityStatsV2,
  type PopularityInputs as PopularityInputsV2,
  type PopularityStats,
} from "@/lib/scoring/popularity-score";

export { PROVIDER_USAGE_ESTIMATES, getProviderUsageEstimate } from "@/lib/constants/scoring";

export interface PopularityInputs {
  downloads: number;
  likes: number;
  stars: number;
  newsMentions: number;
  providerUsageEstimate: number;
  trendingScore: number;
  releaseDate?: string | null;
}

export function computePopularityScore(
  inputs: PopularityInputs,
  stats: PopularityStats
): number {
  return computePopularityScoreV2(
    {
      ...inputs,
      releaseDate: inputs.releaseDate ?? null,
    } satisfies PopularityInputsV2,
    stats
  );
}

export function computeMarketCap(
  usageScore: number,
  blendedApiPrice: number
): number {
  if (usageScore <= 0) return 0;

  const effectivePrice = Math.max(blendedApiPrice, MIN_EFFECTIVE_PRICE);
  const priceWeight =
    Math.log10(effectivePrice + 1) / Math.log10(MAX_PRICE_NORMALIZATION + 1);

  const rawMarketCap =
    Math.pow(usageScore, USAGE_EXPONENT) * priceWeight * MARKET_CAP_SCALE_FACTOR;

  return Math.round(rawMarketCap / 1000) * 1000;
}

export function computePopularityStats(
  models: Array<{
    downloads: number;
    likes: number;
    stars: number;
    newsMentions: number;
    providerUsageEstimate: number;
    trendingScore: number;
    releaseDate?: string | null;
  }>
): PopularityStats {
  return computePopularityStatsV2(
    models.map((model) => ({
      ...model,
      releaseDate: model.releaseDate ?? null,
    }))
  );
}
