import { describe, expect, it } from "vitest";

import { averageCapabilityMetric, getCapabilityMetricValue } from "./metrics";

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
