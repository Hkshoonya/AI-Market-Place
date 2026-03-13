import { describe, expect, it } from "vitest";

import {
  buildContentQualityMetrics,
  collectPaginatedRows,
  filterCoveredActiveModelIds,
  type ActiveModelSummary,
} from "./ux-monitor";

describe("collectPaginatedRows", () => {
  it("collects multiple pages instead of truncating at the default Supabase page size", async () => {
    const rows = Array.from({ length: 1205 }, (_, index) => ({ id: `row-${index}` }));

    const result = await collectPaginatedRows(async (from, to) => {
      return rows.slice(from, to + 1);
    }, 500);

    expect(result).toHaveLength(1205);
    expect(result.at(0)?.id).toBe("row-0");
    expect(result.at(-1)?.id).toBe("row-1204");
  });
});

describe("filterCoveredActiveModelIds", () => {
  it("deduplicates coverage rows and keeps only active model ids", () => {
    const activeModelIds = new Set(["model-a", "model-b", "model-c"]);

    const covered = filterCoveredActiveModelIds(
      [
        { model_id: "model-a" },
        { model_id: "model-a" },
        { model_id: "model-c" },
        { model_id: "inactive-model" },
        { model_id: null },
      ],
      activeModelIds
    );

    expect(Array.from(covered).sort()).toEqual(["model-a", "model-c"]);
  });
});

describe("buildContentQualityMetrics", () => {
  it("computes missing coverage without allowing a negative completeness score", () => {
    const activeModels: ActiveModelSummary[] = [
      { id: "model-a", category: "llm" },
      { id: "model-b", category: "llm" },
      { id: "model-c", category: "vision" },
    ];

    const metrics = buildContentQualityMetrics({
      activeModels,
      missingDescriptionCount: 1,
      benchmarkedModelIds: new Set(["model-a", "model-c"]),
      pricedModelIds: new Set(["model-a"]),
    });

    expect(metrics.totalActiveModels).toBe(3);
    expect(metrics.missingDescription).toBe(1);
    expect(metrics.missingBenchmarks).toBe(1);
    expect(metrics.missingPricing).toBe(2);
    expect(metrics.completenessScore).toBe(56);
  });
});
