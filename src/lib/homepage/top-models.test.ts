import { describe, expect, it } from "vitest";

import { selectHomepageTopModelIds } from "./top-models";

describe("selectHomepageTopModelIds", () => {
  it("prioritizes enterprise traction and real-world usage over a single raw rank", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "economic-only",
          overall_rank: 42,
          economic_footprint_score: 95,
          adoption_score: 42,
          capability_score: 50,
          quality_score: 58,
          popularity_score: 40,
        },
        {
          id: "balanced-enterprise-leader",
          overall_rank: 5,
          economic_footprint_score: 89,
          adoption_score: 86,
          capability_score: 91,
          quality_score: 90,
          popularity_score: 72,
        },
        {
          id: "quality-only",
          overall_rank: 14,
          economic_footprint_score: 55,
          adoption_score: 44,
          capability_score: 96,
          quality_score: 97,
          popularity_score: 30,
        },
      ],
      2
    );

    expect(ids[0]).toBe("balanced-enterprise-leader");
    expect(ids).toContain("quality-only");
  });

  it("does not let legacy footprint leaders outrank stronger current top models", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "legacy-footprint-winner",
          overall_rank: 42,
          economic_footprint_score: 89.1,
          adoption_score: 87.5,
          capability_score: 77.8,
          quality_score: 68.7,
          popularity_score: 63,
        },
        {
          id: "current-top-model",
          overall_rank: 12,
          economic_footprint_score: 71.6,
          adoption_score: 90.6,
          capability_score: 78.1,
          quality_score: 77.3,
          popularity_score: 65.3,
        },
      ],
      2
    );

    expect(ids[0]).toBe("current-top-model");
  });
});
