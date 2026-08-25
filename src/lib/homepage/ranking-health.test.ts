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

  it("does not report an older release when a newer model in the same series is selected", () => {
    const result = computeHomepageRankingHealth(
      [
        {
          id: "glm-5-2",
          slug: "zai-org-glm-5-2",
          name: "GLM-5.2",
          provider: "Z.ai",
          category: "llm",
          is_api_available: true,
          overall_rank: 1,
          economic_footprint_score: 92,
          adoption_score: 92,
          capability_score: 92,
          quality_score: 92,
          popularity_score: 92,
          release_date: "2026-06-16",
          description: "Z.ai's latest flagship model for long-horizon tasks.",
        },
        {
          id: "glm-5-3",
          slug: "z-ai-glm-5-3",
          name: "GLM-5.3",
          provider: "Z.ai",
          category: "llm",
          is_api_available: true,
          overall_rank: 200,
          economic_footprint_score: 42,
          adoption_score: 48,
          capability_score: 57,
          quality_score: 39,
          popularity_score: 34,
          release_date: "2026-08-14",
          description:
            "Z.ai's frontier coding and cyber-reasoning model for long-horizon agentic work.",
        },
      ],
      1,
      Date.parse("2026-08-25T12:00:00Z")
    );

    expect(result.shortlist).toEqual([
      expect.objectContaining({ slug: "z-ai-glm-5-3" }),
    ]);
    expect(result.missingRecentLeadership).toHaveLength(0);
    expect(result.healthy).toBe(true);
  });
});
