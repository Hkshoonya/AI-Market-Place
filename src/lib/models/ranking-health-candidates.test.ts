import { describe, expect, it } from "vitest";

import { selectRankingHealthModelCandidates } from "./ranking-health-candidates";

describe("selectRankingHealthModelCandidates", () => {
  it("bounds family analysis while retaining every positive ranking signal", () => {
    const noise = Array.from({ length: 1200 }, (_, index) => ({
      id: `noise-${index}`,
      slug: `noise-${index}`,
      name: `Noise ${index}`,
      provider: "Community",
      category: "llm",
      release_date: "2020-01-01",
    }));
    const ranked = Array.from({ length: 20 }, (_, index) => ({
      id: `ranked-${index}`,
      slug: `ranked-${index}`,
      name: `Ranked ${index}`,
      provider: "Provider",
      category: "llm",
      release_date: "2024-01-01",
      overall_rank: index + 1,
      quality_score: 70 - index,
    }));
    const models = [...noise, ...ranked];

    const selected = selectRankingHealthModelCandidates(
      models,
      100,
      Date.parse("2026-08-25T00:00:00.000Z")
    );
    const selectedIds = new Set(selected.map((model) => model.id));

    expect(selected).toHaveLength(100);
    expect(ranked.every((model) => selectedIds.has(model.id))).toBe(true);
    expect(models.at(0)?.id).toBe("noise-0");
  });

  it("returns the original collection when it is already below the limit", () => {
    const models = [{ id: "only-model" }];

    expect(selectRankingHealthModelCandidates(models, 10)).toBe(models);
  });
});
