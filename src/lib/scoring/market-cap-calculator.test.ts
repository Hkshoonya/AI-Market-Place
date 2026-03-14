import { describe, expect, it } from "vitest";
import {
  computeMarketCap,
  computePopularityScore,
  computePopularityStats,
  type PopularityInputs,
  type PopularityStats,
} from "./market-cap-calculator";
import {
  MARKET_CAP_SCALE_FACTOR,
  USAGE_EXPONENT,
  MAX_PRICE_NORMALIZATION,
  MIN_EFFECTIVE_PRICE,
} from "@/lib/constants/scoring";

const fixtureStats: PopularityStats = {
  maxDownloads: 1_000_000,
  maxLikes: 50_000,
  maxStars: 100_000,
  maxNewsMentions: 200,
  maxUsageEstimate: 400_000_000,
  maxTrendingScore: 100,
};

function makePopInputs(
  overrides: Partial<PopularityInputs> = {}
): PopularityInputs {
  return {
    downloads: 0,
    likes: 0,
    stars: 0,
    newsMentions: 0,
    providerUsageEstimate: 0,
    trendingScore: 0,
    ...overrides,
  };
}

describe("scoring constants", () => {
  it("keeps the market-value constants within the expected calibrated range", () => {
    expect(MARKET_CAP_SCALE_FACTOR).toBe(1_200_000_000);
    expect(USAGE_EXPONENT).toBe(1.2);
    expect(MAX_PRICE_NORMALIZATION).toBe(20);
    expect(MIN_EFFECTIVE_PRICE).toBe(0.1);
  });
});

describe("computePopularityStats", () => {
  it("computes correct maximums from model array", () => {
    const models = [
      {
        downloads: 500_000,
        likes: 10_000,
        stars: 80_000,
        newsMentions: 50,
        providerUsageEstimate: 200_000_000,
        trendingScore: 80,
      },
      {
        downloads: 1_000_000,
        likes: 50_000,
        stars: 100_000,
        newsMentions: 200,
        providerUsageEstimate: 400_000_000,
        trendingScore: 100,
      },
    ];

    const stats = computePopularityStats(models);
    expect(stats.maxDownloads).toBe(1_000_000);
    expect(stats.maxLikes).toBe(50_000);
    expect(stats.maxStars).toBe(100_000);
    expect(stats.maxNewsMentions).toBe(200);
    expect(stats.maxUsageEstimate).toBe(400_000_000);
    expect(stats.maxTrendingScore).toBe(100);
  });
});

describe("computePopularityScore", () => {
  it("returns a high score for broadly evidenced market leaders", () => {
    const score = computePopularityScore(
      makePopInputs({
        downloads: 1_000_000,
        likes: 50_000,
        stars: 100_000,
        newsMentions: 200,
        providerUsageEstimate: 400_000_000,
        trendingScore: 100,
        releaseDate: "2024-01-01",
      }),
      fixtureStats
    );

    expect(score).toBeGreaterThan(80);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns 0 when no evidence exists", () => {
    expect(computePopularityScore(makePopInputs(), fixtureStats)).toBe(0);
  });
});

describe("computeMarketCap", () => {
  it("rewards stronger demand and execution", () => {
    const weaker = computeMarketCap({
      adoptionScore: 40,
      popularityScore: 32,
      capabilityScore: 55,
      economicFootprintScore: 34,
      blendedPricePerMillion: 1.5,
      agentScore: 40,
      confidenceMultiplier: 0.94,
    });

    const stronger = computeMarketCap({
      adoptionScore: 74,
      popularityScore: 68,
      capabilityScore: 85,
      economicFootprintScore: 72,
      blendedPricePerMillion: 2.5,
      agentScore: 62,
      confidenceMultiplier: 1,
    });

    expect(stronger).toBeGreaterThan(weaker);
  });

  it("rewards pricing power when demand is equal", () => {
    const cheap = computeMarketCap({
      adoptionScore: 70,
      popularityScore: 65,
      capabilityScore: 80,
      economicFootprintScore: 68,
      blendedPricePerMillion: 0.2,
      agentScore: 60,
      confidenceMultiplier: 1,
    });

    const premium = computeMarketCap({
      adoptionScore: 70,
      popularityScore: 65,
      capabilityScore: 80,
      economicFootprintScore: 68,
      blendedPricePerMillion: 8,
      agentScore: 60,
      confidenceMultiplier: 1,
    });

    expect(premium).toBeGreaterThan(cheap);
  });

  it("applies confidence penalties to otherwise identical models", () => {
    const lowConfidence = computeMarketCap({
      adoptionScore: 70,
      popularityScore: 65,
      capabilityScore: 80,
      economicFootprintScore: 68,
      blendedPricePerMillion: 2.5,
      agentScore: 60,
      confidenceMultiplier: 0.9,
    });

    const highConfidence = computeMarketCap({
      adoptionScore: 70,
      popularityScore: 65,
      capabilityScore: 80,
      economicFootprintScore: 68,
      blendedPricePerMillion: 2.5,
      agentScore: 60,
      confidenceMultiplier: 1,
    });

    expect(highConfidence).toBeGreaterThan(lowConfidence);
  });

  it("returns 0 when demand is absent", () => {
    expect(
      computeMarketCap({
        adoptionScore: 0,
        popularityScore: 0,
        capabilityScore: 80,
        economicFootprintScore: 0,
        blendedPricePerMillion: 2,
        agentScore: 50,
        confidenceMultiplier: 1,
      })
    ).toBe(0);
  });

  it("rounds to the nearest million", () => {
    const value = computeMarketCap({
      adoptionScore: 72.7,
      popularityScore: 61.7,
      capabilityScore: 79.5,
      economicFootprintScore: 69.6,
      blendedPricePerMillion: 2,
      agentScore: 57,
      confidenceMultiplier: 0.98,
    });

    expect(value % 1_000_000).toBe(0);
    expect(value).toBeGreaterThan(100_000_000);
  });
});
