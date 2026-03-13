/**
 * Tests for /api/health route
 *
 * Covers:
 *  - Public GET: returns 200 with { status, version, timestamp }
 *  - Authenticated GET (Bearer CRON_SECRET): returns full detail with DB, uptime, cron, pipeline
 *  - DB unreachable: returns 503 with { status: "unhealthy", version, timestamp, error }
 *  - Wrong token: treated as unauthenticated (public response)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Must mock @sentry/nextjs before importing the route (handleApiError imports it)
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Mock @/lib/logging
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

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

type MockRow = Record<string, unknown>;

interface TableMock {
  data: MockRow[] | null;
  error: { message: string } | null;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "../route";

const mockCreateAdminClient = vi.mocked(createAdminClient);

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new Request("http://localhost/api/health", { headers });
}

const NOW = new Date("2026-03-12T00:00:00.000Z").getTime();

function syncedAgo(multiplier: number, intervalHours: number): string {
  return new Date(NOW - multiplier * intervalHours * 60 * 60 * 1000).toISOString();
}

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

// Mock supabase with DB ping (for SELECT 1) + data_sources + pipeline_health tables
function createFullMockSupabase(
  tables: Record<string, TableMock>,
  dbPingResult?: { data: unknown; error: null | { message: string } }
) {
  const pingResult = dbPingResult ?? { data: [{ "?column?": 1 }], error: null };
  return {
    from: (table: string) => {
      const result = tables[table] ?? { data: [], error: null };
      let currentData = Array.isArray(result.data) ? [...result.data] : result.data;
      const chain = {
        select: () => chain,
        limit: (_value?: number) => chain,
        order: (_column?: string, _options?: unknown) => chain,
        gte: (column: string, value: unknown) => {
          if (Array.isArray(currentData)) {
            currentData = currentData.filter((row) => {
              const current = row[column];
              return typeof current === "string" && typeof value === "string"
                ? current >= value
                : true;
            });
          }
          return chain;
        },
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
    rpc: (_fn: string) => {
      const chain = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              return (resolve: (v: unknown) => void) => resolve(pingResult);
            }
            return (..._args: unknown[]) => chain;
          },
        }
      );
      return chain;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // 1. Public response (no auth)
  // -------------------------------------------------------------------------
  describe("public response (no Authorization header)", () => {
    it("returns 200 with status, version, timestamp", async () => {
      mockCreateAdminClient.mockReturnValue(
        createFullMockSupabase({
          data_sources: { data: makeDataSources([{ slug: "a1", last_sync_at: syncedAgo(0.5, 6) }]), error: null },
          pipeline_health: { data: makePipelineHealth([{ source_slug: "a1", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6), expected_interval_hours: 6 }]), error: null },
        }) as ReturnType<typeof createAdminClient>
      );

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("version");
      expect(body).toHaveProperty("timestamp");
    });

    it("does NOT include database, uptime, cron, or pipeline fields in public response", async () => {
      mockCreateAdminClient.mockReturnValue(
        createFullMockSupabase({
          data_sources: { data: makeDataSources([{ slug: "a1" }]), error: null },
          pipeline_health: { data: makePipelineHealth([{ source_slug: "a1", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6) }]), error: null },
        }) as ReturnType<typeof createAdminClient>
      );

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(body).not.toHaveProperty("database");
      expect(body).not.toHaveProperty("uptime");
      expect(body).not.toHaveProperty("cron");
      expect(body).not.toHaveProperty("pipeline");
    });

    it("status is 'healthy' when all adapters healthy", async () => {
      mockCreateAdminClient.mockReturnValue(
        createFullMockSupabase({
          data_sources: { data: makeDataSources([{ slug: "a1", last_sync_at: syncedAgo(0.5, 6) }]), error: null },
          pipeline_health: { data: makePipelineHealth([{ source_slug: "a1", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6), expected_interval_hours: 6 }]), error: null },
        }) as ReturnType<typeof createAdminClient>
      );

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(body.status).toBe("healthy");
    });

    it("status is 'degraded' when adapter has failures", async () => {
      mockCreateAdminClient.mockReturnValue(
        createFullMockSupabase({
          data_sources: { data: makeDataSources([{ slug: "a1" }]), error: null },
          pipeline_health: { data: makePipelineHealth([{ source_slug: "a1", consecutive_failures: 1, last_success_at: syncedAgo(1, 6), expected_interval_hours: 6 }]), error: null },
        }) as ReturnType<typeof createAdminClient>
      );

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      // Degraded pipeline -> "degraded" overall, still 200
      expect(response.status).toBe(200);
      expect(body.status).toBe("degraded");
    });

    it("ignores disabled data sources in health aggregation", async () => {
      mockCreateAdminClient.mockReturnValue(
        createFullMockSupabase({
          data_sources: {
            data: makeDataSources([
              {
                slug: "healthy-source",
                is_enabled: true,
                last_success_at: syncedAgo(0.5, 6),
                last_sync_at: syncedAgo(0.5, 6),
              },
            ]),
            error: null,
          },
          pipeline_health: {
            data: makePipelineHealth([
              { source_slug: "healthy-source", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6), expected_interval_hours: 6 },
              { source_slug: "disabled-source", consecutive_failures: 5, last_success_at: null, expected_interval_hours: 6 },
            ]),
            error: null,
          },
        }) as ReturnType<typeof createAdminClient>
      );

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("healthy");
    });

    it("uses data_sources fallback timestamps when pipeline_health row is missing", async () => {
      mockCreateAdminClient.mockReturnValue(
        createFullMockSupabase({
          data_sources: {
            data: makeDataSources([
              {
                slug: "recent-source",
                last_success_at: syncedAgo(0.5, 6),
                last_sync_at: syncedAgo(0.5, 6),
              },
            ]),
            error: null,
          },
          pipeline_health: { data: [], error: null },
        }) as ReturnType<typeof createAdminClient>
      );

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("healthy");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Authenticated response (Bearer CRON_SECRET)
  // -------------------------------------------------------------------------
  describe("authenticated response (Bearer CRON_SECRET)", () => {
    it("returns 200 with full detail including database, uptime, cron, pipeline", async () => {
      const originalSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = "test-secret";
      delete process.env.CRON_RUNNER_MODE;

      mockCreateAdminClient.mockReturnValue(
        createFullMockSupabase({
          data_sources: { data: makeDataSources([{ slug: "a1", last_sync_at: syncedAgo(0.5, 6), last_sync_records: 100 }]), error: null },
          pipeline_health: { data: makePipelineHealth([{ source_slug: "a1", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6), expected_interval_hours: 6 }]), error: null },
          cron_runs: {
            data: [
              {
                job_name: "sync-tier-1",
                status: "completed",
                started_at: "2026-03-11T23:45:00.000Z",
                created_at: "2026-03-11T23:45:00.000Z",
              },
            ],
            error: null,
          },
        }) as ReturnType<typeof createAdminClient>
      );

      const response = await GET(makeRequest("Bearer test-secret") as never);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("version");
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("uptime");
      expect(body).toHaveProperty("database");
      expect(body).toHaveProperty("cron");
      expect(body).toHaveProperty("pipeline");

      expect(typeof body.uptime).toBe("number");
      expect(body.database).toHaveProperty("connected");
      expect(body.database).toHaveProperty("latencyMs");
      expect(body.cron).toHaveProperty("mode", "external");
      expect(body.cron).toHaveProperty("schedulerConfigured", true);
      expect(body.cron).toHaveProperty("runningJobs", 0);
      expect(body.cron).toHaveProperty("recentFailures24h", 0);
      expect(body.cron).toHaveProperty("lastRunAt", "2026-03-11T23:45:00.000Z");
      expect(body.pipeline).toHaveProperty("healthy");
      expect(body.pipeline).toHaveProperty("degraded");
      expect(body.pipeline).toHaveProperty("down");

      process.env.CRON_SECRET = originalSecret;
    });

    it("pipeline counts correct: 1 healthy, 1 degraded adapter", async () => {
      const originalSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = "test-secret";

      mockCreateAdminClient.mockReturnValue(
        createFullMockSupabase({
          data_sources: { data: makeDataSources([
            { slug: "a1" },
            { slug: "a2" },
          ]), error: null },
          pipeline_health: { data: makePipelineHealth([
            { source_slug: "a1", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6), expected_interval_hours: 6 },
            { source_slug: "a2", consecutive_failures: 1, last_success_at: syncedAgo(1, 6), expected_interval_hours: 6 },
          ]), error: null },
        }) as ReturnType<typeof createAdminClient>
      );

      const response = await GET(makeRequest("Bearer test-secret") as never);
      const body = await response.json();

      expect(body.pipeline.healthy).toBe(1);
      expect(body.pipeline.degraded).toBe(1);
      expect(body.pipeline.down).toBe(0);

      process.env.CRON_SECRET = originalSecret;
    });

    it("wrong Bearer token returns public response (no detail fields)", async () => {
      const originalSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = "real-secret";

      mockCreateAdminClient.mockReturnValue(
        createFullMockSupabase({
          data_sources: { data: makeDataSources([{ slug: "a1" }]), error: null },
          pipeline_health: { data: makePipelineHealth([{ source_slug: "a1", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6) }]), error: null },
        }) as ReturnType<typeof createAdminClient>
      );

      const response = await GET(makeRequest("Bearer wrong-token") as never);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).not.toHaveProperty("database");
      expect(body).not.toHaveProperty("uptime");

      process.env.CRON_SECRET = originalSecret;
    });
  });

  // -------------------------------------------------------------------------
  // 3. DB failure -> 503 with unhealthy status
  // -------------------------------------------------------------------------
  describe("database failure handling", () => {
    it("returns 503 with unhealthy status when DB is unreachable (createAdminClient throws)", async () => {
      mockCreateAdminClient.mockImplementation(() => {
        throw new Error("DB connection refused");
      });

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toHaveProperty("status", "unhealthy");
      expect(body).toHaveProperty("version");
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("error");
    });

    it("reports internal cron mode and recent failures from cron_runs", async () => {
      const originalSecret = process.env.CRON_SECRET;
      const originalMode = process.env.CRON_RUNNER_MODE;
      process.env.CRON_SECRET = "test-secret";
      process.env.CRON_RUNNER_MODE = "internal";

      mockCreateAdminClient.mockReturnValue(
        createFullMockSupabase({
          data_sources: { data: makeDataSources([{ slug: "a1" }]), error: null },
          pipeline_health: { data: makePipelineHealth([{ source_slug: "a1", consecutive_failures: 0, last_success_at: syncedAgo(0.5, 6) }]), error: null },
          cron_runs: {
            data: [
              {
                job_name: "sync-tier-1",
                status: "running",
                started_at: "2026-03-12T00:30:00.000Z",
                created_at: "2026-03-12T00:30:00.000Z",
              },
              {
                job_name: "compute-scores",
                status: "failed",
                started_at: "2026-03-11T10:00:00.000Z",
                created_at: "2026-03-11T10:00:00.000Z",
              },
            ],
            error: null,
          },
        }) as ReturnType<typeof createAdminClient>
      );

      const response = await GET(makeRequest("Bearer test-secret") as never);
      const body = await response.json();

      expect(body.cron.mode).toBe("internal");
      expect(body.cron.schedulerConfigured).toBe(true);
      expect(body.cron.runningJobs).toBe(1);
      expect(body.cron.recentFailures24h).toBe(1);
      expect(body.cron.lastRunAt).toBe("2026-03-12T00:30:00.000Z");

      process.env.CRON_SECRET = originalSecret;
      process.env.CRON_RUNNER_MODE = originalMode;
    });

    it("returns 503 with status 'unhealthy' when authenticated but DB fails", async () => {
      const originalSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = "test-secret";

      mockCreateAdminClient.mockImplementation(() => {
        throw new Error("DB connection refused");
      });

      const response = await GET(makeRequest("Bearer test-secret") as never);
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.status).toBe("unhealthy");

      process.env.CRON_SECRET = originalSecret;
    });
  });

  // -------------------------------------------------------------------------
  // 4. Version field
  // -------------------------------------------------------------------------
  describe("version field", () => {
    it("version is a non-empty string", async () => {
      mockCreateAdminClient.mockReturnValue(
        createFullMockSupabase({
          data_sources: { data: [], error: null },
          pipeline_health: { data: [], error: null },
        }) as ReturnType<typeof createAdminClient>
      );

      const response = await GET(makeRequest() as never);
      const body = await response.json();

      expect(typeof body.version).toBe("string");
      expect(body.version.length).toBeGreaterThan(0);
    });
  });
});
