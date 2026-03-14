/**
 * Unit tests for market-cap-calculator.
 * Covers: computePopularityScore, computeMarketCap, computePopularityStats
 * plus 5+ market cap regression snapshot assertions.
 */

import { describe, it, expect } from "vitest";
import {
  computePopularityScore,
  computeMarketCap,
  computePopularityStats,
  PopularityInputs,
  PopularityStats,
} from "./market-cap-calculator";
import {
  MARKET_CAP_SCALE_FACTOR,
  USAGE_EXPONENT,
  MAX_PRICE_NORMALIZATION,
  MIN_EFFECTIVE_PRICE,
} from "@/lib/constants/scoring";

// --------------- Fixture: Popularity Stats ---------------

const fixtureStats: PopularityStats = {
  maxDownloads: 1_000_000,
  maxLikes: 50_000,
  maxStars: 100_000,
  maxNewsMentions: 200,
  maxUsageEstimate: 400_000_000,
  maxTrendingScore: 100,
};

// --------------- Helper ---------------

function makePopInputs(overrides: Partial<PopularityInputs> = {}): PopularityInputs {
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

// --------------- Constants verification ---------------

describe("scoring constants", () => {
  it("constants have expected values for regression stability", () => {
    expect(MARKET_CAP_SCALE_FACTOR).toBe(1300);
    expect(USAGE_EXPONENT).toBe(1.2);
    expect(MAX_PRICE_NORMALIZATION).toBe(20);
    expect(MIN_EFFECTIVE_PRICE).toBe(0.10);
  });
});

// --------------- computePopularityStats ---------------

describe("computePopularityStats", () => {
  it("computes correct maximums from model array", () => {
    const models = [
      { downloads: 500_000, likes: 10_000, stars: 80_000, newsMentions: 50, providerUsageEstimate: 200_000_000, trendingScore: 80 },
      { downloads: 1_000_000, likes: 50_000, stars: 100_000, newsMentions: 200, providerUsageEstimate: 400_000_000, trendingScore: 100 },
      { downloads: 100, likes: 10, stars: 5, newsMentions: 0, providerUsageEstimate: 1_000_000, trendingScore: 5 },
    ];
    const stats = computePopularityStats(models);
    expect(stats.maxDownloads).toBe(1_000_000);
    expect(stats.maxLikes).toBe(50_000);
    expect(stats.maxStars).toBe(100_000);
    expect(stats.maxNewsMentions).toBe(200);
    expect(stats.maxUsageEstimate).toBe(400_000_000);
    expect(stats.maxTrendingScore).toBe(100);
  });

  it("defaults to 1 for all-zero models", () => {
    const stats = computePopularityStats([
      { downloads: 0, likes: 0, stars: 0, newsMentions: 0, providerUsageEstimate: 0, trendingScore: 0 },
    ]);
    expect(stats.maxDownloads).toBe(1);
    expect(stats.maxLikes).toBe(1);
    expect(stats.maxStars).toBe(1);
    expect(stats.maxNewsMentions).toBe(1);
    expect(stats.maxUsageEstimate).toBe(1);
    expect(stats.maxTrendingScore).toBe(1);
  });
});

// --------------- computePopularityScore ---------------

describe("computePopularityScore", () => {
  it("model with all 6 signals at pool-max returns score near 100", () => {
    const inputs = makePopInputs({
      downloads: 1_000_000,
      likes: 50_000,
      stars: 100_000,
      newsMentions: 200,
      providerUsageEstimate: 400_000_000,
      trendingScore: 100,
      releaseDate: "2024-01-01",
    });
    const score = computePopularityScore(inputs, fixtureStats);
    // All grouped signals at max with strong durability should stay near 100.
    expect(score).toBeGreaterThan(80);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("model with all-zero inputs returns 0", () => {
    const inputs = makePopInputs({});
    const score = computePopularityScore(inputs, fixtureStats);
    expect(score).toBe(0);
  });

  it("model with 1 signal gets coverage penalty (score <= 50)", () => {
    const inputs = makePopInputs({
      providerUsageEstimate: 400_000_000, // at max
    });
    const score = computePopularityScore(inputs, fixtureStats);
    // 1 signal -> coverage penalty 0.50
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(50);
  });

  it("model with 4+ signals gets full credit (no penalty)", () => {
    const inputs = makePopInputs({
      downloads: 500_000,
      likes: 25_000,
      stars: 50_000,
      newsMentions: 100,
    });
    const score = computePopularityScore(inputs, fixtureStats);
    // 4 signals -> coverage penalty 1.0 (full credit)
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("more signals produce higher score than fewer signals (same underlying values)", () => {
    const twoSignals = makePopInputs({
      downloads: 500_000,
      likes: 25_000,
    });
    const fourSignals = makePopInputs({
      downloads: 500_000,
      likes: 25_000,
      stars: 50_000,
      newsMentions: 100,
    });
    const s2 = computePopularityScore(twoSignals, fixtureStats);
    const s4 = computePopularityScore(fourSignals, fixtureStats);
    expect(s4).toBeGreaterThan(s2);
  });
});

// --------------- computeMarketCap — Regression Snapshots ---------------

describe("Market Cap Formula Regression", () => {
  // Each test uses hand-computed expected values from the formula:
  // marketCap = round(usageScore^1.2 * (log10(effectivePrice+1)/log10(21)) * 1300 / 1000) * 1000

  it("GPT-4o profile: usage=95, price=$15 -> $280,000", () => {
    const result = computeMarketCap(95, 15);
    expect(result).toBe(280_000);
  });

  it("Claude-3.5 profile: usage=85, price=$12 -> $226,000", () => {
    const result = computeMarketCap(85, 12);
    expect(result).toBe(226_000);
  });

  it("Llama-3 open model: usage=60, price=$0 -> uses MIN_EFFECTIVE_PRICE=$0.10 -> $6,000", () => {
    const result = computeMarketCap(60, 0);
    expect(result).toBe(6_000);
  });

  it("Niche model: usage=20, price=$10 -> $37,000", () => {
    const result = computeMarketCap(20, 10);
    expect(result).toBe(37_000);
  });

  it("Zero usage: usage=0, price=$15 -> $0", () => {
    const result = computeMarketCap(0, 15);
    expect(result).toBe(0);
  });

  it("High price model: usage=50, price=$50 -> $184,000 (priceWeight > 1)", () => {
    const result = computeMarketCap(50, 50);
    expect(result).toBe(184_000);
  });
});

// --------------- computeMarketCap — Edge Cases ---------------

describe("computeMarketCap edge cases", () => {
  it("negative usageScore returns 0", () => {
    expect(computeMarketCap(-5, 10)).toBe(0);
  });

  it("blendedPrice=0 uses MIN_EFFECTIVE_PRICE", () => {
    const result = computeMarketCap(50, 0);
    // effectivePrice = 0.10, priceWeight = log10(1.1)/log10(21)
    expect(result).toBeGreaterThan(0);
    // Compare with explicit MIN_EFFECTIVE_PRICE calculation
    const resultWithMin = computeMarketCap(50, MIN_EFFECTIVE_PRICE);
    expect(result).toBe(resultWithMin);
  });

  it("very high price (above MAX_PRICE_NORMALIZATION) produces priceWeight > 1", () => {
    // price=$50 -> priceWeight = log10(51)/log10(21) > 1
    const highPriceResult = computeMarketCap(50, 50);
    const normalPriceResult = computeMarketCap(50, 20);
    expect(highPriceResult).toBeGreaterThan(normalPriceResult);
  });

  it("result is rounded to nearest 1000", () => {
    const result = computeMarketCap(95, 15);
    expect(result % 1000).toBe(0);
  });
});
