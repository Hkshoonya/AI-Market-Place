import { describe, expect, it } from "vitest";

import {
  computePopularityScore,
  computePopularityStats,
  type PopularityInputs,
} from "./popularity-score";

function makeInputs(overrides: Partial<PopularityInputs> = {}): PopularityInputs {
  return {
    downloads: 0,
    likes: 0,
    stars: 0,
    newsMentions: 0,
    providerUsageEstimate: 0,
    trendingScore: 0,
    releaseDate: null,
    ...overrides,
  };
}

describe("computePopularityScore", () => {
  const stats = computePopularityStats([
    makeInputs({
      downloads: 2_000_000,
      likes: 80_000,
      stars: 120_000,
      newsMentions: 200,
      providerUsageEstimate: 400_000_000,
      trendingScore: 100,
      releaseDate: "2024-01-01",
    }),
    makeInputs({
      downloads: 100_000,
      likes: 5_000,
      stars: 10_000,
      newsMentions: 25,
      providerUsageEstimate: 10_000_000,
      trendingScore: 40,
      releaseDate: "2025-01-01",
    }),
  ]);

  it("rewards broad durable traction over one-signal hype spikes", () => {
    const durable = computePopularityScore(
      makeInputs({
        downloads: 1_400_000,
        likes: 60_000,
        stars: 90_000,
        newsMentions: 110,
        providerUsageEstimate: 250_000_000,
        trendingScore: 50,
        releaseDate: "2024-02-01",
      }),
      stats
    );

    const hypeSpike = computePopularityScore(
      makeInputs({
        downloads: 0,
        likes: 0,
        stars: 0,
        newsMentions: 200,
        providerUsageEstimate: 5_000_000,
        trendingScore: 100,
        releaseDate: "2026-02-20",
      }),
      stats
    );

    expect(durable).toBeGreaterThan(hypeSpike);
  });

  it("still counts adoption-heavy proprietary models as popular", () => {
    const proprietary = computePopularityScore(
      makeInputs({
        downloads: 0,
        likes: 0,
        stars: 0,
        newsMentions: 75,
        providerUsageEstimate: 380_000_000,
        trendingScore: 62,
        releaseDate: "2024-06-01",
      }),
      stats
    );

    expect(proprietary).toBeGreaterThan(40);
  });
});
