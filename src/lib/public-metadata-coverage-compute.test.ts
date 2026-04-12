import { describe, expect, it } from "vitest";
import { computePublicMetadataCoverage } from "./public-metadata-coverage-compute";

function createMockSupabase(rows: unknown[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          range: () => Promise.resolve({ data: rows, error: null }),
        }),
      }),
    }),
  };
}

describe("computePublicMetadataCoverage", () => {
  it("reports discovery and metadata gaps for active models", async () => {
    const supabase = createMockSupabase([
      {
        slug: "google-gemma-4-31b-it",
        provider: "Google",
        website_url: "https://ai.google.dev/gemma",
        name: "Gemma 4 31B IT",
        category: "multimodal",
        release_date: "2026-04-02",
        is_open_weights: true,
        license: "open_source",
        license_name: "Apache 2.0",
        context_window: 128000,
      },
      {
        slug: "x-ai-grok-4-20",
        provider: "xAI",
        website_url: "https://x.ai/grok",
        name: "Grok 4.20",
        category: "llm",
        release_date: "2026-04-01",
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: null,
      },
      {
        slug: "zai-org-glm-5-1",
        provider: "Z.ai",
        website_url: "https://z.ai/glm-5-1",
        name: "GLM-5.1",
        category: "llm",
        release_date: "2026-04-03",
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: null,
      },
      {
        slug: "z-ai-glm-5-1",
        provider: "Z.ai",
        website_url: "https://z.ai/glm-5-1",
        name: "GLM-5.1",
        category: "llm",
        release_date: "2026-04-03",
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: 202752,
      },
      {
        slug: "google-gemini-flash-latest",
        provider: "Google",
        name: "Gemini Flash Latest",
        category: "multimodal",
        release_date: null,
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: 1048576,
      },
      {
        slug: "mystery-model",
        provider: "Unknown",
        name: "Mystery Model",
        category: null,
        release_date: null,
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: null,
      },
    ]);

    const coverage = await computePublicMetadataCoverage(supabase as never);

    expect(coverage.activeModels).toBe(6);
    expect(coverage.completeDiscoveryMetadataCount).toBe(5);
    expect(coverage.completeDiscoveryMetadataPct).toBeCloseTo(83.3);
    expect(coverage.defaultPublicSurfaceReadyCount).toBe(3);
    expect(coverage.defaultPublicSurfaceReadyPct).toBe(50);
    expect(coverage.topReadinessBlockers).toEqual(
      expect.arrayContaining([
        { reason: "missing_category", count: 1 },
        { reason: "missing_context_window", count: 1 },
      ])
    );
    expect(coverage.missingCategoryCount).toBe(1);
    expect(coverage.missingReleaseDateCount).toBe(1);
    expect(coverage.releaseDateExemptAliasCount).toBe(1);
    expect(coverage.openWeightsMissingLicenseCount).toBe(0);
    expect(coverage.llmMissingContextWindowCount).toBe(1);
    expect(coverage.signalContaminationCount).toBe(0);
    expect(coverage.trustTierCounts).toEqual({
      official: 4,
      trusted_catalog: 0,
      community: 1,
      wrapper: 1,
    });
    expect(coverage.lowTrustActiveCount).toBe(2);
    expect(coverage.lowTrustReadyCount).toBe(0);
    expect(coverage.official.activeModels).toBe(4);
    expect(coverage.official.completeDiscoveryMetadataCount).toBe(4);
    expect(coverage.official.completeDiscoveryMetadataPct).toBe(100);
    expect(coverage.official.defaultPublicSurfaceReadyCount).toBe(3);
    expect(coverage.official.defaultPublicSurfaceReadyPct).toBe(75);
    expect(coverage.official.topReadinessBlockers).toEqual(
      expect.arrayContaining([{ reason: "missing_context_window", count: 1 }])
    );
    expect(coverage.providers[0]?.complete_pct).toBe(0);
    expect(coverage.providers[0]?.ready_pct).toBe(0);
    expect(coverage.providers.map((provider) => provider.provider)).toEqual(
      expect.arrayContaining(["Unknown", "xAI"])
    );
    expect(coverage.official.providers.map((provider) => provider.provider)).toEqual(
      expect.arrayContaining(["Google", "xAI"])
    );
    expect(coverage.official.releaseDateExemptAliasCount).toBe(0);
    expect(coverage.recentIncompleteModels[0]?.slug).toBe("x-ai-grok-4-20");
    expect(coverage.recentNotReadyModels[0]?.slug).toBe("x-ai-grok-4-20");
    expect(coverage.recentNotReadyModels[0]?.reasons).toEqual([
      "missing_context_window",
    ]);
    expect(coverage.recentLowTrustModels[0]?.slug).toBe("google-gemini-flash-latest");
    expect(coverage.recentLowTrustModels[0]?.trust_tier).toBe("wrapper");
    expect(coverage.recentLowTrustModels[1]?.slug).toBe("mystery-model");
    expect(coverage.recentLowTrustModels[1]?.trust_tier).toBe("community");
    expect(coverage.recentSignalContaminationModels).toEqual([]);
  });

  it("normalizes missing providers to Unknown so downstream health routes do not throw", async () => {
    const supabase = createMockSupabase([
      {
        slug: "providerless-model",
        provider: null,
        name: "Providerless Model",
        category: null,
        release_date: null,
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: null,
      },
    ]);

    const coverage = await computePublicMetadataCoverage(supabase as never);

    expect(coverage.providers[0]?.provider).toBe("Unknown");
    expect(coverage.recentIncompleteModels[0]?.provider).toBe("Unknown");
    expect(coverage.recentLowTrustModels[0]?.provider).toBe("Unknown");
  });
});
