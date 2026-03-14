import { describe, expect, it } from "vitest";

import {
  computePopularDiscoveryScore,
  computeTrendingDiscoveryScore,
  sortByDiscoveryScore,
} from "./discovery";

describe("model discovery scoring", () => {
  it("prefers recent high-signal models for trending instead of stale raw download winners", () => {
    const now = new Date("2026-03-14T00:00:00.000Z");

    const stale = computeTrendingDiscoveryScore(
      {
        popularity_score: 48,
        adoption_score: 42,
        economic_footprint_score: 40,
        quality_score: 52,
        hf_downloads: 90_000_000,
        hf_likes: 0,
        hf_trending_score: 0,
        release_date: "2023-01-01",
      },
      now
    );

    const fresh = computeTrendingDiscoveryScore(
      {
        popularity_score: 63,
        adoption_score: 58,
        economic_footprint_score: 55,
        quality_score: 74,
        hf_downloads: 120_000,
        hf_likes: 4_000,
        hf_trending_score: 320,
        release_date: "2026-03-01",
      },
      now
    );

    expect(fresh).toBeGreaterThan(stale);
  });

  it("uses blended traction for popularity instead of raw downloads alone", () => {
    const downloadHeavy = computePopularDiscoveryScore({
      popularity_score: 25,
      adoption_score: 18,
      economic_footprint_score: 16,
      hf_downloads: 500_000_000,
      hf_likes: 1_000,
    });

    const broadlyAdopted = computePopularDiscoveryScore({
      popularity_score: 72,
      adoption_score: 81,
      economic_footprint_score: 68,
      hf_downloads: 3_000_000,
      hf_likes: 9_000,
    });

    expect(broadlyAdopted).toBeGreaterThan(downloadHeavy);
  });

  it("sorts models by the computed discovery score descending", () => {
    const models = sortByDiscoveryScore(
      [
        { slug: "a", popularity_score: 30, adoption_score: 25, economic_footprint_score: 22, hf_downloads: 1_000 },
        { slug: "b", popularity_score: 70, adoption_score: 65, economic_footprint_score: 62, hf_downloads: 10_000 },
      ],
      (model) => computePopularDiscoveryScore(model)
    );

    expect(models.map((model) => model.slug)).toEqual(["b", "a"]);
  });
});
