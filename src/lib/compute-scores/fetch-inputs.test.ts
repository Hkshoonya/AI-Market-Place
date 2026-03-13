/**
 * Integration tests for fetchInputs
 *
 * Tests the fetch-inputs pipeline stage with mocked Supabase client.
 * Verifies ScoringInputs shape, error handling, and empty-data edge case.
 */

import { describe, it, expect, vi } from "vitest";
import { fetchInputs } from "./fetch-inputs";

// Mock logging to prevent real Supabase calls from systemLog
vi.mock("@/lib/logging", () => ({
  createTaggedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  systemLog: vi.fn(),
}));

// Mock pipeline-health to avoid real DB calls
vi.mock("@/lib/pipeline-health", () => ({
  getStaleSourceCount: vi.fn().mockResolvedValue(0),
  buildSignalCoverage: vi.fn().mockReturnValue({}),
}));

/**
 * Creates a mock Supabase client where .from(table).select().eq()/.gte()/.not() chains
 * resolve to the data/error specified in `overrides[table]`.
 */
function createMockSupabase(
  overrides: Record<string, { data: unknown; error: unknown }>
) {
  const makeChain = (table: string) => {
    const result = overrides[table] ?? { data: [], error: null };
    const chain: Record<string, unknown> = {};
    const self = new Proxy(chain, {
      get(_target, prop) {
        if (prop === "then") {
          // Make it thenable so `await` resolves to `result`
          return (resolve: (v: unknown) => void) => resolve(result);
        }
        // Any chained method (.select, .eq, .gte, .not, .is) returns self
        return (..._args: unknown[]) => self;
      },
    });
    return self;
  };

  return {
    from: (table: string) => makeChain(table),
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

function createPagedMockSupabase(
  overrides: Record<string, Array<{ data: unknown; error: unknown }>>
) {
  const pageIndexByTable = new Map<string, number>();
  return {
    from: (table: string) => {
      const resolvePage = () => {
        const pageIndex = pageIndexByTable.get(table) ?? 0;
        const result = overrides[table]?.[pageIndex] ?? {
          data: [],
          error: null,
        };
        pageIndexByTable.set(table, pageIndex + 1);
        return Promise.resolve(result);
      };

      const chain = {
        select: () => chain,
        eq: () => chain,
        gte: () => chain,
        not: () => chain,
        range: () => resolvePage(),
      };

      return chain;
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("fetchInputs", () => {
  it("returns ScoringInputs with populated models, benchmark, elo, and news maps", async () => {
    const mockModels = [
      {
        id: "m1",
        name: "GPT-4o",
        slug: "gpt-4o",
        provider: "openai",
        category: "llm",
        quality_score: null,
        value_score: null,
        hf_downloads: 100000,
        hf_likes: 500,
        release_date: "2024-05-13",
        is_open_weights: false,
        hf_trending_score: null,
        parameter_count: null,
        github_stars: null,
      },
      {
        id: "m2",
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
        hf_trending_score: null,
        parameter_count: null,
        github_stars: 5000,
      },
    ];

    const mockBenchmarks = [
      { model_id: "m1", score_normalized: 92, benchmarks: { slug: "mmlu" } },
      { model_id: "m1", score_normalized: 88, benchmarks: { slug: "gpqa" } },
      { model_id: "m2", score_normalized: 78, benchmarks: { slug: "mmlu" } },
    ];

    const mockElo = [
      { model_id: "m1", elo_score: 1287, arena_name: "gpt-4o" },
    ];

    const mockNews = [
      { related_model_ids: ["m1", "m2"] },
      { related_model_ids: ["m1"] },
    ];

    const supabase = createMockSupabase({
      models: { data: mockModels, error: null },
      benchmark_scores: { data: mockBenchmarks, error: null },
      elo_ratings: { data: mockElo, error: null },
      model_news: { data: mockNews, error: null },
    });

    const result = await fetchInputs(supabase);

    // Models
    expect(result.models).toHaveLength(2);
    expect(result.models[0].id).toBe("m1");

    // Benchmark maps
    expect(result.benchmarkMap.has("m1")).toBe(true);
    expect(result.benchmarkMap.get("m1")).toEqual([92, 88]);
    expect(result.benchmarkMap.get("m2")).toEqual([78]);

    // Benchmark detail map
    expect(result.benchmarkDetailMap.get("m1")).toEqual([
      { slug: "mmlu", score: 92 },
      { slug: "gpqa", score: 88 },
    ]);

    // ELO map
    expect(result.eloMap.has("m1")).toBe(true);
    expect(result.eloMap.get("m1")).toBe(1287);

    // News mention map
    expect(result.newsMentionMap.get("m1")).toBe(2);
    expect(result.newsMentionMap.get("m2")).toBe(1);

    // Provider benchmark avg
    expect(result.providerBenchmarkAvg.has("openai")).toBe(true);

    // Stale count
    expect(typeof result.staleCount).toBe("number");
  });

  it("throws Error when models query fails", async () => {
    const supabase = createMockSupabase({
      models: { data: null, error: { message: "Connection refused" } },
      benchmark_scores: { data: [], error: null },
      elo_ratings: { data: [], error: null },
      model_news: { data: [], error: null },
    });

    await expect(fetchInputs(supabase)).rejects.toThrow(
      "Failed to fetch models"
    );
  });

  it("returns empty maps when no benchmark/elo/news data exists", async () => {
    const mockModels = [
      {
        id: "m1",
        name: "Test Model",
        slug: "test-model",
        provider: "test",
        category: "llm",
        quality_score: null,
        value_score: null,
        hf_downloads: null,
        hf_likes: null,
        release_date: null,
        is_open_weights: false,
        hf_trending_score: null,
        parameter_count: null,
        github_stars: null,
      },
    ];

    const supabase = createMockSupabase({
      models: { data: mockModels, error: null },
      benchmark_scores: { data: [], error: null },
      elo_ratings: { data: [], error: null },
      model_news: { data: [], error: null },
    });

    const result = await fetchInputs(supabase);

    expect(result.models).toHaveLength(1);
    expect(result.benchmarkMap.size).toBe(0);
    expect(result.benchmarkDetailMap.size).toBe(0);
    expect(result.eloMap.size).toBe(0);
    expect(result.newsMentionMap.size).toBe(0);
    expect(typeof result.staleCount).toBe("number");
  });

  it("paginates model input queries beyond the 1000-row default", async () => {
    const pageOne = Array.from({ length: 1000 }, (_, i) => ({
      id: `m${i + 1}`,
      name: `Model ${i + 1}`,
      slug: `model-${i + 1}`,
      provider: "test",
      category: "llm",
      quality_score: null,
      value_score: null,
      hf_downloads: null,
      hf_likes: null,
      release_date: null,
      is_open_weights: false,
      hf_trending_score: null,
      parameter_count: null,
      github_stars: null,
    }));
    const pageTwo = [
      {
        id: "m1001",
        name: "Model 1001",
        slug: "model-1001",
        provider: "test",
        category: "llm",
        quality_score: null,
        value_score: null,
        hf_downloads: null,
        hf_likes: null,
        release_date: null,
        is_open_weights: false,
        hf_trending_score: null,
        parameter_count: null,
        github_stars: null,
      },
    ];

    const supabase = createPagedMockSupabase({
      models: [
        { data: pageOne, error: null },
        { data: pageTwo, error: null },
        { data: [], error: null },
      ],
      benchmark_scores: [
        { data: [], error: null },
      ],
      elo_ratings: [
        { data: [], error: null },
      ],
      model_news: [
        { data: [], error: null },
      ],
    });

    const result = await fetchInputs(supabase);

    expect(result.models).toHaveLength(1001);
    expect(result.models.at(-1)?.id).toBe("m1001");
  });
});
