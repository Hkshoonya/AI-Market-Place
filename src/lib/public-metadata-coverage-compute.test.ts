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
    expect(coverage.missingCategoryCount).toBe(1);
    expect(coverage.missingReleaseDateCount).toBe(1);
    expect(coverage.releaseDateExemptAliasCount).toBe(1);
    expect(coverage.openWeightsMissingLicenseCount).toBe(0);
    expect(coverage.llmMissingContextWindowCount).toBe(1);
    expect(coverage.official.activeModels).toBe(5);
    expect(coverage.official.completeDiscoveryMetadataCount).toBe(5);
    expect(coverage.official.completeDiscoveryMetadataPct).toBe(100);
    expect(coverage.providers[0]?.provider).toBe("Unknown");
    expect(coverage.providers[0]?.complete_pct).toBe(0);
    expect(coverage.official.providers.map((provider) => provider.provider)).toEqual(
      expect.arrayContaining(["Google", "xAI"])
    );
    expect(coverage.official.releaseDateExemptAliasCount).toBe(1);
    expect(coverage.recentIncompleteModels[0]?.slug).toBe("x-ai-grok-4-20");
  });
});
