import { describe, expect, it } from "vitest";
import {
  computeBalancedRankPenalty,
  computeCapabilityScoreMultiplier,
} from "./ranking-penalties";

describe("ranking penalties", () => {
  it("heavily penalizes superseded compatibility rows", () => {
    const previousFlagship = {
      slug: "anthropic-claude-opus-4-6",
      name: "Claude Opus 4.6",
      provider: "anthropic",
      release_date: "2025-06-01",
      is_api_available: true,
      is_open_weights: false,
    };

    expect(computeCapabilityScoreMultiplier(previousFlagship)).toBeLessThan(0.75);
    expect(computeBalancedRankPenalty(previousFlagship, 2000)).toBeGreaterThanOrEqual(500);
  });

  it("does not penalize the current flagship replacement", () => {
    const currentFlagship = {
      slug: "anthropic-claude-opus-4-7",
      name: "Claude Opus 4.7",
      provider: "anthropic",
      release_date: "2026-04-16",
      is_api_available: true,
      is_open_weights: false,
    };

    expect(computeCapabilityScoreMultiplier(currentFlagship)).toBe(1);
    expect(computeBalancedRankPenalty(currentFlagship, 2000)).toBe(0);
  });

  it("penalizes closed inaccessible rows even when they are not open weights", () => {
    const inaccessibleClosedRow = {
      slug: "vendor-old-model",
      name: "Vendor Old Model",
      provider: "vendor",
      release_date: "2024-01-01",
      is_api_available: false,
      is_open_weights: false,
    };

    expect(computeCapabilityScoreMultiplier(inaccessibleClosedRow)).toBeLessThan(1);
    expect(computeBalancedRankPenalty(inaccessibleClosedRow, 1000)).toBeGreaterThan(0);
  });
});
