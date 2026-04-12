import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../data-sources/registry", () => ({
  loadAllAdapters: vi.fn(),
  listAdapters: vi.fn(() => ["provider-news"]),
  getAdapter: vi.fn(() => ({
    healthCheck: vi.fn(async () => ({ healthy: true, latencyMs: 10 })),
  })),
}));

vi.mock("../../data-sources/orchestrator", () => ({
  runSingleSync: vi.fn(async (slug: string) => ({
    tier: 1,
    sourcesRun: 1,
    sourcesSucceeded: 1,
    sourcesFailed: 0,
    details: [
      {
        source: slug,
        status: "success",
        recordsProcessed: 1,
        recordsCreated: 1,
        recordsUpdated: 0,
        durationMs: 5,
        errors: [],
      },
    ],
  })),
}));

vi.mock("../../benchmark-coverage-compute", () => ({
  computeBenchmarkCoverage: vi.fn(async () => ({
    recent_sparse_benchmark_expected_official: [
      {
        slug: "provider-news",
        provider: "Provider News",
        category: "llm",
        release_date: "2026-03-30",
      },
    ],
  })),
}));

vi.mock("../../benchmark-metadata-coverage-compute", () => ({
  computeBenchmarkMetadataCoverage: vi.fn(async () => ({
    missingTrustedLocatorCount: 1,
    trustedLocatorCoveragePct: 50,
    recentMissingTrustedLocators: [
      {
        slug: "provider-news",
        provider: "Provider News",
        category: "llm",
        release_date: "2026-03-30",
      },
    ],
  })),
}));

vi.mock("../ledger", () => ({
  recordAgentIssue: vi.fn(async () => undefined),
  recordAgentIssueFailure: vi.fn(async () => undefined),
  resolveAgentIssue: vi.fn(async () => undefined),
}));

import pipelineEngineer from "./pipeline-engineer";
import { runSingleSync } from "../../data-sources/orchestrator";
import { recordAgentIssue } from "../ledger";

function createSupabaseMock() {
  return {
    from: (table: string) => {
      let rows: unknown[] = [];
      if (table === "data_sources") {
        rows = [
          {
            slug: "provider-news",
            adapter_type: "provider-news",
            secret_env_keys: [],
            is_enabled: true,
          },
        ];
      } else if (table === "sync_jobs") {
        rows = [
          { source: "provider-news", status: "failed", created_at: "2026-03-30T00:00:00.000Z" },
          { source: "arxiv", status: "failed", created_at: "2026-03-30T00:00:00.000Z" },
        ];
      } else if (table === "cron_runs") {
        rows = [
          {
            job_name: "sync-tier-1",
            status: "completed",
            started_at: "2026-03-30T00:00:00.000Z",
            created_at: "2026-03-30T00:00:00.000Z",
          },
          {
            job_name: "compute-scores",
            status: "failed",
            started_at: "2026-03-30T00:30:00.000Z",
            created_at: "2026-03-30T00:30:00.000Z",
          },
        ];
      }

      const chain = {
        select: () => chain,
        eq: (_column?: string, _value?: unknown) => chain,
        in: (_column?: string, _values?: unknown[]) => chain,
        gte: (_column?: string, _value?: unknown) => chain,
        order: (_column?: string, _options?: unknown) => chain,
        then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
          resolve({ data: rows, error: null }),
      };

      return chain;
    },
  };
}

describe("pipelineEngineer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("repairs only currently enabled sources", async () => {
    const log = {
      info: vi.fn(async () => undefined),
      warn: vi.fn(async () => undefined),
      error: vi.fn(async () => undefined),
    };

    const result = await pipelineEngineer.run({
      supabase: createSupabaseMock() as never,
      agent: {
        config: {
          max_repair_attempts: 5,
          max_verification_retries: 3,
        },
      } as never,
      task: {} as never,
      log,
      signal: undefined,
    });

    expect(result.success).toBe(true);
    expect(runSingleSync).toHaveBeenCalledTimes(1);
    expect(runSingleSync).toHaveBeenCalledWith("provider-news");
    expect(log.warn).toHaveBeenCalledWith(
      "Found 1 failed sources in last 24h: provider-news"
    );
    expect(result.output.failedSources).toEqual(["provider-news"]);
    expect(recordAgentIssue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        issueType: "pipeline_cron_health",
        source: "compute-scores",
      })
    );
    expect(recordAgentIssue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        issueType: "benchmark_coverage_health",
        source: "benchmark-pipeline",
      })
    );
  });
});
