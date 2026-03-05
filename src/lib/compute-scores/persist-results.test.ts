/**
 * Integration tests for persistResults
 *
 * Tests the persist-results pipeline stage with mocked Supabase client.
 * Verifies model updates, snapshot creation, error counting, and PersistStats shape.
 */

import { describe, it, expect, vi } from "vitest";
import { persistResults } from "./persist-results";
import type { ScoringInputs, ScoringResults, PersistStats } from "./types";

// Mock logging
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

/** Build a fixture ScoringInputs with N models */
function buildFixtureInputs(modelIds: string[]): ScoringInputs {
  return {
    models: modelIds.map((id) => ({
      id,
      name: `Model ${id}`,
      slug: `model-${id}`,
      provider: "test-provider",
      category: "llm",
      quality_score: null,
      value_score: null,
      hf_downloads: 1000,
      hf_likes: 100,
      release_date: "2024-01-01",
      is_open_weights: false,
      hf_trending_score: null,
      parameter_count: null,
      github_stars: 500,
    })),
    benchmarkMap: new Map(modelIds.map((id) => [id, [80, 85]])),
    benchmarkDetailMap: new Map(
      modelIds.map((id) => [id, [{ slug: "mmlu", score: 80 }]])
    ),
    eloMap: new Map(modelIds.map((id) => [id, 1200])),
    newsMentionMap: new Map(modelIds.map((id) => [id, 5])),
    providerBenchmarkAvg: new Map([["test-provider", 82]]),
    staleCount: 0,
  };
}

/** Build a fixture ScoringResults for given model IDs */
function buildFixtureResults(modelIds: string[]): ScoringResults {
  return {
    scoredModels: modelIds.map((id) => ({
      id,
      category: "llm",
      qualityScore: 75,
    })),
    capabilityScoreMap: new Map(modelIds.map((id) => [id, 80])),
    capRankMap: new Map(modelIds.map((id, i) => [id, i + 1])),
    usageScoreMap: new Map(modelIds.map((id) => [id, 60])),
    usageRankMap: new Map(modelIds.map((id, i) => [id, i + 1])),
    expertScoreMap: new Map(modelIds.map((id) => [id, 70])),
    expertRankMap: new Map(modelIds.map((id, i) => [id, i + 1])),
    balancedRankings: modelIds.map((id, i) => ({
      id,
      balanced_rank: i + 1,
      category_balanced_rank: i + 1,
    })),
    balancedRankMap: new Map(
      modelIds.map((id, i) => [id, { overall: i + 1, category: i + 1 }])
    ),
    agentScoreMap: new Map(modelIds.map((id) => [id, 0])),
    agentRankMap: new Map(),
    popularityMap: new Map(modelIds.map((id) => [id, 55])),
    popRankMap: new Map(modelIds.map((id, i) => [id, i + 1])),
    marketCapMap: new Map(modelIds.map((id) => [id, 1000000])),
    cheapestPriceMap: new Map(modelIds.map((id) => [id, 5.0])),
    normalizedValueMap: new Map(modelIds.map((id) => [id, 65])),
    valueRankMap: new Map(modelIds.map((id, i) => [id, i + 1])),
    pricingSynced: 0,
    stats: {
      maxDownloads: 500000,
      maxLikes: 5000,
      maxNewsMentions: 50,
    } as ScoringResults["stats"],
  };
}

/**
 * Creates a mock Supabase client for persist operations.
 * Supports .from("models").update().eq().then() and .from("model_snapshots").upsert().then()
 */
function createPersistMockSupabase(options?: {
  failUpdateForId?: string;
  failSnapshot?: boolean;
}) {
  /** Wrap a value as a thenable (PromiseLike) so .then() chains work with await/Promise.all */
  function thenable<T>(value: T) {
    return {
      then: <R>(onFulfilled: (v: T) => R) =>
        Promise.resolve(onFulfilled(value)),
    };
  }

  return {
    from: (table: string) => {
      if (table === "models") {
        return {
          update: (_data: unknown) => ({
            eq: (_col: string, id: string) => {
              const error =
                options?.failUpdateForId === id
                  ? { message: "Update failed" }
                  : null;
              return thenable({ error });
            },
          }),
        };
      }
      if (table === "model_snapshots") {
        return {
          upsert: (_data: unknown, _opts?: unknown) => {
            const error = options?.failSnapshot
              ? { message: "Snapshot failed" }
              : null;
            return thenable({ error });
          },
        };
      }
      // Fallback
      return {
        select: () => thenable({ data: [], error: null }),
      };
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("persistResults", () => {
  it("updates all models and creates snapshots successfully", async () => {
    const modelIds = ["m1", "m2"];
    const inputs = buildFixtureInputs(modelIds);
    const results = buildFixtureResults(modelIds);
    const supabase = createPersistMockSupabase();

    const stats: PersistStats = await persistResults(
      supabase,
      inputs,
      results
    );

    expect(stats.updated).toBe(2);
    expect(stats.errors).toBe(0);
    expect(stats.snapshotsCreated).toBe(2);
  });

  it("counts errors from failed updates", async () => {
    const modelIds = ["m1", "m2"];
    const inputs = buildFixtureInputs(modelIds);
    const results = buildFixtureResults(modelIds);
    const supabase = createPersistMockSupabase({ failUpdateForId: "m2" });

    const stats = await persistResults(supabase, inputs, results);

    expect(stats.updated).toBe(1);
    expect(stats.errors).toBe(1);
    expect(stats.snapshotsCreated).toBe(2);
  });

  it("returns PersistStats shape with correct keys", async () => {
    const modelIds = ["m1"];
    const inputs = buildFixtureInputs(modelIds);
    const results = buildFixtureResults(modelIds);
    const supabase = createPersistMockSupabase();

    const stats = await persistResults(supabase, inputs, results);

    expect(stats).toHaveProperty("updated");
    expect(stats).toHaveProperty("errors");
    expect(stats).toHaveProperty("snapshotsCreated");
    expect(typeof stats.updated).toBe("number");
    expect(typeof stats.errors).toBe("number");
    expect(typeof stats.snapshotsCreated).toBe("number");
  });
});
