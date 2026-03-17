import { describe, expect, it } from "vitest";

import { readResource } from "./resources";

describe("MCP resources", () => {
  it("includes cleaned display descriptions in the model catalog resource", async () => {
    const supabase = {
      from: (table: string) => {
        if (table !== "models") throw new Error(`Unexpected table ${table}`);
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
                      status: "active",
                      quality_score: 84,
                      hf_downloads: 1_000_000,
                      overall_rank: 12,
                      is_open_weights: false,
                      release_date: null,
                      description: "TensorFlow-based neural network library",
                      short_description: null,
                    },
                  ],
                }),
              }),
            }),
          }),
        };
      },
    };

    const result = await readResource(supabase as never, "models://catalog");

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
});
