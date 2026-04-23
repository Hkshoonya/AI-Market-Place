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

  it("rewards benchmark-backed recent flagship rows in balanced rank", () => {
    const currentFlagship = {
      slug: "anthropic-claude-opus-4-7",
      name: "Claude Opus 4.7",
      provider: "anthropic",
      release_date: "2026-04-16",
      is_api_available: true,
      is_open_weights: false,
      benchmarkCount: 5,
      capabilityRank: 7,
      description:
        "Our latest and most capable Opus release with stronger performance than Opus 4.6.",
    };

    expect(computeBalancedRankPenalty(currentFlagship, 2000)).toBeLessThan(0);
  });

  it("penalizes aging flagship-branded rows that no longer represent the current frontier", () => {
    const legacyFlagship = {
      slug: "openai-gpt-4o",
      name: "GPT-4o",
      provider: "openai",
      release_date: "2024-05-13",
      is_api_available: true,
      is_open_weights: false,
      benchmarkCount: 10,
      capabilityRank: 35,
      description:
        "Multimodal flagship model with native vision and audio capabilities.",
    };

    expect(computeBalancedRankPenalty(legacyFlagship, 2000)).toBeGreaterThanOrEqual(160);
  });

  it("does not reward recent benchmark-backed rows that are not yet frontier-level on capability", () => {
    const midPackRecentRow = {
      slug: "google-gemini-3-1-pro",
      name: "Gemini 3.1 Pro",
      provider: "google",
      release_date: "2026-02-19",
      is_api_available: true,
      is_open_weights: false,
      benchmarkCount: 5,
      capabilityRank: 53,
      description: "Google's latest Gemini 3.1 Pro release.",
    };

    expect(computeBalancedRankPenalty(midPackRecentRow, 2000)).toBe(0);
  });

  it("penalizes recent mid-pack commercial rows that survive on usage without frontier capability", () => {
    const midPackCommercial = {
      slug: "minimax-minimax-m2-1",
      name: "MiniMax M2.1",
      provider: "minimax",
      release_date: "2025-12-23",
      is_api_available: true,
      is_open_weights: false,
      benchmarkCount: 4,
      capabilityRank: 31,
      description:
        "MiniMax coding and reasoning model optimized for real-world programming and workplace tasks.",
    };

    expect(computeBalancedRankPenalty(midPackCommercial, 2000)).toBeGreaterThanOrEqual(80);
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
