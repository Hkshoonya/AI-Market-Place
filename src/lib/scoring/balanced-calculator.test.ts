import { describe, it, expect } from "vitest";
import { computeBalancedRankings } from "@/lib/scoring/balanced-calculator";

describe("computeBalancedRankings", () => {
  it("ranks models in correct order (rank 1 = best composite)", () => {
    const models = [
      { id: "a", category: "llm", capabilityRank: 1, usageRank: 1, expertRank: 1, valueRank: 1 },
      { id: "b", category: "llm", capabilityRank: 2, usageRank: 2, expertRank: 2, valueRank: 2 },
      { id: "c", category: "llm", capabilityRank: 3, usageRank: 3, expertRank: 3, valueRank: 3 },
    ];
    const result = computeBalancedRankings(models);
    expect(result.find((r) => r.id === "a")!.balanced_rank).toBe(1);
    expect(result.find((r) => r.id === "b")!.balanced_rank).toBe(2);
    expect(result.find((r) => r.id === "c")!.balanced_rank).toBe(3);
  });

  it("null capabilityRank defaults to worst-case (maxRank)", () => {
    // Give model "b" better ranks in all other dimensions too,
    // so nulling capabilityRank on "a" makes it clearly worse
    const models = [
      { id: "a", category: "llm", capabilityRank: null, usageRank: 2, expertRank: 2, valueRank: 2 },
      { id: "b", category: "llm", capabilityRank: 1, usageRank: 1, expertRank: 1, valueRank: 1 },
    ];
    const result = computeBalancedRankings(models);
    // Model "a" has capabilityRank = maxRank (2) and worse ranks elsewhere
    const rankA = result.find((r) => r.id === "a")!.balanced_rank;
    const rankB = result.find((r) => r.id === "b")!.balanced_rank;
    expect(rankB).toBe(1);
    expect(rankA).toBe(2);
  });

  it("null valueRank defaults to worst-case (maxRank)", () => {
    const models = [
      { id: "a", category: "llm", capabilityRank: 1, usageRank: 1, expertRank: 1, valueRank: null },
      { id: "b", category: "llm", capabilityRank: 1, usageRank: 1, expertRank: 1, valueRank: 1 },
    ];
    const result = computeBalancedRankings(models);
    // Model b has better value rank, so should rank higher
    expect(result.find((r) => r.id === "b")!.balanced_rank).toBe(1);
  });

  it("applies category-specific weights (image_generation gets higher usage weight)", () => {
    // Two models: same ranks, different categories -> different composites
    const models = [
      { id: "img", category: "image_generation", capabilityRank: 2, usageRank: 1, expertRank: 2, valueRank: 2 },
      { id: "llm", category: "llm", capabilityRank: 2, usageRank: 1, expertRank: 2, valueRank: 2 },
    ];
    const result = computeBalancedRankings(models);
    // image_generation has usage weight 0.40 vs llm 0.30
    // Both have same ranks, but image_gen weighs usage more (usageRank=1 is good)
    // so image_gen should have better (lower) composite
    const imgRank = result.find((r) => r.id === "img")!.balanced_rank;
    const llmRank = result.find((r) => r.id === "llm")!.balanced_rank;
    expect(imgRank).toBe(1);
    expect(llmRank).toBe(2);
  });

  it("single model returns rank 1", () => {
    const models = [
      { id: "only", category: "llm", capabilityRank: 5, usageRank: 3, expertRank: 7, valueRank: 2 },
    ];
    const result = computeBalancedRankings(models);
    expect(result).toHaveLength(1);
    expect(result[0].balanced_rank).toBe(1);
    expect(result[0].category_balanced_rank).toBe(1);
  });

  it("category-balanced ranks are within-category orderings", () => {
    const models = [
      { id: "llm1", category: "llm", capabilityRank: 1, usageRank: 1, expertRank: 1, valueRank: 1 },
      { id: "img1", category: "image_generation", capabilityRank: 2, usageRank: 2, expertRank: 2, valueRank: 2 },
      { id: "llm2", category: "llm", capabilityRank: 3, usageRank: 3, expertRank: 3, valueRank: 3 },
      { id: "img2", category: "image_generation", capabilityRank: 4, usageRank: 4, expertRank: 4, valueRank: 4 },
    ];
    const result = computeBalancedRankings(models);

    const llm1 = result.find((r) => r.id === "llm1")!;
    const llm2 = result.find((r) => r.id === "llm2")!;
    const img1 = result.find((r) => r.id === "img1")!;
    const img2 = result.find((r) => r.id === "img2")!;

    // Within LLM category
    expect(llm1.category_balanced_rank).toBe(1);
    expect(llm2.category_balanced_rank).toBe(2);
    // Within image_generation category
    expect(img1.category_balanced_rank).toBe(1);
    expect(img2.category_balanced_rank).toBe(2);
  });

  it("allows bounded negative rank penalties to boost current leadership rows", () => {
    const models = [
      { id: "bonus", category: "llm", capabilityRank: 13, usageRank: 20, expertRank: 13, valueRank: 20, rankPenalty: -20 },
      { id: "baseline", category: "llm", capabilityRank: 12, usageRank: 20, expertRank: 12, valueRank: 20, rankPenalty: 0 },
    ];
    const result = computeBalancedRankings(models);
    expect(result.find((row) => row.id === "bonus")?.balanced_rank).toBe(1);
  });
});
