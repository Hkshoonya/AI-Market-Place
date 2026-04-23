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

  it("uses public confidence to break close search ties before weak popularity signals", () => {
    const ranked = rankModelsForSearch(
      [
        {
          slug: "provider-model-pro",
          name: "Provider Model Pro",
          provider: "Provider",
          popularity_score: 40,
          overall_rank: 18,
          quality_score: 88,
          capability_score: 90,
          adoption_score: 62,
          economic_footprint_score: 50,
          release_date: "2026-02-10",
        },
        {
          slug: "provider-model-mini",
          name: "Provider Model Mini",
          provider: "Provider",
          popularity_score: 75,
          overall_rank: 12,
          quality_score: 54,
          capability_score: 58,
          adoption_score: 18,
          economic_footprint_score: 12,
          release_date: "2024-01-10",
        },
      ],
      "provider model"
    );

    expect(ranked[0]?.slug).toBe("provider-model-pro");
  });

  it("treats broad brand queries as current-flagship searches", () => {
    const ranked = rankModelsForSearch(
      [
        {
          slug: "x-ai-grok-4-20",
          name: "Grok 4.20",
          provider: "xAI",
          popularity_score: 59,
          overall_rank: 41,
          quality_score: 44.1,
          capability_score: 59.2,
          adoption_score: 50,
          economic_footprint_score: 35,
          release_date: "2026-03-31",
          description: "Updated Grok 4 family release for multimodal assistant workflows.",
        },
        {
          slug: "x-ai-grok-4",
          name: "Grok 4",
          provider: "xAI",
          popularity_score: 47,
          overall_rank: 16,
          quality_score: 66.1,
          capability_score: 84.6,
          adoption_score: 65,
          economic_footprint_score: 66.9,
          release_date: "2025-08-20",
          description: "Frontier Grok model built for demanding enterprise reasoning and coding.",
        },
      ],
      "grok"
    );

    expect(ranked[0]?.slug).toBe("x-ai-grok-4");
  });

  it("prefers the current flagship family row for broad provider-family searches", () => {
    const ranked = rankModelsForSearch(
      [
        {
          slug: "google-gemini-2-0-flash-001",
          name: "Gemini 2.0 Flash",
          provider: "Google",
          popularity_score: 55,
          overall_rank: 30,
          quality_score: 50.9,
          capability_score: 71.6,
          adoption_score: 62.7,
          economic_footprint_score: 47.5,
          release_date: "2025-02-05",
          description: "Fast Gemini family model for low-latency assistant tasks.",
        },
        {
          slug: "google-gemini-3-1-pro",
          name: "Gemini 3.1 Pro",
          provider: "Google",
          popularity_score: 46.3,
          overall_rank: 101,
          quality_score: 57.7,
          capability_score: 69.3,
          adoption_score: 52.6,
          economic_footprint_score: 31.9,
          release_date: "2026-02-19",
          description:
            "Updated Gemini 3.1 flagship model that improves on Gemini 2.5 Pro with stronger state-of-the-art performance and broad availability.",
        },
      ],
      "gemini"
    );

    expect(ranked[0]?.slug).toBe("google-gemini-3-1-pro");
  });
});
