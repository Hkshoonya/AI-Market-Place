import { describe, expect, it } from "vitest";

import {
  computeAdoptionScore,
  computeEconomicConfidenceMultiplier,
  computeEconomicFootprintScore,
} from "./economic-footprint";

describe("economic footprint scoring", () => {
  it("lets broad durable adoption outrank thin high-price exposure", () => {
    const broadAdoption = computeAdoptionScore({
      downloads: 1_600_000,
      providerUsageEstimate: 260_000_000,
      pricingSourceCount: 3,
      isApiAvailable: true,
      releaseDate: "2024-01-01",
    });

    const thinAdoption = computeAdoptionScore({
      downloads: 10_000,
      providerUsageEstimate: 8_000_000,
      pricingSourceCount: 1,
      isApiAvailable: true,
      releaseDate: "2026-02-01",
    });

    const strong = computeEconomicFootprintScore({
      adoptionScore: broadAdoption,
      blendedPricePerMillion: 1.2,
      pricingSourceCount: 3,
      isApiAvailable: true,
      releaseDate: "2024-01-01",
      corroborationLevel: "strong",
    });

    const weak = computeEconomicFootprintScore({
      adoptionScore: thinAdoption,
      blendedPricePerMillion: 18,
      pricingSourceCount: 1,
      isApiAvailable: true,
      releaseDate: "2026-02-01",
      corroborationLevel: "single_source",
    });

    expect(strong).toBeGreaterThan(weak);
  });

  it("penalizes low-confidence models even when price is high", () => {
    const strong = computeEconomicFootprintScore({
      adoptionScore: 72,
      blendedPricePerMillion: 4,
      pricingSourceCount: 3,
      isApiAvailable: true,
      releaseDate: "2024-05-01",
      corroborationLevel: "strong",
    });

    const lowConfidence = computeEconomicFootprintScore({
      adoptionScore: 72,
      blendedPricePerMillion: 4,
      pricingSourceCount: 1,
      isApiAvailable: true,
      releaseDate: "2024-05-01",
      corroborationLevel: "single_source",
    });

    expect(strong).toBeGreaterThan(lowConfidence);
  });

  it("heavily penalizes economic confidence when direct quality evidence is missing", () => {
    const thinConfidence = computeEconomicConfidenceMultiplier({
      corroborationLevel: "none",
      pricingSourceCount: 1,
      sourceCoverage: {
        totalDistinctSources: 1,
        independentQualitySourceCount: 0,
        sourceFamilyCount: 1,
        benchmarkSourceCount: 0,
        benchmarkCategoryCount: 0,
        eloSourceCount: 0,
        newsSourceCount: 0,
        pricingSourceCount: 1,
        corroborationLevel: "none",
        biasRisk: "high",
        sourceFamilies: ["pricing"],
        benchmarkSources: [],
        benchmarkCategories: [],
        eloSources: [],
        newsSources: [],
        pricingSources: ["provider-pricing"],
        hasCommunitySignals: false,
      },
      capabilityScore: null,
      qualityScore: 0,
    });

    const strongConfidence = computeEconomicConfidenceMultiplier({
      corroborationLevel: "strong",
      pricingSourceCount: 3,
      sourceCoverage: {
        totalDistinctSources: 6,
        independentQualitySourceCount: 3,
        sourceFamilyCount: 4,
        benchmarkSourceCount: 2,
        benchmarkCategoryCount: 2,
        eloSourceCount: 1,
        newsSourceCount: 1,
        pricingSourceCount: 3,
        corroborationLevel: "strong",
        biasRisk: "low",
        sourceFamilies: ["benchmarks", "elo", "pricing", "news"],
        benchmarkSources: ["livebench", "mmlu-pro"],
        benchmarkCategories: ["general", "reasoning"],
        eloSources: ["chatbot-arena"],
        newsSources: ["provider-blog"],
        pricingSources: ["openai", "azure", "openrouter"],
        hasCommunitySignals: true,
      },
      capabilityScore: 78,
      qualityScore: 72,
    });

    expect(strongConfidence).toBeGreaterThan(thinConfidence);
    expect(thinConfidence).toBeLessThan(0.6);
  });
});
