import { canonicalizeArenaFamily } from "@/lib/models/arena-family";
import { filterTrustedStructuredBenchmarkScores } from "@/lib/models/benchmark-score-trust";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toStars(score: number): number {
  return clamp(Math.round(score / 20), 1, 5);
}

function confidenceLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  if (score >= 25) return "Limited";
  return "Emerging";
}

export interface MarketValuePillar {
  label: string;
  stars: number;
  description: string;
}

export interface MarketValueThesis {
  pillars: MarketValuePillar[];
  summary: string;
}

export interface MarketValueExplanation extends MarketValueThesis {
  formattedValue: string;
  confidenceScore: number;
  confidenceStars: number;
  confidenceLabel: string;
  factorLabels: string[];
  methodologyPreview: string;
}

export interface MarketValueInputs {
  marketCapEstimate?: number | null;
  popularityScore: number | null;
  adoptionScore: number | null;
  economicFootprintScore: number | null;
  capabilityScore: number | null;
  agentScore: number | null;
  benchmarkCount: number;
  arenaFamilyCount: number;
  pricingSourceCount: number;
}

export function renderStars(stars: number): string {
  const clamped = clamp(stars, 1, 5);
  return "\u2605".repeat(clamped) + "\u2606".repeat(5 - clamped);
}

export function formatMarketValue(value: number | null): string {
  if (value == null || value <= 0) return "---";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}

export function countMarketValueEvidence(input: {
  benchmarkScores?: Array<{
    benchmark_id?: number | null;
    source?: string | null;
    benchmarks?: { slug?: string | null } | null;
  }> | null;
  eloRatings?: Array<{ arena_name?: string | null }> | null;
  pricingEntries?: Array<{ provider_name?: string | null; input_price_per_million?: number | null }> | null;
}): Pick<MarketValueInputs, "benchmarkCount" | "arenaFamilyCount" | "pricingSourceCount"> {
  const benchmarkCount = new Set(
    filterTrustedStructuredBenchmarkScores(input.benchmarkScores ?? [])
      .map((score) => score.benchmarks?.slug ?? score.benchmark_id?.toString() ?? null)
      .filter((value): value is string => Boolean(value))
  ).size;

  const arenaFamilyCount = new Set(
    (input.eloRatings ?? [])
      .map((rating) =>
        rating.arena_name ? canonicalizeArenaFamily(rating.arena_name).familyKey : ""
      )
      .filter(Boolean)
  ).size;

  const pricingSourceCount = new Set(
    (input.pricingEntries ?? [])
      .filter((entry) => entry.input_price_per_million != null)
      .map((entry) => (entry.provider_name ?? "").trim().toLowerCase())
      .filter(Boolean)
  ).size;

  return {
    benchmarkCount,
    arenaFamilyCount,
    pricingSourceCount,
  };
}

export function buildMarketValueExplanation(inputs: MarketValueInputs): MarketValueExplanation {
  const demandScore = (inputs.popularityScore ?? 0) * 0.45 + (inputs.adoptionScore ?? 0) * 0.55;
  const executionBase = inputs.capabilityScore ?? 0;
  const executionScore = executionBase * 0.75 + (inputs.agentScore ?? executionBase) * 0.25;
  const commercialScore = inputs.economicFootprintScore ?? 0;
  const confidenceScore = clamp(
    (inputs.benchmarkCount > 0 ? 18 : 0) +
      Math.min(inputs.benchmarkCount, 6) * 6 +
      (inputs.arenaFamilyCount > 0 ? 16 : 0) +
      Math.min(inputs.arenaFamilyCount, 3) * 6 +
      Math.min(inputs.pricingSourceCount, 3) * 8 +
      (inputs.pricingSourceCount > 0 ? 6 : 0),
    10,
    100
  );

  const pillars: MarketValuePillar[] = [
    {
      label: "Adoption",
      stars: toStars(demandScore),
      description:
        "Blends public traction with durable adoption rather than raw hype alone.",
    },
    {
      label: "Monetization",
      stars: toStars(commercialScore),
      description:
        "Reflects monetization power, distribution breadth, and usable market reach.",
    },
    {
      label: "Distribution",
      stars: toStars(executionScore),
      description:
        "Rewards technical capability and agentic usefulness when that evidence exists.",
    },
    {
      label: "Confidence",
      stars: toStars(confidenceScore),
      description:
        "Higher when benchmark, arena, and pricing evidence corroborate the estimate.",
    },
  ];

  return {
    formattedValue: formatMarketValue(inputs.marketCapEstimate ?? null),
    confidenceScore,
    confidenceStars: toStars(confidenceScore),
    confidenceLabel: confidenceLabel(confidenceScore),
    factorLabels: pillars.map((pillar) => pillar.label),
    methodologyPreview:
      "Our market value thesis blends adoption, monetization, distribution, and corroborated evidence without exposing the internal formula.",
    summary:
      "Our market value thesis blends demand, distribution, commercial footing, and corroborated execution without exposing the internal formula.",
    pillars,
  };
}

export function buildMarketValueThesis(
  inputs: Omit<MarketValueInputs, "marketCapEstimate">
): MarketValueThesis {
  const explanation = buildMarketValueExplanation(inputs);
  return {
    pillars: explanation.pillars,
    summary: explanation.summary,
  };
}
