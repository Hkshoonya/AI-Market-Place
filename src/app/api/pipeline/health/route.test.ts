/**
 * Tests for /api/pipeline/health route
 *
 * Covers:
 *  - Public summary (no auth): returns status, healthy/degraded/down counts, checkedAt
 *  - Authed detail (Bearer CRON_SECRET): includes full adapters[] breakdown
 *  - Status computation: healthy / degraded / down via failures AND staleness
 *  - Missing pipeline_health row (never synced) treated as down
 *  - Error handling: DB error returns 500
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Must mock @sentry/nextjs before importing the route (handleApiError imports it)
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Mock @/lib/logging (handleApiError imports it via systemLog)
vi.mock("@/lib/logging", () => ({
  systemLog: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  createTaggedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/benchmark-coverage-compute", () => ({
  computeBenchmarkCoverage: vi.fn().mockResolvedValue({
    totals: {
      active_models: 100,
      with_scores: 40,
      with_benchmark_news: 20,
      covered_models: 50,
      coverage_pct: 50,
    },
    official_providers: [],
    recent_sparse_benchmark_expected_official: [],
  }),
}));

vi.mock("@/lib/benchmark-metadata-coverage-compute", () => ({
  computeBenchmarkMetadataCoverage: vi.fn().mockResolvedValue({
    benchmarkExpectedModels: 60,
    withTrustedHfLocator: 20,
    withTrustedWebsiteLocator: 15,
    withAnyTrustedBenchmarkLocator: 30,
    missingTrustedLocatorCount: 30,
    trustedLocatorCoveragePct: 50,
    recentMissingTrustedLocators: [],
  }),
}));

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

type MockRow = Record<string, unknown>;

interface TableMock {
  data: MockRow[] | null;
  error: { message: string } | null;
}

function createMockSupabase(tables: Record<string, TableMock>) {
  return {
    from: (table: string) => {
      const result = tables[table] ?? { data: [], error: null };
      let currentData = Array.isArray(result.data) ? [...result.data] : result.data;

      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          if (Array.isArray(currentData)) {
            currentData = currentData.filter((row) => row[column] === value);
          }
          return chain;
        },
        is: (column: string, value: unknown) => {
          if (Array.isArray(currentData)) {
            currentData = currentData.filter((row) => row[column] === value);
          }
          return chain;
        },
        then: (resolve: (v: unknown) => void) => resolve({ data: currentData, error: result.error }),
      };

      return chain;
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

const mockCreateAdminClient = vi.mocked(createAdminClient);

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new Request("http://localhost/api/pipeline/health", { headers });
}

// NOW = 2026-03-12T00:00:00Z for deterministic staleness calculations
const NOW = new Date("2026-03-12T00:00:00.000Z").getTime();

// Builds a last_success_at string that is `multiplier * intervalHours` hours before NOW
function syncedAgo(multiplier: number, intervalHours: number): string {
  return new Date(NOW - multiplier * intervalHours * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

function makeDataSources(sources: Array<{
  slug: string;
  is_enabled?: boolean;
  quarantined_at?: string | null;
  last_success_at?: string | null;
  last_sync_at?: string | null;
  last_sync_records?: number;
  last_error_message?: string | null;
  sync_interval_hours?: number;
}>) {
  return sources.map((s) => ({
    slug: s.slug,
    is_enabled: s.is_enabled ?? true,
    quarantined_at: s.quarantined_at ?? null,
    last_success_at: s.last_success_at ?? null,
    last_sync_at: s.last_sync_at ?? null,
    last_sync_records: s.last_sync_records ?? 0,
    last_error_message: s.last_error_message ?? null,
    sync_interval_hours: s.sync_interval_hours ?? 6,
  }));
}

function makePipelineHealth(rows: Array<{
  source_slug: string;
  consecutive_failures?: number;
  last_success_at?: string | null;
  expected_interval_hours?: number;
}>) {
  return rows.map((r) => ({
    source_slug: r.source_slug,
    consecutive_failures: r.consecutive_failures ?? 0,
    last_success_at: r.last_success_at ?? null,
    expected_interval_hours: r.expected_interval_hours ?? 6,
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/pipeline/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // 1. Public summary (no auth)
  // -------------------------------------------------------------------------
  describe("public summary (no Authorization header)", () => {
    it("returns 200 with status, healthy/degraded/down counts, and checkedAt", async () => {
      const supabase = createMockSupabase({
        data_sources: {
          data: makeDataSources([
            { slug: "adapter-a", last_sync_at: syncedAgo(0.5, 6), last_sync_records: 100 },
          ]),
          error: null,
        },
        pipeline_health: {
          data: makePipelineHealth([
            { source_slug: "adapter-a", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6), expected_interval_hours: 6 },
          ]),
          error: null,
        },
      });
      mockCreateAdminClient.mockReturnValue(supabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("healthy");
      expect(body).toHaveProperty("degraded");
      expect(body).toHaveProperty("down");
      expect(body).toHaveProperty("checkedAt");
      expect(body).toHaveProperty("benchmarkCoverage");
      expect(body.benchmarkCoverage).toHaveProperty("trustedLocatorCoveragePct");
      expect(body.benchmarkCoverage).toHaveProperty("missingTrustedLocatorCount");
    });

    it("does NOT include adapters field in public response", async () => {
      const supabase = createMockSupabase({
        data_sources: {
          data: makeDataSources([{ slug: "adapter-a" }]),
          error: null,
        },
        pipeline_health: {
          data: makePipelineHealth([
            { source_slug: "adapter-a", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6), expected_interval_hours: 6 },
          ]),
          error: null,
        },
      });
      mockCreateAdminClient.mockReturnValue(supabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(body).not.toHaveProperty("adapters");
    });

    it("ignores disabled data sources in health counts", async () => {
      const supabase = createMockSupabase({
        data_sources: {
          data: makeDataSources([
            { slug: "enabled-adapter", sync_interval_hours: 6 },
            { slug: "disabled-adapter", is_enabled: false, sync_interval_hours: 6 },
          ]),
          error: null,
        },
        pipeline_health: {
          data: makePipelineHealth([
            { source_slug: "enabled-adapter", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6), expected_interval_hours: 6 },
            { source_slug: "disabled-adapter", consecutive_failures: 3, last_success_at: syncedAgo(5, 6), expected_interval_hours: 6 },
          ]),
          error: null,
        },
      });
      mockCreateAdminClient.mockReturnValue(supabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(body.status).toBe("healthy");
      expect(body.healthy).toBe(1);
      expect(body.down).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Authed detail (Bearer CRON_SECRET)
  // -------------------------------------------------------------------------
  describe("authed detail (Authorization: Bearer CRON_SECRET)", () => {
    it("returns 200 with full adapters array", async () => {
      const originalSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = "test-secret";

      const supabase = createMockSupabase({
        data_sources: {
          data: makeDataSources([
            { slug: "adapter-a", last_sync_at: syncedAgo(0.5, 6), last_sync_records: 50, last_error_message: null },
          ]),
          error: null,
        },
        pipeline_health: {
          data: makePipelineHealth([
            { source_slug: "adapter-a", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6), expected_interval_hours: 6 },
          ]),
          error: null,
        },
      });
      mockCreateAdminClient.mockReturnValue(supabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest("Bearer test-secret") as never);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveProperty("adapters");
      expect(Array.isArray(body.adapters)).toBe(true);
      expect(body.adapters).toHaveLength(1);
      expect(body.benchmarkCoverage).toHaveProperty("recentMissingTrustedLocators");

      const adapter = body.adapters[0];
      expect(adapter).toHaveProperty("slug", "adapter-a");
      expect(adapter).toHaveProperty("status");
      expect(adapter).toHaveProperty("lastSync");
      expect(adapter).toHaveProperty("consecutiveFailures");
      expect(adapter).toHaveProperty("recordCount");
      expect(adapter).toHaveProperty("error");

      process.env.CRON_SECRET = originalSecret;
    });

    it("wrong Bearer token returns public summary (no adapters)", async () => {
      const originalSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = "real-secret";

      const supabase = createMockSupabase({
        data_sources: { data: makeDataSources([{ slug: "adapter-a" }]), error: null },
        pipeline_health: {
          data: makePipelineHealth([{ source_slug: "adapter-a", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6), expected_interval_hours: 6 }]),
          error: null,
        },
      });
      mockCreateAdminClient.mockReturnValue(supabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest("Bearer wrong-token") as never);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).not.toHaveProperty("adapters");

      process.env.CRON_SECRET = originalSecret;
    });

    it("sanitizes raw HTML from upstream adapter errors in detail responses", async () => {
      const originalSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = "test-secret";

      const supabase = createMockSupabase({
        data_sources: {
          data: makeDataSources([
            {
              slug: "adapter-a",
              last_sync_at: syncedAgo(1, 6),
              last_sync_records: 0,
              last_error_message:
                "Failed to fetch GAIA public results: GAIA validation returned HTTP 429: <!DOCTYPE html><html><head><title>Too Many Requests</title></head><body>rate limited</body></html>",
            },
          ]),
          error: null,
        },
        pipeline_health: {
          data: makePipelineHealth([
            { source_slug: "adapter-a", consecutive_failures: 1, last_success_at: syncedAgo(1, 6), expected_interval_hours: 6 },
          ]),
          error: null,
        },
      });
      mockCreateAdminClient.mockReturnValue(supabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest("Bearer test-secret") as never);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.adapters[0].error).toBe(
        "Failed to fetch GAIA public results: GAIA validation returned HTTP 429:"
      );

      process.env.CRON_SECRET = originalSecret;
    });
  });

  // -------------------------------------------------------------------------
  // 3. Status computation
  // -------------------------------------------------------------------------
  describe("status computation", () => {
    it("all adapters healthy -> top-level 'healthy'", async () => {
      const supabase = createMockSupabase({
        data_sources: {
          data: makeDataSources([
            { slug: "a1", sync_interval_hours: 6 },
            { slug: "a2", sync_interval_hours: 6 },
          ]),
          error: null,
        },
        pipeline_health: {
          data: makePipelineHealth([
            { source_slug: "a1", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6), expected_interval_hours: 6 },
            { source_slug: "a2", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6), expected_interval_hours: 6 },
          ]),
          error: null,
        },
      });
      mockCreateAdminClient.mockReturnValue(supabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(body.status).toBe("healthy");
      expect(body.healthy).toBe(2);
      expect(body.degraded).toBe(0);
      expect(body.down).toBe(0);
    });

    it("adapter with 3 failures -> top-level 'down'", async () => {
      const supabase = createMockSupabase({
        data_sources: {
          data: makeDataSources([
            { slug: "a1", sync_interval_hours: 6 },
            { slug: "a2", sync_interval_hours: 6 },
          ]),
          error: null,
        },
        pipeline_health: {
          data: makePipelineHealth([
            { source_slug: "a1", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6), expected_interval_hours: 6 },
            { source_slug: "a2", consecutive_failures: 3, last_success_at: syncedAgo(1, 6), expected_interval_hours: 6 },
          ]),
          error: null,
        },
      });
      mockCreateAdminClient.mockReturnValue(supabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(body.status).toBe("down");
      expect(body.down).toBe(1);
    });

    it("adapter with 1 failure and stale sync beyond the interval -> top-level 'degraded'", async () => {
      const supabase = createMockSupabase({
        data_sources: {
          data: makeDataSources([
            { slug: "a1", sync_interval_hours: 6 },
          ]),
          error: null,
        },
        pipeline_health: {
          data: makePipelineHealth([
            { source_slug: "a1", consecutive_failures: 1, last_success_at: syncedAgo(1.5, 6), expected_interval_hours: 6 },
          ]),
          error: null,
        },
      });
      mockCreateAdminClient.mockReturnValue(supabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(body.status).toBe("degraded");
      expect(body.degraded).toBe(1);
    });

    it("adapter with no pipeline_health row (never synced) -> treated as down", async () => {
      const supabase = createMockSupabase({
        data_sources: {
          data: makeDataSources([
            { slug: "new-adapter", sync_interval_hours: 6 },
          ]),
          error: null,
        },
        pipeline_health: {
          data: [], // no row for new-adapter
          error: null,
        },
      });
      mockCreateAdminClient.mockReturnValue(supabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      // Never synced means staleness is Infinity -> down
      expect(body.status).toBe("down");
      expect(body.down).toBe(1);
    });

    it("falls back to data_sources last_success_at when pipeline_health row is missing", async () => {
      const supabase = createMockSupabase({
        data_sources: {
          data: makeDataSources([
            {
              slug: "recent-adapter",
              last_success_at: syncedAgo(0.5, 6),
              last_sync_at: syncedAgo(0.5, 6),
              sync_interval_hours: 6,
            },
          ]),
          error: null,
        },
        pipeline_health: {
          data: [],
          error: null,
        },
      });
      mockCreateAdminClient.mockReturnValue(supabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(body.status).toBe("healthy");
      expect(body.healthy).toBe(1);
      expect(body.down).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Staleness logic
  // -------------------------------------------------------------------------
  describe("staleness logic", () => {
    it("last_success_at > 2x interval ago -> 'degraded'", async () => {
      const intervalHours = 6;
      const supabase = createMockSupabase({
        data_sources: {
          data: makeDataSources([{ slug: "stale-adapter", sync_interval_hours: intervalHours }]),
          error: null,
        },
        pipeline_health: {
          data: makePipelineHealth([
            {
              source_slug: "stale-adapter",
              consecutive_failures: 0,
              // 2.5x interval -> degraded (> 2x but not > 4x)
              last_success_at: syncedAgo(2.5, intervalHours),
              expected_interval_hours: intervalHours,
            },
          ]),
          error: null,
        },
      });
      mockCreateAdminClient.mockReturnValue(supabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(body.status).toBe("degraded");
    });

    it("last_success_at > 4x interval ago -> 'down'", async () => {
      const intervalHours = 6;
      const supabase = createMockSupabase({
        data_sources: {
          data: makeDataSources([{ slug: "very-stale-adapter", sync_interval_hours: intervalHours }]),
          error: null,
        },
        pipeline_health: {
          data: makePipelineHealth([
            {
              source_slug: "very-stale-adapter",
              consecutive_failures: 0,
              // 4.5x interval -> down
              last_success_at: syncedAgo(4.5, intervalHours),
              expected_interval_hours: intervalHours,
            },
          ]),
          error: null,
        },
      });
      mockCreateAdminClient.mockReturnValue(supabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(body.status).toBe("down");
    });

    it("worst-wins: 2 failures + 3x staleness -> 'degraded' (staleness triggers degraded, failure also degraded)", async () => {
      const intervalHours = 6;
      const supabase = createMockSupabase({
        data_sources: {
          data: makeDataSources([{ slug: "mixed-adapter", sync_interval_hours: intervalHours }]),
          error: null,
        },
        pipeline_health: {
          data: makePipelineHealth([
            {
              source_slug: "mixed-adapter",
              consecutive_failures: 2, // 1-2 -> degraded
              last_success_at: syncedAgo(3, intervalHours), // 3x > 2x -> degraded (not > 4x so not down)
              expected_interval_hours: intervalHours,
            },
          ]),
          error: null,
        },
      });
      mockCreateAdminClient.mockReturnValue(supabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(body.status).toBe("degraded");
    });
  });

  // -------------------------------------------------------------------------
  // 5. Error handling
  // -------------------------------------------------------------------------
  describe("error handling", () => {
    it("DB query error returns 500", async () => {
      // Simulate createAdminClient throwing
      mockCreateAdminClient.mockImplementation(() => {
        throw new Error("DB connection failed");
      });

      const response = await GET(makeRequest() as never);

      expect(response.status).toBe(500);
    });

    it("data_sources query error returns 500", async () => {
      const supabase = createMockSupabase({
        data_sources: { data: null, error: { message: "permission denied" } },
        pipeline_health: { data: [], error: null },
      });
      // Override so data_sources query throws when error is present
      const throwingSupabase = {
        from: (table: string) => {
          if (table === "data_sources") {
            throw new Error("DB query failed: data_sources");
          }
          return supabase.from(table);
        },
      };
      mockCreateAdminClient.mockReturnValue(throwingSupabase as ReturnType<typeof createAdminClient>);

      const response = await GET(makeRequest() as never);

      expect(response.status).toBe(500);
    });
  });
});
