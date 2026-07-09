/**
 * Integration tests for persistResults
 *
 * Tests the persist-results pipeline stage with mocked Supabase client.
 * Verifies model updates, snapshot creation, error counting, and PersistStats shape.
 */

import { describe, it, expect, vi } from "vitest";
import { persistResults } from "./persist-results";
import type { ScoringInputs, ScoringResults, PersistStats } from "./types";
import type { SourceCoverage } from "@/lib/source-coverage";

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

const SOURCE_COVERAGE_FIXTURE: SourceCoverage = {
  totalDistinctSources: 4,
  independentQualitySourceCount: 2,
  sourceFamilyCount: 4,
  benchmarkSourceCount: 1,
  benchmarkCategoryCount: 1,
  eloSourceCount: 1,
  newsSourceCount: 1,
  pricingSourceCount: 1,
  corroborationLevel: "multi_source",
  biasRisk: "medium",
  sourceFamilies: ["benchmarks", "elo", "news", "pricing"],
  benchmarkSources: ["livebench"],
  benchmarkCategories: ["general"],
  eloSources: ["chatbot_arena"],
  newsSources: ["provider-news"],
  pricingSources: ["openrouter"],
  hasCommunitySignals: true,
};

/** Build a fixture ScoringInputs with N models */
function buildFixtureInputs(modelIds: string[]): ScoringInputs {
  return {
    models: modelIds.map((id) => ({
      id,
      name: `Model ${id}`,
      slug: `model-${id}`,
      provider: "openai",
      category: "llm",
      status: "active",
      description: null,
      short_description: null,
      quality_score: null,
      value_score: null,
      hf_downloads: 1000,
      hf_likes: 100,
      release_date: "2024-01-01",
      is_open_weights: false,
      license: null,
      license_name: null,
      context_window: 128000,
      is_api_available: true,
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
    sourceCoverageMap: new Map(modelIds.map((id) => [id, SOURCE_COVERAGE_FIXTURE])),
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
    adoptionScoreMap: new Map(modelIds.map((id) => [id, 62])),
    adoptionRankMap: new Map(modelIds.map((id, i) => [id, i + 1])),
    economicFootprintMap: new Map(modelIds.map((id) => [id, 71])),
    economicFootprintRankMap: new Map(modelIds.map((id, i) => [id, i + 1])),
    marketCapMap: new Map(modelIds.map((id) => [id, 1000000])),
    cheapestPriceMap: new Map(modelIds.map((id) => [id, 5.0])),
    normalizedValueMap: new Map(modelIds.map((id) => [id, 65])),
    valueRankMap: new Map(modelIds.map((id, i) => [id, i + 1])),
    pricingSynced: 0,
    pricingSourceMap: new Map(modelIds.map((id) => [id, new Set(["openrouter"])])),
    stats: {
      maxDownloads: 500000,
      maxLikes: 5000,
      maxNewsMentions: 50,
    } as ScoringResults["stats"],
  };
}

/**
 * Creates a mock Supabase client for persist operations.
 * Supports bulk score RPC calls and daily model snapshot lookup/upserts.
 */
function createPersistMockSupabase(options?: {
  failModelUpdates?: boolean;
  changedUpdateCount?: number;
  failSnapshot?: boolean;
  failSnapshotTimesById?: Record<string, number>;
  existingSnapshotModelIds?: string[];
  snapshotCollector?: Array<Record<string, unknown>>;
  modelUpdateCollector?: Array<Record<string, unknown>>;
  updateBatchCollector?: Array<Array<Record<string, unknown>>>;
  snapshotBatchCollector?: Array<Array<Record<string, unknown>>>;
}) {
  return {
    rpc: async (functionName: string, args: { p_updates?: Array<Record<string, unknown>> }) => {
      if (functionName !== "bulk_update_model_scores") {
        throw new Error(`Unexpected RPC ${functionName}`);
      }

      const updates = args.p_updates ?? [];
      options?.updateBatchCollector?.push(updates);
      options?.modelUpdateCollector?.push(...updates);
      if (options?.failModelUpdates) {
        return { data: null, error: { message: "Update failed" } };
      }

      return {
        data: options?.changedUpdateCount ?? updates.length,
        error: null,
      };
    },
    from: (table: string) => {
      if (table === "model_snapshots") {
        return {
          select: () => {
            const query = {
              eq: () => query,
              in: async (_column: string, ids: string[]) => ({
                data: (options?.existingSnapshotModelIds ?? [])
                  .filter((id) => ids.includes(id))
                  .map((model_id) => ({ model_id })),
                error: null,
              }),
            };
            return query;
          },
          upsert: (data: unknown, _opts?: unknown) => {
            const snapshots = Array.isArray(data)
              ? (data as Array<Record<string, unknown>>)
              : [data as Record<string, unknown>];
            options?.snapshotBatchCollector?.push(snapshots);
            options?.snapshotCollector?.push(...snapshots);
            let error = options?.failSnapshot ? { message: "Snapshot failed" } : null;
            if (!error && options?.failSnapshotTimesById) {
              const transientId = snapshots
                .map((snapshot) => String(snapshot.model_id))
                .find((id) => (options.failSnapshotTimesById?.[id] ?? 0) > 0);
              if (transientId) {
                options.failSnapshotTimesById[transientId] -= 1;
                error = { message: "Transient snapshot failure" };
              }
            }
            return Promise.resolve({ error });
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
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
    expect(stats.unchanged).toBe(0);
    expect(stats.errors).toBe(0);
    expect(stats.snapshotsCreated).toBe(2);
    expect(stats.snapshotsSkipped).toBe(0);
    expect(stats.snapshotErrors).toBe(0);
  });

  it("counts errors from failed updates", async () => {
    const modelIds = ["m1", "m2"];
    const inputs = buildFixtureInputs(modelIds);
    const results = buildFixtureResults(modelIds);
    const supabase = createPersistMockSupabase({ failModelUpdates: true });

    const stats = await persistResults(supabase, inputs, results);

    expect(stats.updated).toBe(0);
    expect(stats.errors).toBe(2);
    expect(stats.snapshotsCreated).toBe(2);
    expect(stats.snapshotErrors).toBe(0);
  });

  it("counts snapshot persistence failures separately", async () => {
    const modelIds = ["m1", "m2"];
    const inputs = buildFixtureInputs(modelIds);
    const results = buildFixtureResults(modelIds);
    const supabase = createPersistMockSupabase({ failSnapshot: true });

    const stats = await persistResults(supabase, inputs, results);

    expect(stats.updated).toBe(2);
    expect(stats.errors).toBe(0);
    expect(stats.snapshotsCreated).toBe(0);
    expect(stats.snapshotErrors).toBe(2);
  });

  it("retries transient snapshot upsert failures before counting an error", async () => {
    const modelIds = ["m1", "m2"];
    const inputs = buildFixtureInputs(modelIds);
    const results = buildFixtureResults(modelIds);
    const supabase = createPersistMockSupabase({
      failSnapshotTimesById: { m2: 2 },
    });

    const stats = await persistResults(supabase, inputs, results);

    expect(stats.updated).toBe(2);
    expect(stats.errors).toBe(0);
    expect(stats.snapshotsCreated).toBe(2);
    expect(stats.snapshotErrors).toBe(0);
  });

  it("returns PersistStats shape with correct keys", async () => {
    const modelIds = ["m1"];
    const inputs = buildFixtureInputs(modelIds);
    const results = buildFixtureResults(modelIds);
    const supabase = createPersistMockSupabase();

    const stats = await persistResults(supabase, inputs, results);

    expect(stats).toHaveProperty("updated");
    expect(stats).toHaveProperty("unchanged");
    expect(stats).toHaveProperty("errors");
    expect(stats).toHaveProperty("snapshotsCreated");
    expect(stats).toHaveProperty("snapshotsSkipped");
    expect(stats).toHaveProperty("snapshotErrors");
    expect(typeof stats.updated).toBe("number");
    expect(typeof stats.unchanged).toBe("number");
    expect(typeof stats.errors).toBe("number");
    expect(typeof stats.snapshotsCreated).toBe("number");
    expect(typeof stats.snapshotsSkipped).toBe("number");
    expect(typeof stats.snapshotErrors).toBe("number");
  });

  it("reports unchanged models without rewriting them", async () => {
    const modelIds = ["m1", "m2"];
    const supabase = createPersistMockSupabase({ changedUpdateCount: 0 });

    const stats = await persistResults(
      supabase,
      buildFixtureInputs(modelIds),
      buildFixtureResults(modelIds)
    );

    expect(stats.updated).toBe(0);
    expect(stats.unchanged).toBe(2);
    expect(stats.errors).toBe(0);
  });

  it("skips snapshots that already exist for the current UTC day", async () => {
    const modelIds = ["m1", "m2"];
    const snapshots: Array<Record<string, unknown>> = [];
    const supabase = createPersistMockSupabase({
      existingSnapshotModelIds: ["m1", "m2"],
      snapshotCollector: snapshots,
    });

    const stats = await persistResults(
      supabase,
      buildFixtureInputs(modelIds),
      buildFixtureResults(modelIds)
    );

    expect(stats.snapshotsCreated).toBe(0);
    expect(stats.snapshotsSkipped).toBe(2);
    expect(snapshots).toHaveLength(0);
  });

  it("bounds database calls by batching model updates and snapshots", async () => {
    const modelIds = Array.from({ length: 501 }, (_, index) => `m${index}`);
    const updateBatches: Array<Array<Record<string, unknown>>> = [];
    const snapshotBatches: Array<Array<Record<string, unknown>>> = [];
    const supabase = createPersistMockSupabase({
      updateBatchCollector: updateBatches,
      snapshotBatchCollector: snapshotBatches,
    });

    const stats = await persistResults(
      supabase,
      buildFixtureInputs(modelIds),
      buildFixtureResults(modelIds)
    );

    expect(updateBatches.map((batch) => batch.length)).toEqual([250, 250, 1]);
    expect(snapshotBatches.map((batch) => batch.length)).toEqual([250, 250, 1]);
    expect(stats.updated).toBe(501);
    expect(stats.snapshotsCreated).toBe(501);
  });

  it("persists source_coverage into model snapshots", async () => {
    const modelIds = ["m1"];
    const inputs = buildFixtureInputs(modelIds);
    const results = buildFixtureResults(modelIds);
    const snapshots: Array<Record<string, unknown>> = [];
    const supabase = createPersistMockSupabase({ snapshotCollector: snapshots });

    await persistResults(supabase, inputs, results);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toHaveProperty("source_coverage");
    expect(snapshots[0].source_coverage).toEqual(SOURCE_COVERAGE_FIXTURE);
  });

  it("persists adoption and economic-footprint fields to models and snapshots", async () => {
    const modelIds = ["m1"];
    const inputs = buildFixtureInputs(modelIds);
    const results = buildFixtureResults(modelIds);
    const snapshots: Array<Record<string, unknown>> = [];
    const modelUpdates: Array<Record<string, unknown>> = [];
    const supabase = createPersistMockSupabase({
      snapshotCollector: snapshots,
      modelUpdateCollector: modelUpdates,
    });

    await persistResults(supabase, inputs, results);

    expect(modelUpdates[0]).toMatchObject({
      id: "m1",
      adoption_score: 62,
      adoption_rank: 1,
      economic_footprint_score: 71,
      economic_footprint_rank: 1,
    });

    expect(snapshots[0]).toMatchObject({
      adoption_score: 62,
      economic_footprint_score: 71,
    });
  });

  it("clears stale capability and market-cap fields when new results omit them", async () => {
    const modelIds = ["m1"];
    const inputs = buildFixtureInputs(modelIds);
    const results = buildFixtureResults(modelIds);
    results.capabilityScoreMap = new Map();
    results.capRankMap = new Map();
    results.marketCapMap = new Map();
    results.agentScoreMap = new Map();
    results.agentRankMap = new Map();
    const modelUpdates: Array<Record<string, unknown>> = [];
    const supabase = createPersistMockSupabase({ modelUpdateCollector: modelUpdates });

    await persistResults(supabase, inputs, results);

    expect(modelUpdates[0]).toMatchObject({
      id: "m1",
      capability_score: null,
      capability_rank: null,
      market_cap_estimate: null,
      agent_score: null,
      agent_rank: null,
    });
  });

  it("does not repersist public ranking fields onto not-ready rows", async () => {
    const modelIds = ["m1"];
    const inputs = buildFixtureInputs(modelIds);
    inputs.models[0] = {
      ...inputs.models[0],
      release_date: null,
      context_window: null,
    };
    const results = buildFixtureResults(modelIds);
    const modelUpdates: Array<Record<string, unknown>> = [];
    const supabase = createPersistMockSupabase({ modelUpdateCollector: modelUpdates });

    await persistResults(supabase, inputs, results);

    expect(modelUpdates[0]).toMatchObject({
      id: "m1",
      overall_rank: null,
      balanced_rank: null,
      quality_score: null,
      popularity_score: null,
      adoption_score: null,
      capability_score: null,
      usage_score: null,
      expert_score: null,
      value_score: null,
      market_cap_estimate: null,
    });
  });
});
