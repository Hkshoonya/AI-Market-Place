import { describe, expect, it } from "vitest";

import { computeAdoptionScore, computeEconomicFootprintScore } from "./economic-footprint";

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
});
