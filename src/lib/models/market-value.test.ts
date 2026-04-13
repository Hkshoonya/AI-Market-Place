import { describe, expect, it } from "vitest";

import {
  buildMarketValueExplanation,
  buildMarketValueThesis,
  countMarketValueEvidence,
  formatMarketValue,
  renderStars,
} from "./market-value";

describe("market value helpers", () => {
  it("builds a four-pillar thesis without exposing the raw formula", () => {
    const thesis = buildMarketValueThesis({
      popularityScore: 70,
      adoptionScore: 75,
      economicFootprintScore: 68,
      capabilityScore: 82,
      agentScore: 60,
      benchmarkCount: 4,
      arenaFamilyCount: 2,
      pricingSourceCount: 2,
    });

    expect(thesis.pillars).toHaveLength(4);
    expect(thesis.summary).toMatch(/market value thesis/i);
    expect(thesis.pillars.every((pillar) => pillar.stars >= 1 && pillar.stars <= 5)).toBe(true);
  });

  it("formats market values into readable investor-style units", () => {
    expect(formatMarketValue(1_240_000_000)).toBe("$1.2B");
    expect(formatMarketValue(245_000_000)).toBe("$245M");
    expect(formatMarketValue(12_000)).toBe("$12K");
  });

  it("builds a detailed explanation with factor labels and confidence metadata", () => {
    const explanation = buildMarketValueExplanation({
      marketCapEstimate: 245_000_000,
      popularityScore: 70,
      adoptionScore: 75,
      economicFootprintScore: 68,
      capabilityScore: 82,
      agentScore: 60,
      benchmarkCount: 4,
      arenaFamilyCount: 2,
      pricingSourceCount: 2,
    });

    expect(explanation.formattedValue).toBe("$245M");
    expect(explanation.confidenceLabel).toMatch(/high|strong/i);
    expect(explanation.factorLabels).toEqual(
      expect.arrayContaining(["Adoption", "Monetization", "Distribution", "Confidence"])
    );
    expect(explanation.methodologyPreview).toMatch(/without exposing the internal formula/i);
  });

  it("degrades confidence when evidence coverage is thin", () => {
    const explanation = buildMarketValueExplanation({
      marketCapEstimate: 18_000_000,
      popularityScore: 55,
      adoptionScore: 48,
      economicFootprintScore: 42,
      capabilityScore: 63,
      agentScore: null,
      benchmarkCount: 0,
      arenaFamilyCount: 0,
      pricingSourceCount: 0,
    });

    expect(explanation.confidenceScore).toBeLessThan(40);
    expect(explanation.confidenceStars).toBeLessThanOrEqual(2);
    expect(explanation.confidenceLabel).toMatch(/emerging|limited/i);
  });

  it("renders fixed-width star strings", () => {
    expect(renderStars(4)).toBe("★★★★☆");
  });

  it("counts corroborating evidence sources for the public explanation layer", () => {
    expect(
      countMarketValueEvidence({
        benchmarkScores: [
          { benchmark_id: 1, source: "livebench", benchmarks: { slug: "mmlu" } },
          { benchmark_id: 2, source: "provider-blog", benchmarks: { slug: "humaneval" } },
          { benchmark_id: 2, source: "swe-bench", benchmarks: { slug: "humaneval" } },
          { benchmark_id: 3, source: null, benchmarks: { slug: "math" } },
        ],
        eloRatings: [{ arena_name: "chatbot-arena" }, { arena_name: "vision-arena" }],
        pricingEntries: [
          { provider_name: "OpenAI", input_price_per_million: 5 },
          { provider_name: "OpenRouter", input_price_per_million: 4 },
          { provider_name: "OpenRouter", input_price_per_million: 4 },
        ],
      })
    ).toEqual({
      benchmarkCount: 2,
      arenaFamilyCount: 2,
      pricingSourceCount: 2,
    });
  });
});
