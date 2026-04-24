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
    expect(coverage.defaultPublicSurfaceReadyPct).toBe(60);
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
      official: 5,
      trusted_catalog: 0,
      community: 1,
      wrapper: 0,
    });
    expect(coverage.lowTrustActiveCount).toBe(1);
    expect(coverage.lowTrustReadyCount).toBe(0);
    expect(coverage.official.activeModels).toBe(5);
    expect(coverage.official.completeDiscoveryMetadataCount).toBe(5);
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
    expect(coverage.official.releaseDateExemptAliasCount).toBe(1);
    expect(coverage.recentIncompleteModels[0]?.slug).toBe("x-ai-grok-4-20");
    expect(coverage.recentNotReadyModels[0]?.slug).toBe("x-ai-grok-4-20");
    expect(coverage.recentNotReadyModels[0]?.reasons).toEqual([
      "missing_context_window",
    ]);
    expect(coverage.recentLowTrustModels).toHaveLength(1);
    expect(coverage.recentLowTrustModels[0]?.slug).toBe("mystery-model");
    expect(coverage.recentLowTrustModels[0]?.trust_tier).toBe("community");
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

  it("shares family coverage across canonical provider aliases", async () => {
    const supabase = createMockSupabase([
      {
        slug: "meta-llama-meta-llama-3-8b-instruct",
        provider: "meta-llama",
        hf_model_id: "meta-llama/Meta-Llama-3-8B-Instruct",
        name: "Meta-Llama-3-8B-Instruct",
        category: "llm",
        release_date: "2024-04-17",
        is_open_weights: false,
        license: "commercial",
        license_name: "proprietary",
        context_window: null,
        overall_rank: 100,
        quality_score: 60,
      },
      {
        slug: "meta-llama-llama-3-8b-instruct",
        provider: "Meta",
        website_url: "https://www.llama.com/",
        name: "Llama 3 8B Instruct",
        category: "llm",
        release_date: "2024-04-18",
        is_open_weights: false,
        license: "commercial",
        license_name: "proprietary",
        context_window: 8192,
      },
    ]);

    const coverage = await computePublicMetadataCoverage(supabase as never);

    expect(coverage.official.rankingContaminationCount).toBe(0);
    expect(coverage.official.defaultPublicSurfaceReadyCount).toBe(2);
    expect(coverage.official.topReadinessBlockers).toEqual([]);
  });

  it("excludes official wrapper and packaging variants from the official readiness denominator", async () => {
    const supabase = createMockSupabase([
      {
        slug: "google-gemini-3-1-pro",
        provider: "Google",
        name: "Gemini 3.1 Pro",
        category: "multimodal",
        release_date: "2026-04-01",
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: 1048576,
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
        slug: "openai-gpt-5-chat-latest",
        provider: "OpenAI",
        name: "GPT-5 Chat Latest",
        category: "llm",
        release_date: null,
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: 400000,
      },
      {
        slug: "unsloth-gemma-4-31b-it-gguf",
        provider: "Google",
        name: "Gemma 4 31B IT GGUF",
        category: "llm",
        release_date: "2026-04-02",
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: 131072,
      },
    ]);

    const coverage = await computePublicMetadataCoverage(supabase as never);

    expect(coverage.official.activeModels).toBe(4);
    expect(coverage.official.defaultPublicSurfaceReadyCount).toBe(1);
    expect(coverage.official.defaultPublicSurfaceReadyPct).toBe(100);
    expect(coverage.official.releaseDateExemptAliasCount).toBe(2);
    expect(coverage.official.topReadinessBlockers).toEqual([]);
    expect(coverage.official.recentNotReadyModels).toEqual([]);
  });

  it("excludes low-trust wrapper and packaging variants from the overall readiness denominator", async () => {
    const supabase = createMockSupabase([
      {
        slug: "google-gemini-3-1-pro",
        provider: "Google",
        website_url: "https://ai.google.dev/gemini-api/docs/models",
        name: "Gemini 3.1 Pro",
        category: "multimodal",
        release_date: "2026-04-01",
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: 1048576,
      },
      {
        slug: "unsloth-gemma-4-31b-it-gguf",
        provider: "Community",
        name: "Gemma 4 31B IT GGUF",
        category: "llm",
        release_date: "2026-04-02",
        is_open_weights: true,
        license: null,
        license_name: null,
        context_window: 131072,
      },
      {
        slug: "arcee-ai-trinity-large-preview",
        provider: "Community",
        name: "Trinity Large Preview",
        category: "llm",
        release_date: null,
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: 32768,
      },
    ]);

    const coverage = await computePublicMetadataCoverage(supabase as never);

    expect(coverage.activeModels).toBe(3);
    expect(coverage.defaultPublicSurfaceReadyCount).toBe(1);
    expect(coverage.defaultPublicSurfaceReadyPct).toBe(100);
    expect(coverage.lowTrustActiveCount).toBe(0);
    expect(coverage.lowTrustReadyCount).toBe(0);
    expect(coverage.releaseDateExemptAliasCount).toBe(1);
    expect(coverage.topReadinessBlockers).toEqual([]);
    expect(coverage.recentLowTrustModels).toEqual([]);
    expect(coverage.recentNotReadyModels).toEqual([]);
  });

  it("excludes GGUF packaging rows inferred from architecture from the readiness denominator", async () => {
    const supabase = createMockSupabase([
      {
        slug: "google-gemini-3-1-pro",
        provider: "Google",
        name: "Gemini 3.1 Pro",
        category: "multimodal",
        release_date: "2026-04-01",
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: 1048576,
      },
      {
        slug: "ruv-ruvltra-claude-code",
        provider: "ruv",
        architecture: "gguf",
        hf_model_id: "ruv/ruvltra-claude-code",
        name: "RuvLtra Claude Code",
        category: "llm",
        release_date: "2026-01-16",
        is_open_weights: true,
        license: "open_source",
        license_name: "Apache 2.0",
        context_window: null,
      },
    ]);

    const coverage = await computePublicMetadataCoverage(supabase as never);

    expect(coverage.defaultPublicSurfaceReadyCount).toBe(1);
    expect(coverage.defaultPublicSurfaceReadyPct).toBe(100);
    expect(coverage.llmMissingContextWindowCount).toBe(0);
    expect(coverage.trustTierCounts).toEqual({
      official: 1,
      trusted_catalog: 0,
      community: 0,
      wrapper: 1,
    });
    expect(coverage.lowTrustActiveCount).toBe(0);
    expect(coverage.topReadinessBlockers).toEqual([]);
    expect(coverage.recentNotReadyModels).toEqual([]);
  });
});
