/**
 * Tests for data-integrity.ts
 *
 * Covers pure computation functions:
 *   - computeQualityScore
 *   - computeCompleteness
 *   - computeFreshness
 *   - computeTrend
 *   - buildTableCoverageMap / getExpectedTables (TABLE_MAP)
 *   - verifyDataIntegrity (mocked Supabase)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  computeQualityScore,
  computeCompleteness,
  computeFreshness,
  computeTrend,
  TABLE_MAP,
  verifyDataIntegrity,
} from "./data-integrity";

// ---------------------------------------------------------------------------
// computeQualityScore
// ---------------------------------------------------------------------------

describe("computeQualityScore", () => {
  it("returns 100 when all factors are 1.0", () => {
    expect(
      computeQualityScore({ completeness: 1.0, freshness: 1.0, trend: 1.0 })
    ).toBe(100);
  });

  it("returns 0 when all factors are 0", () => {
    expect(
      computeQualityScore({ completeness: 0, freshness: 0, trend: 0 })
    ).toBe(0);
  });

  it("uses weights completeness:0.4, freshness:0.4, trend:0.2", () => {
    // completeness=1, freshness=0, trend=0 => 0.4 * 100 = 40
    expect(
      computeQualityScore({ completeness: 1.0, freshness: 0, trend: 0 })
    ).toBe(40);
  });

  it("freshness alone at 1.0 => 40", () => {
    expect(
      computeQualityScore({ completeness: 0, freshness: 1.0, trend: 0 })
    ).toBe(40);
  });

  it("trend alone at 1.0 => 20", () => {
    expect(
      computeQualityScore({ completeness: 0, freshness: 0, trend: 1.0 })
    ).toBe(20);
  });

  it("returns correct weighted average for mixed input", () => {
    // completeness=0.5, freshness=0.5, trend=0.5 => 0.5 * 100 = 50
    expect(
      computeQualityScore({ completeness: 0.5, freshness: 0.5, trend: 0.5 })
    ).toBe(50);
  });

  it("rounds to integer", () => {
    // completeness=1, freshness=0, trend=0.5 => (0.4 + 0 + 0.1) * 100 = 50
    const result = computeQualityScore({
      completeness: 1.0,
      freshness: 0,
      trend: 0.5,
    });
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// computeCompleteness
// ---------------------------------------------------------------------------

describe("computeCompleteness", () => {
  it("returns 0 for 0 records regardless of expected", () => {
    expect(computeCompleteness(0, 100)).toBe(0);
  });

  it("returns 1.0 when record count equals expected minimum", () => {
    expect(computeCompleteness(100, 100)).toBe(1.0);
  });

  it("returns 1.0 when record count exceeds expected minimum (clamped)", () => {
    expect(computeCompleteness(500, 100)).toBe(1.0);
  });

  it("returns ratio when record count is below expected minimum", () => {
    expect(computeCompleteness(50, 100)).toBeCloseTo(0.5);
  });

  it("handles fractional ratio", () => {
    expect(computeCompleteness(25, 100)).toBeCloseTo(0.25);
  });
});

// ---------------------------------------------------------------------------
// computeFreshness
// ---------------------------------------------------------------------------

describe("computeFreshness", () => {
  const NOW = new Date("2026-03-12T12:00:00.000Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 when lastSyncAt is null (never synced)", () => {
    expect(computeFreshness(null, 6)).toBe(0);
  });

  it("returns 1.0 when last sync is exactly now (within interval)", () => {
    const lastSync = new Date(NOW).toISOString();
    expect(computeFreshness(lastSync, 6)).toBe(1.0);
  });

  it("returns 1.0 when last sync is within the interval", () => {
    // synced 3h ago, interval is 6h => within
    const lastSync = new Date(NOW - 3 * 60 * 60 * 1000).toISOString();
    expect(computeFreshness(lastSync, 6)).toBe(1.0);
  });

  it("returns 1.0 at exactly interval boundary", () => {
    const lastSync = new Date(NOW - 6 * 60 * 60 * 1000).toISOString();
    expect(computeFreshness(lastSync, 6)).toBe(1.0);
  });

  it("returns 0 at 4x interval (fully stale)", () => {
    const lastSync = new Date(NOW - 4 * 6 * 60 * 60 * 1000).toISOString();
    expect(computeFreshness(lastSync, 6)).toBe(0);
  });

  it("returns 0 beyond 4x interval", () => {
    const lastSync = new Date(NOW - 5 * 6 * 60 * 60 * 1000).toISOString();
    expect(computeFreshness(lastSync, 6)).toBe(0);
  });

  it("returns 0.5 at midpoint between interval and 4x interval", () => {
    // overdue zone: interval to 4x = 3x range; midpoint at 2.5x interval
    // decay from 1.0 (at interval) to 0 (at 4x) linearly
    // at 2.5x: overdueRatio = (2.5-1)/(4-1) = 1.5/3 = 0.5 => freshness = 0.5
    const lastSync = new Date(NOW - 2.5 * 6 * 60 * 60 * 1000).toISOString();
    expect(computeFreshness(lastSync, 6)).toBeCloseTo(0.5);
  });
});

// ---------------------------------------------------------------------------
// computeTrend
// ---------------------------------------------------------------------------

describe("computeTrend", () => {
  it("returns 1.0 when latest >= previous (equal)", () => {
    expect(computeTrend(100, 100)).toBe(1.0);
  });

  it("returns 1.0 when latest > previous (growing)", () => {
    expect(computeTrend(200, 100)).toBe(1.0);
  });

  it("returns 0.5 when latest is half of previous", () => {
    expect(computeTrend(50, 100)).toBeCloseTo(0.5);
  });

  it("returns 0 when latest is 0 and previous > 0", () => {
    expect(computeTrend(0, 100)).toBe(0);
  });

  it("returns 1.0 when previousCount is 0 (no baseline)", () => {
    expect(computeTrend(50, 0)).toBe(1.0);
  });

  it("returns 1.0 when both are 0 (no data yet)", () => {
    expect(computeTrend(0, 0)).toBe(1.0);
  });

  it("clamps minimum to 0 (never negative)", () => {
    const result = computeTrend(0, 100);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// TABLE_MAP
// ---------------------------------------------------------------------------

describe("TABLE_MAP", () => {
  it("maps models to 'models'", () => {
    expect(TABLE_MAP["models"]).toBe("models");
  });

  it("maps benchmarks to 'benchmark_scores'", () => {
    expect(TABLE_MAP["benchmarks"]).toBe("benchmark_scores");
  });

  it("maps pricing to 'model_pricing'", () => {
    expect(TABLE_MAP["pricing"]).toBe("model_pricing");
  });

  it("maps elo_ratings to 'elo_ratings'", () => {
    expect(TABLE_MAP["elo_ratings"]).toBe("elo_ratings");
  });

  it("maps news to 'model_news'", () => {
    expect(TABLE_MAP["news"]).toBe("model_news");
  });

  it("maps rankings to 'models' (rankings update models table)", () => {
    expect(TABLE_MAP["rankings"]).toBe("models");
  });
});

// ---------------------------------------------------------------------------
// verifyDataIntegrity (integration test with mocked Supabase)
// ---------------------------------------------------------------------------

describe("verifyDataIntegrity", () => {
  const NOW = new Date("2026-03-12T12:00:00.000Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function syncedAgo(hours: number): string {
    return new Date(NOW - hours * 60 * 60 * 1000).toISOString();
  }

  function makeMockSupabase(overrides: {
    dataSources?: unknown[];
    pipelineHealth?: unknown[];
    syncJobs?: unknown[];
    tableCount?: number;
    tableError?: boolean;
  }) {
    const dataSources = overrides.dataSources ?? [
      {
        slug: "openrouter-models",
        name: "OpenRouter Models",
        output_types: ["models", "pricing"],
        sync_interval_hours: 6,
        last_sync_at: syncedAgo(3),
        last_sync_records: 200,
        is_enabled: true,
      },
    ];

    const pipelineHealth = overrides.pipelineHealth ?? [
      {
        source_slug: "openrouter-models",
        last_success_at: syncedAgo(3),
        expected_interval_hours: 6,
        consecutive_failures: 0,
      },
    ];

    const syncJobs = overrides.syncJobs ?? [
      {
        source_slug: "openrouter-models",
        records_processed: 200,
        created_at: syncedAgo(3),
      },
      {
        source_slug: "openrouter-models",
        records_processed: 190,
        created_at: syncedAgo(9),
      },
    ];

    const modelSnapshots = [
      {
        source_coverage: {
          biasRisk: "low",
          corroborationLevel: "strong",
          independentQualitySourceCount: 2,
          totalDistinctSources: 5,
        },
      },
      {
        source_coverage: {
          biasRisk: "high",
          corroborationLevel: "single_source",
          independentQualitySourceCount: 1,
          totalDistinctSources: 2,
        },
      },
    ];

    const activeModels = [
      {
        slug: "google-gemma-4-31b-it",
        provider: "Google",
        name: "Gemma 4 31B IT",
        category: "multimodal",
        hf_model_id: "google/gemma-4-31b-it",
        website_url: "https://ai.google.dev/gemma",
        release_date: "2026-04-02",
        is_open_weights: true,
        license: "open_source",
        license_name: "Apache 2.0",
        context_window: 128000,
        status: "active",
      },
      {
        slug: "x-ai-grok-4-20",
        provider: "xAI",
        name: "Grok 4.20",
        category: "llm",
        hf_model_id: null,
        website_url: null,
        release_date: "2026-04-01",
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: null,
        status: "active",
      },
      {
        slug: "mystery-model",
        provider: "Unknown",
        name: "Mystery Model",
        category: null,
        hf_model_id: null,
        website_url: null,
        release_date: null,
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: null,
        status: "active",
      },
    ];

    return {
      from: (table: string) => {
        if (table === "data_sources") {
          return {
            select: () => Promise.resolve({ data: dataSources, error: null }),
          };
        }
        if (table === "pipeline_health") {
          return {
            select: () => Promise.resolve({ data: pipelineHealth, error: null }),
          };
        }
        if (table === "sync_jobs") {
          return {
            select: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: syncJobs, error: null }),
              }),
            }),
          };
        }
        if (table === "model_snapshots") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: modelSnapshots, error: null }),
            }),
          };
        }
        if (table === "models") {
          return {
            select: (columns?: string, options?: { count?: string; head?: boolean }) => {
              if (options?.head) {
                if (overrides.tableError) {
                  return Promise.resolve({
                    count: null,
                    error: { message: "DB error" },
                  });
                }
                const count = overrides.tableCount ?? 100;
                return Promise.resolve({ count, error: null });
              }

              if (
                columns ===
                "slug, provider, category, hf_model_id, website_url, release_date"
              ) {
                return {
                  eq: () => ({
                    range: () =>
                      Promise.resolve({ data: activeModels, error: null }),
                  }),
                };
              }
              if (
                columns ===
                "slug, provider, name, category, release_date, is_open_weights, license, license_name, context_window"
              ) {
                return {
                  eq: () => ({
                    range: () =>
                      Promise.resolve({ data: activeModels, error: null }),
                  }),
                };
              }

              return Promise.resolve({ data: activeModels, error: null });
            },
          };
        }
        // Table row count queries
        if (overrides.tableError) {
          return {
            select: () => Promise.resolve({ count: null, error: { message: "DB error" } }),
          };
        }
        const count = overrides.tableCount ?? 100;
        return {
          select: () => Promise.resolve({ count, error: null }),
        };
      },
    };
  }

  it("returns a DataIntegrityReport with required fields", async () => {
    const supabase = makeMockSupabase({});
    const report = await verifyDataIntegrity(supabase as never);

    expect(report).toHaveProperty("checkedAt");
    expect(report).toHaveProperty("summary");
    expect(report).toHaveProperty("qualityScores");
    expect(report).toHaveProperty("tableCoverage");
    expect(report).toHaveProperty("freshness");
    expect(report).toHaveProperty("modelEvidence");
    expect(report).toHaveProperty("benchmarkMetadata");
    expect(report).toHaveProperty("publicMetadata");
  });

  it("summary.totalSources matches data sources count", async () => {
    const supabase = makeMockSupabase({});
    const report = await verifyDataIntegrity(supabase as never);

    expect(report.summary.totalSources).toBe(1);
  });

  it("includes model evidence diversity summary", async () => {
    const supabase = makeMockSupabase({});
    const report = await verifyDataIntegrity(supabase as never);

    expect(report.modelEvidence.totalModels).toBe(2);
    expect(report.modelEvidence.highBiasRiskModels).toBe(1);
    expect(report.modelEvidence.lowBiasRiskModels).toBe(1);
    expect(report.modelEvidence.averageIndependentQualitySources).toBeCloseTo(1.5);
  });

  it("includes benchmark metadata coverage summary", async () => {
    const supabase = makeMockSupabase({});
    const report = await verifyDataIntegrity(supabase as never);

    expect(report.benchmarkMetadata.benchmarkExpectedModels).toBe(2);
    expect(report.benchmarkMetadata.withTrustedHfLocator).toBe(1);
    expect(report.benchmarkMetadata.withTrustedWebsiteLocator).toBe(1);
    expect(report.benchmarkMetadata.withAnyTrustedBenchmarkLocator).toBe(1);
    expect(report.benchmarkMetadata.missingTrustedBenchmarkLocatorCount).toBe(1);
    expect(report.benchmarkMetadata.trustedLocatorCoveragePct).toBe(50);
    expect(report.benchmarkMetadata.missingTrustedBenchmarkLocator[0]?.slug).toBe(
      "x-ai-grok-4-20"
    );
  });

  it("includes public metadata coverage summary", async () => {
    const supabase = makeMockSupabase({});
    const report = await verifyDataIntegrity(supabase as never);

    expect(report.publicMetadata.activeModels).toBe(3);
    expect(report.publicMetadata.completeDiscoveryMetadataCount).toBe(2);
    expect(report.publicMetadata.completeDiscoveryMetadataPct).toBeCloseTo(66.7);
    expect(report.publicMetadata.missingCategoryCount).toBe(1);
    expect(report.publicMetadata.missingReleaseDateCount).toBe(1);
    expect(report.publicMetadata.openWeightsMissingLicenseCount).toBe(0);
    expect(report.publicMetadata.llmMissingContextWindowCount).toBe(1);
    expect(report.publicMetadata.recentIncompleteModels[0]?.slug).toBe(
      "x-ai-grok-4-20"
    );
  });

  it("qualityScores has one entry per source", async () => {
    const supabase = makeMockSupabase({});
    const report = await verifyDataIntegrity(supabase as never);

    expect(report.qualityScores).toHaveLength(1);
    expect(report.qualityScores[0].slug).toBe("openrouter-models");
  });

  it("quality score has all required fields", async () => {
    const supabase = makeMockSupabase({});
    const report = await verifyDataIntegrity(supabase as never);
    const score = report.qualityScores[0];

    expect(score).toHaveProperty("slug");
    expect(score).toHaveProperty("name");
    expect(score).toHaveProperty("qualityScore");
    expect(score).toHaveProperty("completeness");
    expect(score).toHaveProperty("freshness");
    expect(score).toHaveProperty("trend");
    expect(score).toHaveProperty("matchRate");
    expect(score).toHaveProperty("warningCount");
    expect(score).toHaveProperty("optionalSkipCount");
    expect(score).toHaveProperty("knownCatalogGapCount");
    expect(score).toHaveProperty("unmatchedModelCount");
    expect(score).toHaveProperty("lastSyncStatus");
    expect(score).toHaveProperty("diagnosticPenalty");
    expect(score).toHaveProperty("issueSummary");
    expect(score).toHaveProperty("recordCount");
    expect(score).toHaveProperty("lastSyncAt");
    expect(score).toHaveProperty("syncIntervalHours");
    expect(score).toHaveProperty("staleSince");
    expect(score).toHaveProperty("isStale");
  });

  it("downgrades fresh sources with low match rates and warnings", async () => {
    const supabase = makeMockSupabase({
      syncJobs: [
        {
          source_slug: "openrouter-models",
          records_processed: 200,
          created_at: syncedAgo(3),
          status: "success",
          error_message: null,
          metadata: {
            matchRate: "12.5%",
            warningCount: 2,
            unmatchedModels: ["foo"],
          },
        },
        {
          source_slug: "openrouter-models",
          records_processed: 190,
          created_at: syncedAgo(9),
          status: "success",
          error_message: null,
          metadata: null,
        },
      ],
    });

    const report = await verifyDataIntegrity(supabase as never);
    const score = report.qualityScores[0];

    expect(score.matchRate).toBe(12.5);
    expect(score.warningCount).toBe(2);
    expect(score.unmatchedModelCount).toBe(1);
    expect(score.diagnosticPenalty).toBeGreaterThan(0);
    expect(score.qualityScore).toBeLessThan(100);
    expect(score.issueSummary).toContain("Low match rate");
    expect(report.summary.warningSources).toBe(1);
    expect(report.summary.lowMatchSources).toBe(1);
  });

  it("freshly synced source is not stale", async () => {
    const supabase = makeMockSupabase({});
    const report = await verifyDataIntegrity(supabase as never);
    const score = report.qualityScores[0];

    expect(score.isStale).toBe(false);
    expect(score.staleSince).toBeNull();
  });

  it("stale source is flagged with isStale=true", async () => {
    const supabase = makeMockSupabase({
      dataSources: [
        {
          slug: "old-adapter",
          name: "Old Adapter",
          output_types: ["models"],
          sync_interval_hours: 6,
          last_sync_at: syncedAgo(30),
          last_sync_records: 50,
          is_enabled: true,
        },
      ],
      pipelineHealth: [
        {
          source_slug: "old-adapter",
          last_success_at: syncedAgo(30),
          expected_interval_hours: 6,
          consecutive_failures: 0,
        },
      ],
      syncJobs: [],
    });

    const report = await verifyDataIntegrity(supabase as never);
    expect(report.qualityScores[0].isStale).toBe(true);
    expect(report.summary.staleSources).toBeGreaterThan(0);
  });

  it("tableCoverage includes tables from enabled adapters", async () => {
    const supabase = makeMockSupabase({});
    const report = await verifyDataIntegrity(supabase as never);

    const tableNames = report.tableCoverage.map((t) => t.table);
    expect(tableNames).toContain("models");
    expect(tableNames).toContain("model_pricing");
  });

  it("table coverage shows row counts", async () => {
    const supabase = makeMockSupabase({ tableCount: 150 });
    const report = await verifyDataIntegrity(supabase as never);

    const modelsCoverage = report.tableCoverage.find((t) => t.table === "models");
    expect(modelsCoverage).toBeDefined();
    expect(modelsCoverage!.rowCount).toBe(150);
    expect(modelsCoverage!.isEmpty).toBe(false);
  });

  it("empty table is flagged with isEmpty=true", async () => {
    const supabase = makeMockSupabase({ tableCount: 0 });
    const report = await verifyDataIntegrity(supabase as never);

    const modelsCoverage = report.tableCoverage.find((t) => t.table === "models");
    expect(modelsCoverage!.isEmpty).toBe(true);
    expect(report.summary.emptyTables).toBeGreaterThan(0);
  });

  it("freshness.staleSources lists sources overdue", async () => {
    const supabase = makeMockSupabase({
      dataSources: [
        {
          slug: "stale-adapter",
          name: "Stale Adapter",
          output_types: ["news"],
          sync_interval_hours: 24,
          last_sync_at: syncedAgo(100),
          last_sync_records: 10,
          is_enabled: true,
        },
      ],
      pipelineHealth: [
        {
          source_slug: "stale-adapter",
          last_success_at: syncedAgo(100),
          expected_interval_hours: 24,
          consecutive_failures: 0,
        },
      ],
      syncJobs: [],
    });

    const report = await verifyDataIntegrity(supabase as never);
    expect(report.freshness.staleSourceCount).toBeGreaterThan(0);
    expect(report.freshness.staleSources.length).toBeGreaterThan(0);

    const staleEntry = report.freshness.staleSources[0];
    expect(staleEntry).toHaveProperty("slug");
    expect(staleEntry).toHaveProperty("name");
    expect(staleEntry).toHaveProperty("lastSyncAt");
    expect(staleEntry).toHaveProperty("expectedIntervalHours");
    expect(staleEntry).toHaveProperty("overdueBy");
    expect(typeof staleEntry.overdueBy).toBe("string");
  });

  it("averageQualityScore is computed correctly", async () => {
    const supabase = makeMockSupabase({});
    const report = await verifyDataIntegrity(supabase as never);

    expect(report.summary.averageQualityScore).toBeGreaterThanOrEqual(0);
    expect(report.summary.averageQualityScore).toBeLessThanOrEqual(100);
  });

  it("excludes disabled sources from integrity summaries", async () => {
    const supabase = makeMockSupabase({
      dataSources: [
        {
          slug: "enabled-adapter",
          name: "Enabled Adapter",
          output_types: ["models"],
          sync_interval_hours: 6,
          last_sync_at: syncedAgo(3),
          last_sync_records: 100,
          is_enabled: true,
        },
        {
          slug: "disabled-adapter",
          name: "Disabled Adapter",
          output_types: ["news"],
          sync_interval_hours: 24,
          last_sync_at: syncedAgo(100),
          last_sync_records: 0,
          is_enabled: false,
        },
      ],
      pipelineHealth: [
        {
          source_slug: "enabled-adapter",
          last_success_at: syncedAgo(3),
          expected_interval_hours: 6,
          consecutive_failures: 0,
        },
        {
          source_slug: "disabled-adapter",
          last_success_at: syncedAgo(100),
          expected_interval_hours: 24,
          consecutive_failures: 5,
        },
      ],
    });

    const report = await verifyDataIntegrity(supabase as never);

    expect(report.summary.totalSources).toBe(1);
    expect(report.qualityScores).toHaveLength(1);
    expect(report.qualityScores[0].slug).toBe("enabled-adapter");
    expect(report.freshness.staleSources.find((source) => source.slug === "disabled-adapter")).toBeUndefined();
  });
});
