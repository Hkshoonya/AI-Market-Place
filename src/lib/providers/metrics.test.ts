import { describe, expect, it } from "vitest";

import { averageCapabilityMetric, getBestProviderRank, getCapabilityMetricValue } from "./metrics";

describe("getBestProviderRank", () => {
  it("finds the best rank regardless of family presentation order", () => {
    expect(getBestProviderRank([{ overall_rank: 112 }, { overall_rank: 142 }, { overall_rank: 25 }])).toBe(25);
  });

  it("ignores absent and invalid ranks", () => {
    expect(getBestProviderRank([{}, { overall_rank: 0 }, { overall_rank: NaN }, { overall_rank: null }])).toBeNull();
  });
});

describe("getCapabilityMetricValue", () => {
  it("prefers capability score when present", () => {
    expect(
      getCapabilityMetricValue({ capability_score: 81.5, quality_score: 73.2 })
    ).toBe(81.5);
  });

  it("falls back to quality score for older rows", () => {
    expect(getCapabilityMetricValue({ capability_score: null, quality_score: "74.2" })).toBe(
      74.2
    );
  });
});

describe("averageCapabilityMetric", () => {
  it("averages valid capability-like scores only", () => {
    expect(
      averageCapabilityMetric([
        { capability_score: 80 },
        { capability_score: null, quality_score: 70 },
        { capability_score: null, quality_score: null },
      ])
    ).toBe(75);
  });
});
