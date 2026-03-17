import { describe, expect, it } from "vitest";

import { getModelSearchRelevance, rankModelsForSearch } from "./search-ranking";

describe("search ranking helpers", () => {
  it("prefers direct name matches over popularity-only wins", () => {
    const sonnet = {
      slug: "google-deepmind-sonnet",
      name: "Sonnet",
      provider: "Google",
      popularity_score: 10,
      overall_rank: 500,
    };
    const claude = {
      slug: "anthropic-claude-4-sonnet",
      name: "Claude 4 Sonnet",
      provider: "Anthropic",
      popularity_score: 90,
      overall_rank: 50,
    };

    expect(getModelSearchRelevance(sonnet, "sonnet")).toBeGreaterThan(
      getModelSearchRelevance(claude, "sonnet")
    );
  });

  it("keeps popularity as a tiebreaker among similarly relevant matches", () => {
    const ranked = rankModelsForSearch(
      [
        {
          slug: "openai-gpt-4-1-mini",
          name: "GPT-4.1 Mini",
          provider: "OpenAI",
          popularity_score: 50,
          overall_rank: 12,
        },
        {
          slug: "openai-gpt-4-1-nano",
          name: "GPT-4.1 Nano",
          provider: "OpenAI",
          popularity_score: 70,
          overall_rank: 30,
        },
      ],
      "gpt 4 1"
    );

    expect(ranked[0]?.slug).toBe("openai-gpt-4-1-nano");
  });
});
