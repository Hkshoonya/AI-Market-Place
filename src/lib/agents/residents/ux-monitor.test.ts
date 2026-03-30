import { describe, expect, it } from "vitest";

import {
  buildContentQualityMetrics,
  countStaleSellerListings,
  collectPaginatedRows,
  countModelsMissingUserVisibleDescriptions,
  filterCoveredActiveModelIds,
  filterUserVisiblePricedModelIds,
  getDescriptionCoverageThreshold,
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

describe("countModelsMissingUserVisibleDescriptions", () => {
  it("counts only models that fall back to synthetic descriptions", () => {
    const models: ActiveModelSummary[] = [
      {
        id: "model-a",
        slug: "openai-gpt-4-1",
        name: "GPT-4.1",
        provider: "OpenAI",
        category: "llm",
        description: null,
        short_description: null,
      },
      {
        id: "model-b",
        slug: "community-placeholder",
        name: "Placeholder",
        provider: "Community",
        category: "llm",
        description: null,
        short_description: null,
      },
    ];

    expect(countModelsMissingUserVisibleDescriptions(models)).toBe(1);
  });
});

describe("filterUserVisiblePricedModelIds", () => {
  it("counts provider-family and open-weight access paths as user-visible pricing coverage", () => {
    const activeModels: ActiveModelSummary[] = [
      {
        id: "model-a",
        slug: "minimax-m2-7",
        name: "MiniMax M2.7",
        provider: "MiniMax",
        category: "llm",
        is_open_weights: false,
      },
      {
        id: "model-b",
        slug: "gemma-3-27b",
        name: "Gemma 3 27B",
        provider: "Google",
        category: "llm",
        is_open_weights: true,
      },
      {
        id: "model-c",
        slug: "community-model",
        name: "Community Model",
        provider: "Community",
        category: "llm",
        is_open_weights: false,
      },
    ];

    const covered = filterUserVisiblePricedModelIds({
      activeModels,
      pricedModelIds: new Set<string>(),
      directDeploymentModelIds: new Set<string>(),
      availablePlatformSlugs: ["minimax-coding-plan", "ollama"],
    });

    expect(Array.from(covered).sort()).toEqual(["model-a", "model-b"]);
  });
});

describe("getDescriptionCoverageThreshold", () => {
  it("uses a floor for small catalogs and a ratio for larger ones", () => {
    expect(getDescriptionCoverageThreshold(50)).toBe(25);
    expect(getDescriptionCoverageThreshold(200)).toBe(40);
  });
});

describe("countStaleSellerListings", () => {
  it("ignores seeded inventory that does not belong to a seller account", () => {
    expect(
      countStaleSellerListings({
        listings: [
          { seller_id: "admin-seed" },
          { seller_id: "verified-seller" },
          { seller_id: null },
        ],
        sellerProfiles: [
          { id: "admin-seed", is_seller: false, seller_verified: false },
          { id: "verified-seller", is_seller: true, seller_verified: true },
        ],
      })
    ).toBe(1);
  });
});
