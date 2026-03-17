import type {
  CorroborationLevel,
  SourceCoverage,
} from "@/lib/source-coverage";

const MIN_EFFECTIVE_PRICE = 0.1;
const MAX_PRICE_NORMALIZATION = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function monthsSinceRelease(releaseDate: string | null): number {
  if (!releaseDate) return 0;
  const releaseTimestamp = Date.parse(releaseDate);
  if (!Number.isFinite(releaseTimestamp)) return 0;
  return (Date.now() - releaseTimestamp) / (1000 * 60 * 60 * 24 * 30.4375);
}

function computeDurabilityScore(releaseDate: string | null): number {
  return clamp(35 + Math.min(monthsSinceRelease(releaseDate) / 24, 1) * 65, 35, 100);
}

function computeMonetizationScore(blendedPricePerMillion: number): number {
  const effectivePrice = Math.max(blendedPricePerMillion, MIN_EFFECTIVE_PRICE);
  const normalized =
    (Math.log10(effectivePrice + 1) / Math.log10(MAX_PRICE_NORMALIZATION + 1)) * 100;
  return clamp(normalized, 0, 100);
}

function computeDistributionScore(pricingSourceCount: number, isApiAvailable: boolean): number {
  const sourceScore = clamp(pricingSourceCount, 0, 4) / 4;
  const apiBoost = isApiAvailable ? 0.25 : 0;
  return clamp((sourceScore + apiBoost) * 100, 0, 100);
}

function getBaseEconomicConfidence(level: CorroborationLevel): number {
  switch (level) {
    case "strong":
      return 1;
    case "multi_source":
      return 0.96;
    case "single_source":
      return 0.88;
    case "none":
    default:
      return 0.74;
  }
}

export function computeEconomicConfidenceMultiplier(inputs: {
  corroborationLevel: CorroborationLevel;
  pricingSourceCount: number;
  sourceCoverage?: SourceCoverage | null;
  capabilityScore?: number | null;
  qualityScore?: number | null;
}): number {
  let multiplier = getBaseEconomicConfidence(inputs.corroborationLevel);
  const directQualitySignalCount =
    (inputs.sourceCoverage?.benchmarkSourceCount ?? 0) +
    (inputs.sourceCoverage?.eloSourceCount ?? 0);

  if (directQualitySignalCount === 0) {
    multiplier *= 0.78;
  }

  if ((inputs.capabilityScore ?? 0) <= 0) {
    multiplier *= 0.86;
  }

  if ((inputs.qualityScore ?? 0) <= 0) {
    multiplier *= 0.92;
  }

  if (inputs.pricingSourceCount === 0) {
    multiplier *= 0.9;
  }

  return clamp(multiplier, 0.45, 1);
}

export function computeAdoptionScore(inputs: {
  downloads: number;
  providerUsageEstimate: number;
  pricingSourceCount: number;
  isApiAvailable: boolean;
  releaseDate: string | null;
}): number {
  const downloadSignal = clamp(Math.log10(inputs.downloads + 1) / 6.5, 0, 1) * 100;
  const usageSignal = clamp(Math.log10(inputs.providerUsageEstimate + 1) / 9, 0, 1) * 100;
  const distributionSignal = computeDistributionScore(inputs.pricingSourceCount, inputs.isApiAvailable);
  const durabilitySignal = computeDurabilityScore(inputs.releaseDate);

  const weighted =
    downloadSignal * 0.2 +
    usageSignal * 0.45 +
    distributionSignal * 0.2 +
    durabilitySignal * 0.15;

  return Math.round(clamp(weighted, 0, 100) * 10) / 10;
}

export function computeEconomicFootprintScore(inputs: {
  adoptionScore: number;
  blendedPricePerMillion: number;
  pricingSourceCount: number;
  isApiAvailable: boolean;
  releaseDate: string | null;
  corroborationLevel: CorroborationLevel;
  sourceCoverage?: SourceCoverage | null;
  capabilityScore?: number | null;
  qualityScore?: number | null;
}): number {
  const monetizationScore = computeMonetizationScore(inputs.blendedPricePerMillion);
  const distributionScore = computeDistributionScore(inputs.pricingSourceCount, inputs.isApiAvailable);
  const durabilityScore = computeDurabilityScore(inputs.releaseDate);
  const confidenceMultiplier = computeEconomicConfidenceMultiplier(inputs);

  const weighted =
    inputs.adoptionScore * 0.45 +
    monetizationScore * 0.2 +
    distributionScore * 0.2 +
    durabilityScore * 0.15;

  return Math.round(clamp(weighted * confidenceMultiplier, 0, 100) * 10) / 10;
}
