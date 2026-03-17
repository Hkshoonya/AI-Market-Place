import { describe, expect, it } from "vitest";

import { executeTool } from "./tools";

function createMockSupabase() {
  return {
    from: (table: string) => {
      if (table === "models") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      slug: "google-deepmind-sonnet",
                      name: "Sonnet",
                      provider: "Google",
                      category: "llm",
                      description: "TensorFlow-based neural network library",
                      short_description: null,
                      quality_score: 84,
                      hf_downloads: 1_000_000,
                      overall_rank: 12,
                      is_open_weights: false,
                    },
                  ],
                  error: null,
                }),
              }),
              single: async () => ({
                data: {
                  slug: "google-deepmind-sonnet",
                  name: "Sonnet",
                  provider: "Google",
                  category: "llm",
                  description: "TensorFlow-based neural network library",
                  short_description: null,
                  benchmark_scores: [],
                  model_pricing: [],
                  elo_ratings: [],
                  rankings: [],
                },
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("MCP model tools", () => {
  it("returns cleaned display descriptions for search_models", async () => {
    const result = await executeTool(
      createMockSupabase() as never,
      "search_models",
      { limit: 1 }
    );

    expect(result).toEqual(
      expect.objectContaining({
        models: [
          expect.objectContaining({
            slug: "google-deepmind-sonnet",
            display_description: expect.stringMatching(/Google llm model/i),
          }),
        ],
      })
    );
  });

  it("returns cleaned display descriptions for get_model", async () => {
    const result = await executeTool(
      createMockSupabase() as never,
      "get_model",
      { slug: "google-deepmind-sonnet" }
    );

    expect(result).toEqual(
      expect.objectContaining({
        slug: "google-deepmind-sonnet",
        display_description: expect.stringMatching(/Google llm model/i),
      })
    );
  });
});
