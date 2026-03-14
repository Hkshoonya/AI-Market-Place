function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toStars(score: number): number {
  return clamp(Math.round(score / 20), 1, 5);
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

export function renderStars(stars: number): string {
  const clamped = clamp(stars, 1, 5);
  return "★".repeat(clamped) + "☆".repeat(5 - clamped);
}

export function buildMarketValueThesis(inputs: {
  popularityScore: number | null;
  adoptionScore: number | null;
  economicFootprintScore: number | null;
  capabilityScore: number | null;
  agentScore: number | null;
  benchmarkCount: number;
  arenaFamilyCount: number;
  pricingSourceCount: number;
}): MarketValueThesis {
  const demandScore =
    ((inputs.popularityScore ?? 0) * 0.45 + (inputs.adoptionScore ?? 0) * 0.55);
  const executionBase = inputs.capabilityScore ?? 0;
  const executionScore =
    executionBase * 0.75 + (inputs.agentScore ?? executionBase) * 0.25;
  const commercialScore = inputs.economicFootprintScore ?? 0;
  const confidenceScore = clamp(
    (inputs.benchmarkCount > 0 ? 35 : 0) +
      (inputs.arenaFamilyCount > 0 ? 30 : 0) +
      Math.min(inputs.pricingSourceCount, 3) * 10 +
      (inputs.benchmarkCount >= 3 ? 10 : 0),
    15,
    100
  );

  return {
    summary:
      "Our market value thesis blends demand, distribution, commercial footing, and corroborated execution without exposing the internal formula.",
    pillars: [
      {
        label: "Demand",
        stars: toStars(demandScore),
        description:
          "Blends public traction with durable adoption rather than raw hype alone.",
      },
      {
        label: "Execution",
        stars: toStars(executionScore),
        description:
          "Rewards technical capability and agentic usefulness when that evidence exists.",
      },
      {
        label: "Commercial",
        stars: toStars(commercialScore),
        description:
          "Reflects monetization power, distribution breadth, and usable market reach.",
      },
      {
        label: "Confidence",
        stars: toStars(confidenceScore),
        description:
          "Higher when benchmarks, arena evidence, and pricing coverage corroborate the model.",
      },
    ],
  };
}

export function formatMarketValue(value: number | null): string {
  if (value == null || value <= 0) return "---";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}
