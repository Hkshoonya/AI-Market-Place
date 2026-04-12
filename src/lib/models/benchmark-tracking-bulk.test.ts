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
});
