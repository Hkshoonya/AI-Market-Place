/**
 * Tests for GET /api/admin/data-integrity
 *
 * Covers:
 * - No auth => 401
 * - Non-admin => 403
 * - Admin session => 200 with DataIntegrityReport shape
 * - Response includes: summary, qualityScores, tableCoverage, freshness
 * - Rate limiting applied
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
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

// ── Mock rate-limit (always allow) ─────────────────────────────────────────────
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

// ── Mock verifyDataIntegrity ──────────────────────────────────────────────────
vi.mock("@/lib/data-integrity", () => ({
  verifyDataIntegrity: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyDataIntegrity } from "@/lib/data-integrity";
import { rateLimit } from "@/lib/rate-limit";
import { GET } from "./route";

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockVerifyDataIntegrity = vi.mocked(verifyDataIntegrity);
const mockRateLimit = vi.mocked(rateLimit);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_REPORT = {
  checkedAt: "2026-03-12T12:00:00.000Z",
  summary: {
    totalSources: 2,
    healthySources: 1,
    staleSources: 1,
    warningSources: 1,
    lowMatchSources: 1,
    emptyTables: 0,
    averageQualityScore: 75,
  },
  qualityScores: [
    {
      slug: "openrouter-models",
      name: "OpenRouter Models",
      qualityScore: 85,
      completeness: 1.0,
      freshness: 0.9,
      trend: 1.0,
      matchRate: null,
      warningCount: 0,
      optionalSkipCount: 0,
      knownCatalogGapCount: 0,
      unmatchedModelCount: 0,
      lastSyncStatus: "success",
      diagnosticPenalty: 0,
      issueSummary: null,
      recordCount: 400,
      lastSyncAt: "2026-03-12T10:00:00.000Z",
      syncIntervalHours: 6,
      staleSince: null,
      isStale: false,
    },
    {
      slug: "chatbot-arena",
      name: "Chatbot Arena",
      qualityScore: 65,
      completeness: 0.8,
      freshness: 0.5,
      trend: 0.9,
      matchRate: 14.2,
      warningCount: 1,
      optionalSkipCount: 0,
      knownCatalogGapCount: 0,
      unmatchedModelCount: 1,
      lastSyncStatus: "partial",
      diagnosticPenalty: 18,
      issueSummary: "Low match rate: 14.2%",
      recordCount: 16,
      lastSyncAt: "2026-03-11T00:00:00.000Z",
      syncIntervalHours: 12,
      staleSince: "2026-03-11T12:00:00.000Z",
      isStale: true,
    },
  ],
  tableCoverage: [
    {
      table: "models",
      rowCount: 400,
      isEmpty: false,
      responsibleAdapters: ["openrouter-models"],
    },
    {
      table: "elo_ratings",
      rowCount: 16,
      isEmpty: false,
      responsibleAdapters: ["chatbot-arena"],
    },
  ],
  freshness: {
    staleSourceCount: 1,
    staleSources: [
      {
        slug: "chatbot-arena",
        name: "Chatbot Arena",
        lastSyncAt: "2026-03-11T00:00:00.000Z",
        expectedIntervalHours: 12,
        overdueBy: "24h",
      },
    ],
  },
  modelEvidence: {
    totalModels: 20,
    lowBiasRiskModels: 8,
    mediumBiasRiskModels: 7,
    highBiasRiskModels: 5,
    corroboratedModels: 12,
    averageIndependentQualitySources: 2.1,
    averageDistinctSources: 4.6,
  },
  benchmarkMetadata: {
    benchmarkExpectedModels: 14,
    withTrustedHfLocator: 6,
    withTrustedWebsiteLocator: 4,
    withAnyTrustedBenchmarkLocator: 10,
    missingTrustedBenchmarkLocatorCount: 4,
    trustedLocatorCoveragePct: 71.4,
    missingTrustedBenchmarkLocator: [
      {
        slug: "x-ai-grok-next",
        provider: "xAI",
        category: "llm",
        releaseDate: "2026-03-01",
      },
    ],
  },
  publicMetadata: {
    activeModels: 20,
    completeDiscoveryMetadataCount: 16,
    completeDiscoveryMetadataPct: 80,
    defaultPublicSurfaceReadyCount: 14,
    defaultPublicSurfaceReadyPct: 70,
    topReadinessBlockers: [{ reason: "missing_release_date", count: 3 }],
    missingCategoryCount: 2,
    missingReleaseDateCount: 3,
    openWeightsMissingLicenseCount: 1,
    llmMissingContextWindowCount: 2,
    official: {
      activeModels: 10,
      completeDiscoveryMetadataCount: 9,
      completeDiscoveryMetadataPct: 90,
      defaultPublicSurfaceReadyCount: 8,
      defaultPublicSurfaceReadyPct: 80,
      topReadinessBlockers: [{ reason: "missing_release_date", count: 1 }],
      missingCategoryCount: 0,
      missingReleaseDateCount: 1,
      openWeightsMissingLicenseCount: 0,
      llmMissingContextWindowCount: 1,
      providers: [
        {
          provider: "xAI",
          total: 2,
          complete: 1,
          ready: 1,
          complete_pct: 50,
          ready_pct: 50,
          missingCategoryCount: 0,
          missingReleaseDateCount: 1,
          releaseDateExemptAliasCount: 0,
        },
      ],
      recentIncompleteModels: [
        {
          slug: "x-ai-grok-next",
          provider: "xAI",
          category: "llm",
          releaseDate: "2026-03-01",
        },
      ],
      recentNotReadyModels: [
        {
          slug: "x-ai-grok-next",
          provider: "xAI",
          category: "llm",
          releaseDate: "2026-03-01",
          reasons: ["missing_release_date"],
        },
      ],
    },
    providers: [
      {
        provider: "xAI",
        total: 2,
        complete: 1,
        ready: 1,
        complete_pct: 50,
        ready_pct: 50,
        missingCategoryCount: 0,
        missingReleaseDateCount: 1,
        releaseDateExemptAliasCount: 0,
      },
    ],
    recentIncompleteModels: [
      {
        slug: "x-ai-grok-next",
        provider: "xAI",
        category: "llm",
        releaseDate: "2026-03-01",
      },
    ],
    recentNotReadyModels: [
      {
        slug: "x-ai-grok-next",
        provider: "xAI",
        category: "llm",
        releaseDate: "2026-03-01",
        reasons: ["missing_release_date"],
      },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/admin/data-integrity");
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
              single: () =>
                Promise.resolve(profileResult ?? { data: null, error: null }),
            }),
          }),
        };
      }
      return {};
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/admin/data-integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockReturnValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 60,
    });
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

    const response = await GET(makeRequest());
    expect(response.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockReturnValue({
      success: false,
      limit: 60,
      remaining: 0,
      reset: 60,
    });

    // Still need session mock even though rate limit is hit first
    const sessionClient = createMockSessionClient({ user: null, isAdmin: false });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    const response = await GET(makeRequest());
    expect(response.status).toBe(429);
  });

  it("returns 200 with DataIntegrityReport for admin user", async () => {
    const sessionClient = createMockSessionClient({
      user: { id: "admin-123" },
      isAdmin: true,
    });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    const adminClient = {} as ReturnType<typeof createAdminClient>;
    mockCreateAdminClient.mockReturnValue(adminClient);
    mockVerifyDataIntegrity.mockResolvedValue(SAMPLE_REPORT);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
  });

  it("response includes summary with required fields", async () => {
    const sessionClient = createMockSessionClient({
      user: { id: "admin-123" },
      isAdmin: true,
    });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    mockCreateAdminClient.mockReturnValue(
      {} as ReturnType<typeof createAdminClient>
    );
    mockVerifyDataIntegrity.mockResolvedValue(SAMPLE_REPORT);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body).toHaveProperty("summary");
    expect(body.summary).toHaveProperty("totalSources");
    expect(body.summary).toHaveProperty("staleSources");
    expect(body.summary).toHaveProperty("emptyTables");
    expect(body.summary).toHaveProperty("averageQualityScore");
  });

  it("response includes qualityScores with correct shape", async () => {
    const sessionClient = createMockSessionClient({
      user: { id: "admin-123" },
      isAdmin: true,
    });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    mockCreateAdminClient.mockReturnValue(
      {} as ReturnType<typeof createAdminClient>
    );
    mockVerifyDataIntegrity.mockResolvedValue(SAMPLE_REPORT);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body).toHaveProperty("qualityScores");
    expect(Array.isArray(body.qualityScores)).toBe(true);

    const score = body.qualityScores[0];
    expect(score).toHaveProperty("slug");
    expect(score).toHaveProperty("qualityScore");
    expect(score).toHaveProperty("completeness");
    expect(score).toHaveProperty("freshness");
    expect(score).toHaveProperty("trend");
    expect(typeof score.qualityScore).toBe("number");
    expect(score.qualityScore).toBeGreaterThanOrEqual(0);
    expect(score.qualityScore).toBeLessThanOrEqual(100);
  });

  it("response includes tableCoverage with correct shape", async () => {
    const sessionClient = createMockSessionClient({
      user: { id: "admin-123" },
      isAdmin: true,
    });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    mockCreateAdminClient.mockReturnValue(
      {} as ReturnType<typeof createAdminClient>
    );
    mockVerifyDataIntegrity.mockResolvedValue(SAMPLE_REPORT);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body).toHaveProperty("tableCoverage");
    expect(Array.isArray(body.tableCoverage)).toBe(true);

    const coverage = body.tableCoverage[0];
    expect(coverage).toHaveProperty("table");
    expect(coverage).toHaveProperty("rowCount");
    expect(coverage).toHaveProperty("isEmpty");
    expect(coverage).toHaveProperty("responsibleAdapters");
    expect(Array.isArray(coverage.responsibleAdapters)).toBe(true);
  });

  it("response includes freshness report with staleSources", async () => {
    const sessionClient = createMockSessionClient({
      user: { id: "admin-123" },
      isAdmin: true,
    });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    mockCreateAdminClient.mockReturnValue(
      {} as ReturnType<typeof createAdminClient>
    );
    mockVerifyDataIntegrity.mockResolvedValue(SAMPLE_REPORT);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body).toHaveProperty("freshness");
    expect(body.freshness).toHaveProperty("staleSourceCount");
    expect(body.freshness).toHaveProperty("staleSources");
    expect(Array.isArray(body.freshness.staleSources)).toBe(true);

    const stale = body.freshness.staleSources[0];
    expect(stale).toHaveProperty("slug");
    expect(stale).toHaveProperty("lastSyncAt");
    expect(stale).toHaveProperty("overdueBy");
  });

  it("response includes benchmark metadata coverage", async () => {
    const sessionClient = createMockSessionClient({
      user: { id: "admin-123" },
      isAdmin: true,
    });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    mockCreateAdminClient.mockReturnValue(
      {} as ReturnType<typeof createAdminClient>
    );
    mockVerifyDataIntegrity.mockResolvedValue(SAMPLE_REPORT);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body).toHaveProperty("benchmarkMetadata");
    expect(body.benchmarkMetadata).toHaveProperty("benchmarkExpectedModels");
    expect(body.benchmarkMetadata).toHaveProperty("withAnyTrustedBenchmarkLocator");
    expect(body.benchmarkMetadata).toHaveProperty("trustedLocatorCoveragePct");
    expect(body.benchmarkMetadata).toHaveProperty("missingTrustedBenchmarkLocator");
    expect(Array.isArray(body.benchmarkMetadata.missingTrustedBenchmarkLocator)).toBe(true);
  });

  it("response includes public metadata coverage", async () => {
    const sessionClient = createMockSessionClient({
      user: { id: "admin-123" },
      isAdmin: true,
    });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    mockCreateAdminClient.mockReturnValue(
      {} as ReturnType<typeof createAdminClient>
    );
    mockVerifyDataIntegrity.mockResolvedValue(SAMPLE_REPORT);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body).toHaveProperty("publicMetadata");
    expect(body.publicMetadata).toHaveProperty("completeDiscoveryMetadataPct");
    expect(body.publicMetadata).toHaveProperty("missingCategoryCount");
    expect(body.publicMetadata).toHaveProperty("missingReleaseDateCount");
    expect(body.publicMetadata).toHaveProperty("recentIncompleteModels");
    expect(Array.isArray(body.publicMetadata.recentIncompleteModels)).toBe(true);
  });

  it("calls verifyDataIntegrity with admin client", async () => {
    const sessionClient = createMockSessionClient({
      user: { id: "admin-123" },
      isAdmin: true,
    });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    const adminClient = { _id: "admin-client" } as unknown as ReturnType<
      typeof createAdminClient
    >;
    mockCreateAdminClient.mockReturnValue(adminClient);
    mockVerifyDataIntegrity.mockResolvedValue(SAMPLE_REPORT);

    await GET(makeRequest());

    expect(mockVerifyDataIntegrity).toHaveBeenCalledWith(adminClient);
  });

  it("returns 500 when verifyDataIntegrity throws", async () => {
    const sessionClient = createMockSessionClient({
      user: { id: "admin-123" },
      isAdmin: true,
    });
    mockCreateClient.mockResolvedValue(
      sessionClient as unknown as Awaited<ReturnType<typeof createClient>>
    );

    mockCreateAdminClient.mockReturnValue(
      {} as ReturnType<typeof createAdminClient>
    );
    mockVerifyDataIntegrity.mockRejectedValue(new Error("DB failure"));

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
  });
});
