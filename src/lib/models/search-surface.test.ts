import { describe, expect, it } from "vitest";

import {
  prepareSearchSurfaceModels,
  queryRequestsExplicitVariant,
} from "./search-surface";

describe("queryRequestsExplicitVariant", () => {
  it("detects explicit preview intent", () => {
    expect(queryRequestsExplicitVariant("gemini 3.1 pro preview")).toBe(true);
    expect(queryRequestsExplicitVariant("gemini")).toBe(false);
  });
});

describe("prepareSearchSurfaceModels", () => {
  it("prefers default-ready broad search rows when enough ready results exist", () => {
    const results = prepareSearchSurfaceModels(
      [
        {
          id: "official-gemini",
          slug: "google-gemini-3-1-pro",
          name: "Gemini 3.1 Pro",
          provider: "Google",
          category: "multimodal",
          release_date: "2026-02-19",
          overall_rank: 2,
          quality_score: 91,
          capability_score: 94,
          popularity_score: 83,
          adoption_score: 80,
          economic_footprint_score: 72,
          context_window: 1000000,
          description: "Current flagship Gemini model.",
        },
        {
          id: "official-claude",
          slug: "anthropic-claude-opus-4-7",
          name: "Claude Opus 4.7",
          provider: "Anthropic",
          category: "multimodal",
          release_date: "2026-04-16",
          overall_rank: 1,
          quality_score: 93,
          capability_score: 96,
          popularity_score: 85,
          adoption_score: 82,
          economic_footprint_score: 74,
          context_window: 200000,
          description: "Current flagship Claude model.",
        },
        {
          id: "official-gpt",
          slug: "openai-gpt-5-4",
          name: "GPT-5.4",
          provider: "OpenAI",
          category: "multimodal",
          release_date: "2026-04-21",
          overall_rank: 3,
          quality_score: 92,
          capability_score: 95,
          popularity_score: 84,
          adoption_score: 81,
          economic_footprint_score: 73,
          context_window: 1000000,
          description: "Current flagship GPT model.",
        },
        {
          id: "community-preview",
          slug: "community-gemini-3-1-pro-preview",
          name: "Gemini 3.1 Pro Preview",
          provider: "Unknown Labs",
          category: "multimodal",
          release_date: null,
          overall_rank: 12,
          quality_score: 51,
          capability_score: 58,
          popularity_score: 35,
          adoption_score: 21,
          economic_footprint_score: 14,
          context_window: null,
          description: "Community preview mirror with no official metadata.",
        },
      ],
      "gemini",
      10
    );

    expect(results.map((model) => model.id)).toEqual([
      "official-gemini",
      "official-claude",
      "official-gpt",
    ]);
  });

  it("preserves explicit preview searches", () => {
    const results = prepareSearchSurfaceModels(
      [
        {
          id: "standard-gemini",
          slug: "google-gemini-3-1-pro",
          name: "Gemini 3.1 Pro",
          provider: "Google",
          category: "multimodal",
          release_date: "2026-02-19",
          overall_rank: 2,
          quality_score: 91,
          capability_score: 94,
          popularity_score: 83,
          adoption_score: 80,
          economic_footprint_score: 72,
          context_window: 1000000,
          description: "Current flagship Gemini model.",
        },
        {
          id: "preview-gemini",
          slug: "google-gemini-3-1-pro-preview",
          name: "Gemini 3.1 Pro Preview",
          provider: "Google",
          category: "multimodal",
          release_date: "2026-02-10",
          overall_rank: 5,
          quality_score: 88,
          capability_score: 90,
          popularity_score: 75,
          adoption_score: 63,
          economic_footprint_score: 60,
          context_window: 1000000,
          description: "Preview Gemini 3.1 Pro release.",
        },
      ],
      "gemini 3.1 pro preview",
      10
    );

    expect(results[0]?.id).toBe("preview-gemini");
    expect(results.map((model) => model.id)).toContain("preview-gemini");
  });
});
