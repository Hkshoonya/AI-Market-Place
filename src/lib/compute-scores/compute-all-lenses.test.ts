/**
 * Integration tests for computeAllLenses
 *
 * Tests the compute-all-lenses pipeline stage with a 3-model fixture.
 * Verifies all score maps, rank maps, and result shape are populated correctly.
 */

import { describe, it, expect, vi } from "vitest";
import { computeAllLenses } from "./compute-all-lenses";
import type { ScoringInputs, ScoringResults } from "./types";

// Mock logging to prevent real Supabase calls
vi.mock("@/lib/logging", () => ({
  createTaggedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  systemLog: vi.fn(),
}));

// Mock pipeline-health
vi.mock("@/lib/pipeline-health", () => ({
  getStaleSourceCount: vi.fn().mockResolvedValue(0),
  buildSignalCoverage: vi.fn().mockReturnValue({}),
}));

// Mock provider-pricing to return null (no curated prices)
vi.mock("@/lib/data-sources/adapters/provider-pricing", () => ({
  lookupProviderPrice: vi.fn().mockReturnValue(null),
}));

/**
 * Build a realistic 3-model ScoringInputs fixture.
 */
function buildFixtureInputs(): ScoringInputs {
  const models: ScoringInputs["models"] = [
    {
      id: "gpt-4o",
      name: "GPT-4o",
      slug: "gpt-4o",
      provider: "openai",
      category: "llm",
      quality_score: null,
      value_score: null,
      hf_downloads: null,
      hf_likes: null,
      release_date: "2024-05-13",
      is_open_weights: false,
      is_api_available: true,
      hf_trending_score: null,
      parameter_count: null,
      github_stars: null,
    },
    {
      id: "llama-3-70b",
      name: "Llama 3 70B",
      slug: "llama-3-70b",
      provider: "meta",
      category: "llm",
      quality_score: null,
      value_score: null,
      hf_downloads: 500000,
      hf_likes: 2000,
      release_date: "2024-04-18",
      is_open_weights: true,
      is_api_available: true,
      hf_trending_score: null,
      parameter_count: null,
      github_stars: 5000,
    },
    {
      id: "stable-diffusion-xl",
      name: "Stable Diffusion XL",
      slug: "stable-diffusion-xl",
      provider: "stability ai",
      category: "image_generation",
      quality_score: null,
      value_score: null,
      hf_downloads: 1000000,
      hf_likes: 5000,
      release_date: "2024-01-01",
      is_open_weights: true,
      is_api_available: false,
      hf_trending_score: null,
      parameter_count: null,
      github_stars: null,
    },
  ];

  const benchmarkMap = new Map<string, number[]>([
    ["gpt-4o", [92, 88, 85]],
    ["llama-3-70b", [78, 72]],
  ]);

  const benchmarkDetailMap = new Map<
    string,
    Array<{ slug: string; score: number }>
  >([
    [
      "gpt-4o",
      [
        { slug: "mmlu", score: 92 },
        { slug: "gpqa", score: 88 },
        { slug: "math", score: 85 },
      ],
    ],
    [
      "llama-3-70b",
      [
        { slug: "mmlu", score: 78 },
        { slug: "gpqa", score: 72 },
      ],
    ],
  ]);

  const eloMap = new Map<string, number>([
    ["gpt-4o", 1287],
    ["llama-3-70b", 1150],
  ]);

  const newsMentionMap = new Map<string, number>([
    ["gpt-4o", 50],
    ["llama-3-70b", 20],
    ["stable-diffusion-xl", 10],
  ]);

  const providerBenchmarkAvg = new Map<string, number>([
    ["openai", 88],
    ["meta", 75],
    ["stability ai", 0],
  ]);

  return {
    models,
    benchmarkMap,
    benchmarkDetailMap,
    eloMap,
    newsMentionMap,
    providerBenchmarkAvg,
    staleCount: 0,
  };
}

/**
 * Create a mock Supabase client for computeAllLenses.
 * The function queries model_pricing for pricing sync.
 */
