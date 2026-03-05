import { describe, it, expect } from "vitest";
import { computeCommunitySignal } from "@/lib/scoring/community-signal";

describe("computeCommunitySignal", () => {
  const defaultStats = { maxLikes: 10000, maxNewsMentions: 100 };
  const defaultWeights = { community: 0.15 };

  it("returns averaged signal for open model with likes + news", () => {
    const result = computeCommunitySignal(
      { hfLikes: 500, newsMentions: 20, trendingScore: null },
      defaultStats,
      defaultWeights,
      false, // isProprietary
      true   // isHfAvailable
    );
    expect(result).not.toBeNull();
    expect(result!.name).toBe("community");
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.score).toBeLessThanOrEqual(100);
    expect(result!.weight).toBe(0.15);
  });

  it("returns news-based signal for proprietary model", () => {
    const result = computeCommunitySignal(
      { hfLikes: null, newsMentions: 50, trendingScore: null },
      defaultStats,
      defaultWeights,
      true,  // isProprietary
      false  // isHfAvailable
    );
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
  });

  it("returns null when no likes and no news", () => {
    const result = computeCommunitySignal(
      { hfLikes: null, newsMentions: 0, trendingScore: null },
      defaultStats,
      defaultWeights,
      false,
      true
    );
    expect(result).toBeNull();
  });

  it("returns null when not HF available and no news", () => {
    const result = computeCommunitySignal(
      { hfLikes: null, newsMentions: 0, trendingScore: null },
      defaultStats,
      defaultWeights,
      true,
      false
    );
    expect(result).toBeNull();
  });

  it("adds trending boost up to +20", () => {
    const withoutTrending = computeCommunitySignal(
      { hfLikes: 500, newsMentions: 20, trendingScore: null },
      defaultStats,
      defaultWeights,
      false,
      true
    );
    const withTrending = computeCommunitySignal(
      { hfLikes: 500, newsMentions: 20, trendingScore: 30 },
      defaultStats,
      defaultWeights,
      false,
      true
    );
    expect(withTrending!.score).toBeGreaterThan(withoutTrending!.score);
  });

  it("caps trending boost at 20", () => {
    // Very high trending score should still cap the boost at 20
    const result = computeCommunitySignal(
      { hfLikes: 500, newsMentions: 20, trendingScore: 1000 },
      defaultStats,
      defaultWeights,
      false,
      true
    );
    const noTrend = computeCommunitySignal(
      { hfLikes: 500, newsMentions: 20, trendingScore: null },
      defaultStats,
      defaultWeights,
      false,
      true
    );
    const boost = result!.score - noTrend!.score;
    expect(boost).toBeLessThanOrEqual(20);
  });

  it("signal weight matches input weights.community", () => {
    const result = computeCommunitySignal(
      { hfLikes: 100, newsMentions: 10, trendingScore: null },
      defaultStats,
      { community: 0.25 },
      false,
      true
    );
    expect(result!.weight).toBe(0.25);
  });
});
