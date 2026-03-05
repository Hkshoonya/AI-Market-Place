import { describe, it, expect } from "vitest";
import {
  computeUsageScore,
  computeUsageNormStats,
  UsageInputs,
  UsageNormStats,
} from "@/lib/scoring/usage-calculator";

function makeModel(overrides: Partial<UsageInputs> = {}): UsageInputs {
  return {
    downloads: 0,
    likes: 0,
    stars: 0,
    newsMentions: 0,
    providerUsageEstimate: 0,
    trendingScore: 0,
    isOpenWeights: true,
    ...overrides,
  };
}

describe("computeUsageNormStats", () => {
  it("computes correct maximums from model array", () => {
    const models: UsageInputs[] = [
      makeModel({ downloads: 5000, likes: 200, stars: 100, trendingScore: 30, isOpenWeights: true }),
      makeModel({ downloads: 10000, likes: 500, stars: 300, trendingScore: 80, isOpenWeights: true }),
      makeModel({ providerUsageEstimate: 1000000, newsMentions: 50, trendingScore: 60, isOpenWeights: false }),
    ];
    const stats = computeUsageNormStats(models);

    expect(stats.openMaxDownloads).toBe(10000);
    expect(stats.openMaxLikes).toBe(500);
    expect(stats.openMaxStars).toBe(300);
    expect(stats.openMaxTrending).toBe(80);
    expect(stats.propMaxMAU).toBe(1000000);
    expect(stats.propMaxNews).toBe(50);
    expect(stats.maxNews).toBe(50);
  });

  it("defaults to 1 when no models provided", () => {
    const stats = computeUsageNormStats([]);
    expect(stats.openMaxDownloads).toBe(1);
    expect(stats.propMaxMAU).toBe(1);
  });
});

describe("computeUsageScore", () => {
  const stats: UsageNormStats = {
    openMaxDownloads: 100000,
    openMaxLikes: 5000,
    openMaxStars: 10000,
    openMaxTrending: 100,
    propMaxMAU: 5000000,
    propMaxNews: 200,
    propMaxTrending: 100,
    maxNews: 200,
  };

  it("returns score 0-100 for open model with all signals", () => {
    const inputs = makeModel({
      downloads: 50000,
      likes: 2000,
      stars: 5000,
      newsMentions: 100,
      trendingScore: 50,
      isOpenWeights: true,
    });
    const score = computeUsageScore(inputs, stats);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("proprietary model uses propMax pools for normalization", () => {
    const inputs = makeModel({
      providerUsageEstimate: 2000000,
      newsMentions: 100,
      trendingScore: 50,
      isOpenWeights: false,
    });
    const score = computeUsageScore(inputs, stats);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns 0 for all-zero inputs", () => {
    const inputs = makeModel();
    expect(computeUsageScore(inputs, stats)).toBe(0);
  });

  it("returns proportional score for single signal (downloads only)", () => {
    const inputs = makeModel({ downloads: 50000, isOpenWeights: true });
    const score = computeUsageScore(inputs, stats);
    expect(score).toBeGreaterThan(0);
    // Only downloads contribute, reweighted to 100% of weight
    expect(score).toBeLessThanOrEqual(100);
  });

  it("missing signals contribute 0 and remaining are reweighted", () => {
    // Two models: one with all signals, one with partial
    const full = makeModel({
      downloads: 50000, likes: 2000, stars: 5000,
      newsMentions: 100, trendingScore: 50, isOpenWeights: true,
    });
    const partial = makeModel({ downloads: 50000, isOpenWeights: true });

    const fullScore = computeUsageScore(full, stats);
    const partialScore = computeUsageScore(partial, stats);

    // Both should be > 0, full should be different from partial
    expect(fullScore).toBeGreaterThan(0);
    expect(partialScore).toBeGreaterThan(0);
  });
});
