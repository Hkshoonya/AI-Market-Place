/**
 * Market Cap Calculator
 *
 * Uses a bounded, non-linear market value model instead of the old
 * usage-times-price shortcut. The public site can explain the pillars
 * (demand, execution, monetization, confidence) without exposing weights.
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

export interface MarketCapInputs {
  adoptionScore: number;
  popularityScore: number;
  capabilityScore: number;
  economicFootprintScore: number;
  blendedPricePerMillion: number;
  agentScore?: number | null;
  confidenceMultiplier?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function computePricePowerScore(blendedPricePerMillion: number): number {
  const effectivePrice = Math.max(blendedPricePerMillion, MIN_EFFECTIVE_PRICE);
  const normalized =
    (Math.log10(effectivePrice + 1) / Math.log10(MAX_PRICE_NORMALIZATION + 1)) * 100;
  return clamp(normalized, 0, 100);
}

function computeDemandIndex(inputs: MarketCapInputs): number {
  return clamp(
    inputs.adoptionScore * 0.45 +
      inputs.popularityScore * 0.35 +
      inputs.economicFootprintScore * 0.2,
    0,
    100
  );
}

function computeExecutionIndex(inputs: MarketCapInputs): number {
  const agentOrCapability = inputs.agentScore ?? inputs.capabilityScore;
  return clamp(
    inputs.capabilityScore * 0.7 + agentOrCapability * 0.3,
    0,
    100
  );
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

export function computeMarketCap(inputs: MarketCapInputs): number {
  const demandIndex = computeDemandIndex(inputs);
  const executionIndex = computeExecutionIndex(inputs);
  const pricePowerScore = computePricePowerScore(inputs.blendedPricePerMillion);
  const confidenceMultiplier = clamp(inputs.confidenceMultiplier ?? 1, 0.85, 1.05);

  if (demandIndex <= 0 || executionIndex <= 0) return 0;

  const rawEstimate =
    MARKET_CAP_SCALE_FACTOR *
    Math.pow(demandIndex / 100, USAGE_EXPONENT) *
    Math.pow(executionIndex / 100, 0.4) *
    Math.pow(Math.max(pricePowerScore, 5) / 100, 0.9) *
    confidenceMultiplier;

  return Math.round(rawEstimate / 1_000_000) * 1_000_000;
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
