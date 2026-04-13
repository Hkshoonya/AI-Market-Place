import { describe, expect, it } from "vitest";

import {
  computePublicRankingConfidenceScore,
  getPublicRankingConfidenceTier,
  selectPublicRankingPool,
} from "./public-ranking-confidence";

describe("public ranking confidence", () => {
  it("scores benchmark-backed strong models above weak stale entries", () => {
    const strong = computePublicRankingConfidenceScore({
      slug: "anthropic-claude-opus-4-6",
      name: "Claude Opus 4.6",
      provider: "Anthropic",
      category: "llm",
      release_date: "2026-02-20",
      overall_rank: 4,
      capability_score: 93,
      quality_score: 91,
      adoption_score: 75,
      popularity_score: 72,
      economic_footprint_score: 68,
      benchmark_scores: [{ id: "bench-1", source: "livebench" }],
    });
    const weak = computePublicRankingConfidenceScore({
      slug: "provider-model-mini",
      name: "Provider Model Mini",
      provider: "Provider",
      category: "llm",
      release_date: "2024-01-10",
      overall_rank: 6,
      capability_score: 58,
      quality_score: 54,
      adoption_score: 18,
      popularity_score: 32,
      economic_footprint_score: 12,
    });

    expect(strong).toBeGreaterThan(weak);
    expect(getPublicRankingConfidenceTier({
      slug: "anthropic-claude-opus-4-6",
      name: "Claude Opus 4.6",
      provider: "Anthropic",
      category: "llm",
      release_date: "2026-02-20",
      overall_rank: 4,
      capability_score: 93,
      quality_score: 91,
      adoption_score: 75,
      popularity_score: 72,
      economic_footprint_score: 68,
      benchmark_scores: [{ id: "bench-1", source: "livebench" }],
    })).toBe("high");
  });

  it("prefers medium/high-confidence pools when enough options exist", () => {
    const selected = selectPublicRankingPool(
      [
        {
          slug: "high-a",
          name: "High A",
          provider: "Provider",
          category: "llm",
          release_date: "2026-02-20",
          capability_score: 90,
          quality_score: 88,
          adoption_score: 70,
          benchmark_scores: [{ id: "bench-1", source: "artificial-analysis" }],
        },
        {
          slug: "medium-b",
          name: "Medium B",
          provider: "Provider",
          category: "llm",
          release_date: "2025-11-20",
          capability_score: 78,
          quality_score: 70,
          adoption_score: 45,
        },
        {
          slug: "low-c",
          name: "Low C Mini",
          provider: "Provider",
          category: "llm",
          release_date: "2024-01-10",
          capability_score: 55,
          quality_score: 50,
          popularity_score: 20,
        },
      ],
      2
    );

    expect(selected.map((model) => model.slug)).toEqual(["high-a", "medium-b"]);
  });

  it("does not give full benchmark credit to rows without trusted source provenance", () => {
    const trusted = computePublicRankingConfidenceScore({
      slug: "trusted-model",
      name: "Trusted Model",
      provider: "Provider",
      category: "llm",
      release_date: "2026-02-20",
      capability_score: 74,
      quality_score: 70,
      benchmark_scores: [{ id: "bench-1", source: "livebench" }],
    });
    const untrusted = computePublicRankingConfidenceScore({
      slug: "untrusted-model",
      name: "Untrusted Model",
      provider: "Provider",
      category: "llm",
      release_date: "2026-02-20",
      capability_score: 74,
      quality_score: 70,
      benchmark_scores: [{ id: "bench-1", source: "unknown-feed" }],
    });

    expect(trusted).toBeGreaterThan(untrusted);
  });
});
