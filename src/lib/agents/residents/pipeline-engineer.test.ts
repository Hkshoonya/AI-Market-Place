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

vi.mock("../../crawl-health", () => ({
  checkCrawlerSurfaceHealth: vi.fn(async () => ({
    healthy: false,
    criticalFailures: 1,
    warningCount: 2,
    checkedAt: "2026-03-30T01:00:00.000Z",
    routes: [
      {
        path: "/",
        url: "https://aimarketcap.tech",
        status: 200,
        ok: true,
        contentType: "text/html; charset=utf-8",
        error: null,
        warnings: ["challenge markers present in public HTML"],
      },
      {
        path: "/robots.txt",
        url: "https://aimarketcap.tech/robots.txt",
        status: 200,
        ok: true,
        contentType: "text/plain; charset=utf-8",
        error: null,
        warnings: ["cloudflare managed robots content detected"],
      },
      {
        path: "/sitemap.xml",
        url: "https://aimarketcap.tech/sitemap.xml",
        status: 503,
        ok: false,
        contentType: "text/plain; charset=utf-8",
        error: null,
        warnings: [],
      },
    ],
    warnings: [
      "/: challenge markers present in public HTML",
      "/robots.txt: cloudflare managed robots content detected",
    ],
  })),
}));

vi.mock("../../payments/stripe-health", () => ({
  getStripePaymentsHealth: vi.fn(async () => ({
    status: "ready",
    checkoutConfigured: true,
    webhookConfigured: true,
    publishableKeyConfigured: true,
    blockingIssues: [],
    webhookDelivery: {
      status: "degraded",
      tableAvailable: true,
      recentFailures24h: 2,
      recentSuccesses24h: 0,
      consecutiveFailures: 2,
      latestEventAt: "2026-03-30T01:00:00.000Z",
      latestProcessedAt: null,
      latestFailedAt: "2026-03-30T01:00:00.000Z",
      warning: null,
    },
  })),
}));

vi.mock("../../homepage/fetch-active-models", () => ({
  fetchAllHomepageActiveModels: vi.fn(async () => [
    {
      id: "previous-opus",
      slug: "anthropic-claude-opus-4-6",
      name: "Claude Opus 4.6",
      provider: "Anthropic",
      category: "multimodal",
      release_date: "2025-12-12",
      description:
        "Previous flagship Claude Opus release retained for compatibility after the Claude Opus 4.7 launch.",
      overall_rank: 14,
      quality_score: 60.3,
      capability_score: 80.2,
      adoption_score: 55.4,
      economic_footprint_score: 53.6,
      popularity_score: 47.8,
    },
  ]),
}));

vi.mock("../../homepage/ranking-health", () => ({
  computeHomepageRankingHealth: vi.fn(() => ({
    healthy: false,
    shortlistCount: 1,
    shortlist: [
      {
        id: "previous-opus",
        slug: "anthropic-claude-opus-4-6",
        name: "Claude Opus 4.6",
        provider: "Anthropic",
        releaseDate: "2025-12-12",
        score: 27.99,
      },
    ],
    missingRecentLeadership: [
      {
        id: "new-opus",
        slug: "anthropic-claude-opus-4-7",
        name: "Claude Opus 4.7",
        provider: "Anthropic",
        releaseDate: "2026-04-16",
        score: 62.78,
      },
    ],
    lifecycleRowsInShortlist: [
      {
        id: "previous-opus",
        slug: "anthropic-claude-opus-4-6",
        name: "Claude Opus 4.6",
        provider: "Anthropic",
        releaseDate: "2025-12-12",
        score: 27.99,
      },
    ],
    previewRowsInShortlist: [],
    staleRowsInShortlist: [],
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
            sync_interval_hours: 6,
            last_success_at: "2026-03-30T00:00:00.000Z",
            last_sync_at: "2026-03-30T00:00:00.000Z",
            last_sync_records: 3,
            last_error_message: null,
          },
          {
            slug: "terminal-bench",
            adapter_type: "terminal-bench",
            secret_env_keys: [],
            is_enabled: true,
            sync_interval_hours: 24,
            last_success_at: "2026-03-30T00:00:00.000Z",
            last_sync_at: "2026-03-30T00:00:00.000Z",
            last_sync_records: 0,
            last_error_message: "upstream timeout",
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
      } else if (table === "pipeline_health") {
        rows = [
          {
            source_slug: "provider-news",
            consecutive_failures: 0,
            last_success_at: "2026-03-30T00:00:00.000Z",
            expected_interval_hours: 6,
          },
          {
            source_slug: "terminal-bench",
            consecutive_failures: 2,
            last_success_at: "2026-03-30T00:00:00.000Z",
            expected_interval_hours: 24,
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
        issueType: "benchmark_source_health",
        source: "terminal-bench",
      })
    );
    expect(recordAgentIssue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        issueType: "benchmark_coverage_health",
        source: "benchmark-pipeline",
      })
    );
    expect(recordAgentIssue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        issueType: "crawler_surface_health",
        source: "public-web",
      })
    );
    expect(recordAgentIssue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        issueType: "payments_webhook_health",
        source: "stripe",
      })
    );
    expect(recordAgentIssue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        issueType: "homepage_ranking_health",
        source: "homepage-top-models",
      })
    );
  });
});
