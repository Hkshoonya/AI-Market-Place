import { describe, expect, it } from "vitest";

import {
  buildTopMoversPayload,
  type SnapshotRow,
  type TopMoversDataClient,
} from "./logic";

function createClientFixture(): TopMoversDataClient {
  const snapshotsByDate: Record<string, SnapshotRow[]> = {
    "2026-03-13": [
      { model_id: "model-a", overall_rank: 2, quality_score: 72 },
      { model_id: "model-b", overall_rank: 5, quality_score: 66 },
    ],
    "2026-03-12": [
      { model_id: "model-a", overall_rank: 7, quality_score: 68 },
      { model_id: "model-b", overall_rank: 3, quality_score: 70 },
    ],
  };

  return {
    async fetchSnapshotsForDate(date) {
      return snapshotsByDate[date] ?? [];
    },
    async fetchLatestSnapshotDate(beforeDate) {
      if (!beforeDate) return "2026-03-13";
      if (beforeDate === "2026-03-13") return "2026-03-12";
      return null;
    },
    async fetchModels(modelIds) {
      return modelIds.map((id) => ({
        id,
        name: id === "model-a" ? "Model Alpha" : "Model Beta",
        slug: id === "model-a" ? "model-alpha" : "model-beta",
        provider: id === "model-a" ? "OpenAI" : "Anthropic",
        category: "llms",
      }));
    },
  };
}

describe("buildTopMoversPayload", () => {
  it("falls back to the latest two distinct snapshot dates when today has no rows", async () => {
    const payload = await buildTopMoversPayload(createClientFixture(), {
      today: "2026-03-14",
      yesterday: "2026-03-13",
      limit: 10,
    });

    expect(payload.asOf).toBe("2026-03-13");
    expect(payload.risers).toEqual([
      expect.objectContaining({
        slug: "model-alpha",
        rankChange: 5,
        currentRank: 2,
      }),
    ]);
    expect(payload.fallers).toEqual([
      expect.objectContaining({
        slug: "model-beta",
        rankChange: -2,
        currentRank: 5,
      }),
    ]);
  });
});
