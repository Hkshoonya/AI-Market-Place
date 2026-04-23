import { describe, expect, it } from "vitest";

import { SEARCH_MODEL_SELECT, searchModelsWithFallback } from "./search-query";

describe("SEARCH_MODEL_SELECT", () => {
  it("includes the readiness fields used by search surface filtering", () => {
    expect(SEARCH_MODEL_SELECT).toContain("context_window");
    expect(SEARCH_MODEL_SELECT).toContain("license");
    expect(SEARCH_MODEL_SELECT).toContain("license_name");
    expect(SEARCH_MODEL_SELECT).toContain("is_api_available");
    expect(SEARCH_MODEL_SELECT).toContain("status");
    expect(SEARCH_MODEL_SELECT).toContain("description");
    expect(SEARCH_MODEL_SELECT).toContain("short_description");
  });
});

describe("searchModelsWithFallback", () => {
  it("merges FTS and ilike matches so slug-only variants are not dropped", async () => {
    const queryClient = {
      from: () => ({
        select: () => ({
          textSearch: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      id: "model-standard",
                      slug: "google-gemini-3-1-pro",
                    },
                  ],
                  error: null,
                  count: 1,
                }),
              }),
            }),
          }),
          eq: () => ({
            or: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      id: "model-standard",
                      slug: "google-gemini-3-1-pro",
                    },
                    {
                      id: "model-preview",
                      slug: "google-gemini-3-1-pro-preview",
                    },
                  ],
                  error: null,
                  count: 2,
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const result = await searchModelsWithFallback(queryClient, "gemini 3.1 pro preview", 50);

    expect(result.data.map((row) => row.slug)).toEqual([
      "google-gemini-3-1-pro",
      "google-gemini-3-1-pro-preview",
    ]);
    expect(result.count).toBe(2);
  });
});