function createMockSupabase() {
  // REMOVED: function thenable<T>(value: T) {
  //   return {
  //     then: <R>(onFulfilled: (v: T) => R) =>
  //       Promise.resolve(onFulfilled(value)),
  //   };
  // }

  const makeChain = () => {
    const result = { data: [], error: null };
    const chain: Record<string, unknown> = {};
    const self = new Proxy(chain, {
      get(_target, prop) {
        if (prop === "then") {
          return <R>(onFulfilled: (v: typeof result) => R) =>
            Promise.resolve(onFulfilled(result));
        }
        return (..._args: unknown[]) => self;
      },
    });
    return self;
  };

  return {
    from: (_table: string) => makeChain(),
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("computeAllLenses", () => {
  it("produces ScoringResults with all expected maps populated for 3 models", async () => {
    const inputs = buildFixtureInputs();
    const supabase = createMockSupabase();

    const result: ScoringResults = await computeAllLenses(inputs, supabase);

    // scoredModels array
    expect(result.scoredModels).toHaveLength(3);

    // All score maps have entries for each model
    expect(result.capabilityScoreMap.has("gpt-4o")).toBe(true);
    expect(result.capabilityScoreMap.has("llama-3-70b")).toBe(true);
    expect(result.capabilityScoreMap.has("stable-diffusion-xl")).toBe(true);
    expect(result.capabilityScoreMap.size).toBe(3);

    expect(result.usageScoreMap.has("gpt-4o")).toBe(true);
    expect(result.usageScoreMap.has("llama-3-70b")).toBe(true);
    expect(result.usageScoreMap.has("stable-diffusion-xl")).toBe(true);

    expect(result.expertScoreMap.size).toBe(3);

    // Rank maps
    expect(result.capRankMap.size).toBeGreaterThan(0);
    expect(result.usageRankMap.size).toBeGreaterThan(0);
    expect(result.expertRankMap.size).toBeGreaterThan(0);

    // Balanced rankings
    expect(result.balancedRankings).toHaveLength(3);
    expect(result.balancedRankMap.size).toBe(3);

    // Market cap map
    expect(result.marketCapMap.size).toBeGreaterThanOrEqual(0); // May be 0 with no pricing

    // Popularity map
    expect(result.popularityMap.size).toBe(3);

    // pricingSynced is a number (0 when pricing mock returns no data)
    expect(typeof result.pricingSynced).toBe("number");
    expect(result.pricingSynced).toBe(0);

    // stats (NormalizationStats) is defined
    expect(result.stats).toBeDefined();
    expect(typeof result.stats).toBe("object");
  });

  it("GPT-4o has higher capability score than Llama 3 (better benchmarks + ELO)", async () => {
    const inputs = buildFixtureInputs();
    const supabase = createMockSupabase();

    const result = await computeAllLenses(inputs, supabase);

    const gpt4oCapScore = result.capabilityScoreMap.get("gpt-4o");
    const llamaCapScore = result.capabilityScoreMap.get("llama-3-70b");

    // Both should have capability scores (they have benchmarks)
    expect(gpt4oCapScore).not.toBeNull();
    expect(llamaCapScore).not.toBeNull();

    // GPT-4o should rank higher (lower rank number = better)
    const gpt4oRank = result.capRankMap.get("gpt-4o");
    const llamaRank = result.capRankMap.get("llama-3-70b");
    expect(gpt4oRank).toBeDefined();
    expect(llamaRank).toBeDefined();
    expect(gpt4oRank!).toBeLessThan(llamaRank!);
  });

  it("SD-XL capability score is null (no benchmarks for image_generation)", async () => {
    const inputs = buildFixtureInputs();
    const supabase = createMockSupabase();

    const result = await computeAllLenses(inputs, supabase);

    const sdxlCapScore = result.capabilityScoreMap.get("stable-diffusion-xl");
    // SD-XL has no benchmarks and no ELO, so capability should be null
    expect(sdxlCapScore).toBeNull();
  });

  it("agent scores are 0 for models without agent benchmarks", async () => {
    const inputs = buildFixtureInputs();
    const supabase = createMockSupabase();

    const result = await computeAllLenses(inputs, supabase);

    // SD-XL has no benchmark data at all, so no agent score entry
    expect(result.agentScoreMap.has("stable-diffusion-xl")).toBe(false);

    // Models with benchmarks but no agent-specific ones also won't have entries
    // (mmlu, gpqa, math are not agent benchmarks by default)
    // Verify the map is well-formed
    for (const [, score] of result.agentScoreMap) {
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThanOrEqual(0);
    }
  });

  it("all rank maps have consistent sizes", async () => {
    const inputs = buildFixtureInputs();
    const supabase = createMockSupabase();

    const result = await computeAllLenses(inputs, supabase);

    // capRankMap only includes models with non-null capability scores
    const nonNullCapModels = Array.from(
      result.capabilityScoreMap.entries()
    ).filter(([, s]) => s != null);
    expect(result.capRankMap.size).toBe(nonNullCapModels.length);

    // Usage rank includes models with score > 0
    const nonZeroUsage = Array.from(result.usageScoreMap.entries()).filter(
      ([, s]) => s > 0
    );
    expect(result.usageRankMap.size).toBe(nonZeroUsage.length);

    // Expert rank includes models with score > 0
    const nonZeroExpert = Array.from(result.expertScoreMap.entries()).filter(
      ([, s]) => s > 0
    );
    expect(result.expertRankMap.size).toBe(nonZeroExpert.length);
  });

  it("computes adoption and economic-footprint maps for all active models", async () => {
    const inputs = buildFixtureInputs();
    const supabase = createMockSupabase();

    const result = await computeAllLenses(inputs, supabase);

    expect(result.adoptionScoreMap.size).toBe(3);
    expect(result.economicFootprintMap.size).toBe(3);
    expect(result.adoptionRankMap.size).toBe(3);
    expect(result.economicFootprintRankMap.size).toBe(3);
    expect(result.adoptionScoreMap.get("gpt-4o")).toBeGreaterThan(0);
    expect(result.economicFootprintMap.get("gpt-4o")).toBeGreaterThan(0);
  });
});
