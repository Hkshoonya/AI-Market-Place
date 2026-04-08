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

vi.mock("@/lib/public-metadata-coverage-compute", () => ({
  computePublicMetadataCoverage: vi.fn().mockResolvedValue({
    activeModels: 100,
    completeDiscoveryMetadataCount: 80,
    completeDiscoveryMetadataPct: 80,
    missingCategoryCount: 5,
    missingReleaseDateCount: 10,
    openWeightsMissingLicenseCount: 2,
    llmMissingContextWindowCount: 4,
    providers: [
      {
        provider: "ExampleAI",
        total: 10,
        complete: 6,
        complete_pct: 60,
        missingCategoryCount: 1,
        missingReleaseDateCount: 3,
      },
    ],
    recentIncompleteModels: [],
  }),
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
    is_enabled: true,
    quarantined_at: null,
    last_success_at: syncedAgo(0.5),
    last_sync_at: syncedAgo(0.5),
    last_sync_records: 100,
    last_error_message: null,
    sync_interval_hours: 6,
  },
  {
    slug: "adapter-b",
    is_enabled: true,
    quarantined_at: null,
    last_success_at: syncedAgo(1),
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
    expect(body).toHaveProperty("benchmarkCoverage");
    expect(body.benchmarkCoverage).toHaveProperty("trustedLocatorCoveragePct");
    expect(body.benchmarkCoverage).toHaveProperty("missingTrustedLocatorCount");
    expect(body.benchmarkCoverage).toHaveProperty("recentMissingTrustedLocators");
    expect(body).toHaveProperty("publicMetadataCoverage");
    expect(body.publicMetadataCoverage).toHaveProperty(
      "completeDiscoveryMetadataPct"
    );
    expect(body.publicMetadataCoverage).toHaveProperty(
      "missingReleaseDateCount"
    );
    expect(body.publicMetadataCoverage).toHaveProperty("weakestProviders");
    expect(body.publicMetadataCoverage).toHaveProperty("recentIncompleteModels");

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
            is_enabled: true,
            quarantined_at: null,
            last_success_at: syncedAgo(1),
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
            last_success_at: syncedAgo(1.5),
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

  it("sanitizes raw HTML from upstream adapter errors in admin detail", async () => {
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
            slug: "gaia-benchmark",
            is_enabled: true,
            quarantined_at: null,
            last_success_at: syncedAgo(1),
            last_sync_at: syncedAgo(1),
            last_sync_records: 170,
            last_error_message:
              "Failed to fetch GAIA public results: GAIA validation returned HTTP 429: <!DOCTYPE html><html><head><title>Too Many Requests</title></head><body>rate limited</body></html>",
            sync_interval_hours: 6,
          },
        ],
        error: null,
      },
      pipeline_health: {
        data: [
          {
            source_slug: "gaia-benchmark",
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

    expect(response.status).toBe(200);
    expect(body.adapters[0].error).toBe(
      "Failed to fetch GAIA public results: GAIA validation returned HTTP 429:"
    );
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
            is_enabled: true,
            quarantined_at: null,
            last_success_at: null,
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

  it("uses data_sources fallback timestamps when pipeline_health row is missing", async () => {
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
            slug: "recent-adapter",
            is_enabled: true,
            quarantined_at: null,
            last_success_at: syncedAgo(0.5),
            last_sync_at: syncedAgo(0.5),
            last_sync_records: 25,
            last_error_message: null,
            sync_interval_hours: 6,
          },
        ],
        error: null,
      },
      pipeline_health: { data: [], error: null },
    });
    mockCreateAdminClient.mockReturnValue(
      adminClient as ReturnType<typeof createAdminClient>
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.status).toBe("healthy");
    expect(body.healthy).toBe(1);
    expect(body.down).toBe(0);
    expect(body.adapters[0].status).toBe("healthy");
  });

  it("ignores disabled data sources in admin health detail", async () => {
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
            slug: "enabled-adapter",
            is_enabled: true,
            quarantined_at: null,
            last_success_at: syncedAgo(0.5),
            last_sync_at: syncedAgo(0.5),
            last_sync_records: 42,
            last_error_message: null,
            sync_interval_hours: 6,
          },
          {
            slug: "disabled-adapter",
            is_enabled: false,
            quarantined_at: null,
            last_success_at: syncedAgo(5),
            last_sync_at: syncedAgo(5),
            last_sync_records: 0,
            last_error_message: "upstream gone",
            sync_interval_hours: 6,
          },
        ],
        error: null,
      },
      pipeline_health: {
        data: [
          {
            source_slug: "enabled-adapter",
            consecutive_failures: 0,
            last_success_at: syncedAgo(0.5),
            expected_interval_hours: 6,
          },
          {
            source_slug: "disabled-adapter",
            consecutive_failures: 4,
            last_success_at: syncedAgo(5),
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

    expect(body.status).toBe("healthy");
    expect(body.adapters).toHaveLength(1);
    expect(body.adapters[0].slug).toBe("enabled-adapter");
  });
});
