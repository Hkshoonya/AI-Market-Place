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
            "Previous flagship Claude Opus release retained for compatibility after later Claude Opus launches. Still strong, but superseded by Opus 5.",
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
          slug: "anthropic-claude-opus-5",
          name: "Claude Opus 5",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 10,
          economic_footprint_score: 57.6,
          adoption_score: 68.6,
          capability_score: 69.2,
          quality_score: 54.8,
          popularity_score: 49,
          release_date: "2026-07-24",
          description:
            "Anthropic's current flagship Opus model for complex agentic work, advanced coding, and demanding reasoning.",
        },
      ],
      1,
      Date.parse("2026-07-26T00:00:00Z")
    );

    expect(result.healthy).toBe(true);
    expect(result.missingRecentLeadership).toHaveLength(0);
    expect(result.lifecycleRowsInShortlist).toHaveLength(0);
  });
});
