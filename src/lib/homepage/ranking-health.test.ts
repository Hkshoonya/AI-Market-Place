import { describe, expect, it } from "vitest";

import { computeHomepageRankingHealth } from "./ranking-health";

describe("computeHomepageRankingHealth", () => {
  it("flags lifecycle-warning rows when they still surface in the shortlist", () => {
    const result = computeHomepageRankingHealth(
      [
        {
          id: "previous-opus",
          slug: "anthropic-claude-opus-4-6",
          name: "Claude Opus 4.6",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 14,
          economic_footprint_score: 53.6,
          adoption_score: 55.4,
          capability_score: 80.2,
          quality_score: 60.3,
          popularity_score: 47.8,
          release_date: "2025-12-12",
          description:
            "Previous flagship Claude Opus release retained for compatibility after the Claude Opus 4.7 launch. Still strong, but superseded by Opus 4.7.",
        },
      ],
      1,
      Date.parse("2026-04-18T00:00:00Z")
    );

    expect(result.healthy).toBe(false);
    expect(result.missingRecentLeadership).toHaveLength(0);
    expect(result.lifecycleRowsInShortlist).toEqual([
      expect.objectContaining({ slug: "anthropic-claude-opus-4-6" }),
    ]);
  });

  it("stays healthy when the shortlist contains the current leadership row", () => {
    const result = computeHomepageRankingHealth(
      [
        {
          id: "new-opus",
          slug: "anthropic-claude-opus-4-7",
          name: "Claude Opus 4.7",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 10,
          economic_footprint_score: 57.6,
          adoption_score: 68.6,
          capability_score: 69.2,
          quality_score: 54.8,
          popularity_score: 49,
          release_date: "2026-04-16",
          description:
            "Anthropic's latest generally available flagship. Improves on Opus 4.6 for advanced software engineering and self-verification.",
        },
      ],
      1,
      Date.parse("2026-04-18T00:00:00Z")
    );

    expect(result.healthy).toBe(true);
    expect(result.missingRecentLeadership).toHaveLength(0);
    expect(result.lifecycleRowsInShortlist).toHaveLength(0);
  });
});
