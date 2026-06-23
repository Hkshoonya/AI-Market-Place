import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logging", () => ({
  systemLog: {
    warn: vi.fn().mockResolvedValue(null),
  },
}));

import { systemLog } from "@/lib/logging";
import { buildBenchmarkTrackingSummaryMap } from "@/lib/models/benchmark-tracking-bulk";

const warnMock = vi.mocked(systemLog.warn);

describe("buildBenchmarkTrackingSummaryMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps building summaries when benchmark score fetch rejects", async () => {
    const queryClient = {
      from: (table: string) => {
        if (table === "benchmark_scores") {
          return {
            select: () => ({
              in: () => Promise.reject(new TypeError("fetch failed")),
            }),
          };
        }

        if (table === "elo_ratings") {
          return {
            select: () => ({
              in: async () => ({
                data: [{ model_id: "gemma-4" }],
                error: null,
              }),
            }),
          };
        }

        if (table === "model_news") {
          return {
            select: () => ({
              overlaps: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        id: "benchmark-gemma-4",
                        title: "Gemma 4 benchmark results",
                        source: "provider-blog",
                        category: "benchmark",
                        related_model_ids: ["gemma-4"],
                        metadata: { signal_type: "benchmark" },
                        published_at: "2026-04-01T00:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    const summaries = await buildBenchmarkTrackingSummaryMap(queryClient, [
      {
        id: "gemma-4",
        slug: "google-gemma-4-31b-it",
        provider: "Google",
        category: "multimodal",
      },
    ]);

    expect(summaries.get("gemma-4")).toEqual(
      expect.objectContaining({
        status: "provider_reported",
        badgeLabel: "Provider-reported*",
      })
    );
    expect(warnMock).toHaveBeenCalledWith(
      "benchmark-tracking",
      "Failed to fetch benchmark scores",
      expect.objectContaining({
        error: "fetch failed",
      })
    );
  });

  it("ignores benchmark rows from untrusted sources when building structured coverage", async () => {
    const queryClient = {
      from: (table: string) => {
        if (table === "benchmark_scores") {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  { model_id: "model-1", source: "unknown-feed" },
                  { model_id: "model-1", source: "livebench" },
                ],
                error: null,
              }),
            }),
          };
        }

        if (table === "elo_ratings") {
          return {
            select: () => ({
              in: async () => ({
                data: [],
                error: null,
              }),
            }),
          };
        }

        if (table === "model_news") {
          return {
            select: () => ({
              overlaps: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    const summaries = await buildBenchmarkTrackingSummaryMap(queryClient, [
      {
        id: "model-1",
        slug: "provider-model",
        provider: "Provider",
        category: "llm",
      },
    ]);

    expect(summaries.get("model-1")).toEqual(
      expect.objectContaining({
        status: "structured",
        badgeLabel: "Structured",
      })
    );
  });

  it("treats provider benchmark score rows as structured coverage", async () => {
    const queryClient = {
      from: (table: string) => {
        if (table === "benchmark_scores") {
          return {
            select: () => ({
              in: async () => ({
                data: [{ model_id: "model-1", source: "provider-benchmarks" }],
                error: null,
              }),
            }),
          };
        }

        if (table === "elo_ratings") {
          return {
            select: () => ({
              in: async () => ({
                data: [],
                error: null,
              }),
            }),
          };
        }

        if (table === "model_news") {
          return {
            select: () => ({
              overlaps: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    const summaries = await buildBenchmarkTrackingSummaryMap(queryClient, [
      {
        id: "model-1",
        slug: "provider-model",
        provider: "Provider",
        category: "llm",
      },
    ]);

    expect(summaries.get("model-1")).toEqual(
      expect.objectContaining({
        status: "structured",
        badgeLabel: "Structured",
      })
    );
  });

  it("chunks large model sets and restricts news lookups to benchmark category", async () => {
    const scoreChunks: number[] = [];
    const arenaChunks: number[] = [];
    const newsChunks: number[] = [];
    const newsCategories: string[] = [];

    const queryClient = {
      from: (table: string) => {
        if (table === "benchmark_scores") {
          return {
            select: () => ({
              in: async (_column: string, values: string[]) => {
                scoreChunks.push(values.length);
                return { data: [], error: null };
              },
            }),
          };
        }

        if (table === "elo_ratings") {
          return {
            select: () => ({
              in: async (_column: string, values: string[]) => {
                arenaChunks.push(values.length);
                return { data: [], error: null };
              },
            }),
          };
        }

        if (table === "model_news") {
          return {
            select: () => ({
              eq: (_column: string, value: string) => {
                newsCategories.push(value);
                return {
                  overlaps: (_overlapColumn: string, values: string[]) => {
                    newsChunks.push(values.length);
                    return {
                      order: () => ({
                        limit: async () => ({
                          data: [
                            {
                              id: "benchmark-model-125",
                              title: "Model 125 benchmark results",
                              source: "provider-blog",
                              category: "benchmark",
                              related_model_ids: ["model-125"],
                              metadata: { signal_type: "benchmark" },
                              published_at: "2026-04-01T00:00:00.000Z",
                            },
                            {
                              id: "benchmark-model-125",
                              title: "Model 125 benchmark results",
                              source: "provider-blog",
                              category: "benchmark",
                              related_model_ids: ["model-125"],
                              metadata: { signal_type: "benchmark" },
                              published_at: "2026-04-01T00:00:00.000Z",
                            },
                          ],
                          error: null,
                        }),
                      }),
                    };
                  },
                };
              },
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    const models = Array.from({ length: 125 }, (_, index) => {
      const id = `model-${index + 1}`;
      return {
        id,
        slug: `provider-model-${index + 1}`,
        provider: "Provider",
        category: "llm",
      };
    });

    const summaries = await buildBenchmarkTrackingSummaryMap(queryClient, models);

    expect(scoreChunks).toEqual([100, 25]);
    expect(arenaChunks).toEqual([100, 25]);
    expect(newsChunks).toEqual([100, 25]);
    expect(newsCategories).toEqual(["benchmark", "benchmark"]);
    expect(summaries.get("model-125")).toEqual(
      expect.objectContaining({
        status: "provider_reported",
        badgeLabel: "Provider-reported*",
      })
    );
  });
});
