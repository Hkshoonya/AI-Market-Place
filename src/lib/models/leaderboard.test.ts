import { describe, expect, it } from "vitest";

import {
  getLeaderboardLensRank,
  sortModelsForLens,
  type LeaderboardLensModel,
} from "./leaderboard";

const models: LeaderboardLensModel[] = [
  {
    slug: "null-capability",
    overall_rank: 1,
    capability_rank: null,
    popularity_rank: 3,
    adoption_rank: 3,
    economic_footprint_rank: 3,
    balanced_rank: 3,
    capability_score: null,
    popularity_score: 30,
    adoption_score: 30,
    economic_footprint_score: 30,
    value_score: 30,
    usage_score: null,
    expert_score: null,
  },
  {
    slug: "capability-leader",
    overall_rank: 9,
    capability_rank: 1,
    popularity_rank: 2,
    adoption_rank: 2,
    economic_footprint_rank: 2,
    balanced_rank: 2,
    capability_score: 95,
    popularity_score: 80,
    adoption_score: 80,
    economic_footprint_score: 80,
    value_score: 80,
    usage_score: null,
    expert_score: null,
  },
  {
    slug: "capability-second",
    overall_rank: 8,
    capability_rank: 2,
    popularity_rank: 1,
    adoption_rank: 1,
    economic_footprint_rank: 1,
    balanced_rank: 1,
    capability_score: 90,
    popularity_score: 90,
    adoption_score: 90,
    economic_footprint_score: 90,
    value_score: 90,
    usage_score: null,
    expert_score: null,
  },
];

describe("leaderboard lens helpers", () => {
  it("sorts capability models with null coverage last", () => {
    const sorted = sortModelsForLens(models, "capability");

    expect(sorted.map((model) => model.slug)).toEqual([
      "capability-leader",
      "capability-second",
      "null-capability",
    ]);
  });

  it("returns MAX_SAFE_INTEGER rank for unranked models so they sort after covered rows", () => {
    expect(getLeaderboardLensRank(models[0], "capability")).toBe(Number.MAX_SAFE_INTEGER);
    expect(getLeaderboardLensRank(models[1], "capability")).toBe(1);
  });
});
