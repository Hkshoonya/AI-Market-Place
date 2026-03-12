/**
 * Tests for GET /api/admin/pipeline/health
 *
 * Covers:
 * - No auth => 401
 * - Non-admin => 403
 * - Admin session => 200 with full PipelineHealthDetailSchema (includes adapters array)
 * - Response shape: status, healthy, degraded, down, checkedAt, adapters
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock Sentry ───────────────────────────────────────────────────────────────
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// ── Mock logging ──────────────────────────────────────────────────────────────
vi.mock("@/lib/logging", () => ({
  systemLog: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  createTaggedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// ── Mock rate-limit (always allow in tests) ────────────────────────────────────
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 60, remaining: 59, reset: 60 })),
  RATE_LIMITS: { public: { limit: 60, windowMs: 60_000 } },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

// ── Mock createClient (session auth) ──────────────────────────────────────────
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// ── Mock createAdminClient (data queries) ─────────────────────────────────────
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);

// Fixed "now" for deterministic staleness calculations
const NOW = new Date("2026-03-12T00:00:00.000Z").getTime();

function syncedAgo(multiplier: number, intervalHours = 6): string {
  return new Date(NOW - multiplier * intervalHours * 60 * 60 * 1000).toISOString();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/admin/pipeline/health");
}

type MockRow = Record<string, unknown>;

interface TableMock {
  data: MockRow[] | null;
  error: { message: string } | null;
}

function createMockAdminSupabase(tables: Record<string, TableMock>) {
  return {
    from: (table: string) => {
      const result = tables[table] ?? { data: [], error: null };
      const chain = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              return (resolve: (v: unknown) => void) => resolve(result);
            }
            return (..._args: unknown[]) => chain;
          },
        }
      );
      return chain;
    },
  };
}

function createMockSessionClient(options: {
  user: { id: string } | null;
  isAdmin: boolean;
}) {
  const profileResult = options.user
    ? { data: { is_admin: options.isAdmin }, error: null }
    : null;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user },
      }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve(profileResult ?? { data: null, error: null }),
            }),
          }),
        };
      }
      return {};
    },
  };
}

const DEFAULT_DATA_SOURCES = [
  {
    slug: "adapter-a",
    last_sync_at: syncedAgo(0.5),
    last_sync_records: 100,
    last_error_message: null,
    sync_interval_hours: 6,
  },
  {
    slug: "adapter-b",
    last_sync_at: syncedAgo(1),
    last_sync_records: 50,
    last_error_message: null,
    sync_interval_hours: 6,
  },
];

const DEFAULT_PIPELINE_HEALTH = [
  {
    source_slug: "adapter-a",
    consecutive_failures: 0,
    last_success_at: syncedAgo(0.5),
    expected_interval_hours: 6,
  },
  {
    source_slug: "adapter-b",
    consecutive_failures: 1,
    last_success_at: syncedAgo(1),
    expected_interval_hours: 6,
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/admin/pipeline/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 when not authenticated", async () => {
    const sessionClient = createMockSessionClient({ user: null, isAdmin: false });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it("returns 403 for authenticated non-admin user", async () => {
    const sessionClient = createMockSessionClient({
      user: { id: "user-123" },
      isAdmin: false,
    });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    const adminClient = createMockAdminSupabase({
      data_sources: { data: DEFAULT_DATA_SOURCES, error: null },
      pipeline_health: { data: DEFAULT_PIPELINE_HEALTH, error: null },
    });
    mockCreateAdminClient.mockReturnValue(
      adminClient as ReturnType<typeof createAdminClient>
    );

    const response = await GET(makeRequest());
    expect(response.status).toBe(403);
  });

  it("returns 200 with full adapter detail for admin user", async () => {
    const sessionClient = createMockSessionClient({
      user: { id: "admin-123" },
      isAdmin: true,
    });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    const adminClient = createMockAdminSupabase({
      data_sources: { data: DEFAULT_DATA_SOURCES, error: null },
      pipeline_health: { data: DEFAULT_PIPELINE_HEALTH, error: null },
    });
    mockCreateAdminClient.mockReturnValue(
      adminClient as ReturnType<typeof createAdminClient>
    );

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("adapters");
    expect(Array.isArray(body.adapters)).toBe(true);
    expect(body.adapters.length).toBeGreaterThan(0);
  });

  it("response matches PipelineHealthDetailSchema shape", async () => {
    const sessionClient = createMockSessionClient({
      user: { id: "admin-123" },
      isAdmin: true,
    });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    const adminClient = createMockAdminSupabase({
      data_sources: { data: DEFAULT_DATA_SOURCES, error: null },
      pipeline_health: { data: DEFAULT_PIPELINE_HEALTH, error: null },
    });
    mockCreateAdminClient.mockReturnValue(
      adminClient as ReturnType<typeof createAdminClient>
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    // Top-level fields
    expect(body).toHaveProperty("status");
    expect(["healthy", "degraded", "down"]).toContain(body.status);
    expect(body).toHaveProperty("healthy");
    expect(typeof body.healthy).toBe("number");
    expect(body).toHaveProperty("degraded");
    expect(typeof body.degraded).toBe("number");
    expect(body).toHaveProperty("down");
    expect(typeof body.down).toBe("number");
    expect(body).toHaveProperty("checkedAt");
    expect(typeof body.checkedAt).toBe("string");

    // Adapter fields
    const adapter = body.adapters[0];
    expect(adapter).toHaveProperty("slug");
    expect(adapter).toHaveProperty("status");
    expect(["healthy", "degraded", "down"]).toContain(adapter.status);
    expect(adapter).toHaveProperty("lastSync");
    expect(adapter).toHaveProperty("consecutiveFailures");
    expect(typeof adapter.consecutiveFailures).toBe("number");
    expect(adapter).toHaveProperty("recordCount");
    expect(typeof adapter.recordCount).toBe("number");
    expect(adapter).toHaveProperty("error");
  });

  it("adapter with 1 failure is 'degraded' in response", async () => {
    const sessionClient = createMockSessionClient({
      user: { id: "admin-123" },
      isAdmin: true,
    });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    const adminClient = createMockAdminSupabase({
      data_sources: {
        data: [
          {
            slug: "failing-adapter",
            last_sync_at: syncedAgo(1),
            last_sync_records: 0,
            last_error_message: "API error",
            sync_interval_hours: 6,
          },
        ],
        error: null,
      },
      pipeline_health: {
        data: [
          {
            source_slug: "failing-adapter",
            consecutive_failures: 1,
            last_success_at: syncedAgo(1),
            expected_interval_hours: 6,
          },
        ],
        error: null,
      },
    });
    mockCreateAdminClient.mockReturnValue(
      adminClient as ReturnType<typeof createAdminClient>
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.status).toBe("degraded");
    expect(body.adapters[0].status).toBe("degraded");
    expect(body.adapters[0].error).toBe("API error");
  });

  it("adapter never synced (no pipeline_health row) is 'down'", async () => {
    const sessionClient = createMockSessionClient({
      user: { id: "admin-123" },
      isAdmin: true,
    });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    const adminClient = createMockAdminSupabase({
      data_sources: {
        data: [
          {
            slug: "new-adapter",
            last_sync_at: null,
            last_sync_records: 0,
            last_error_message: null,
            sync_interval_hours: 6,
          },
        ],
        error: null,
      },
      pipeline_health: { data: [], error: null }, // no row
    });
    mockCreateAdminClient.mockReturnValue(
      adminClient as ReturnType<typeof createAdminClient>
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.status).toBe("down");
    expect(body.down).toBe(1);
    expect(body.adapters[0].status).toBe("down");
  });
});
