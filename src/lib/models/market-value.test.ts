import { describe, expect, it } from "vitest";

import {
  buildMarketValueThesis,
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

  it("renders fixed-width star strings", () => {
    expect(renderStars(4)).toBe("★★★★☆");
  });
});
