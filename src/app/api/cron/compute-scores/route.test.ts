import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockFetchInputs = vi.fn();
const mockComputeAllLenses = vi.fn();
const mockPersistResults = vi.fn();
const mockTrackCronRun = vi.fn();
const mockCreateClient = vi.fn();
const mockLogError = vi.fn();
const mockTrackerComplete = vi.fn();
const mockTrackerFail = vi.fn();
const mockTrackerSkip = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock("@/lib/compute-scores/fetch-inputs", () => ({
  fetchInputs: (...args: unknown[]) => mockFetchInputs(...args),
}));

vi.mock("@/lib/compute-scores/compute-all-lenses", () => ({
  computeAllLenses: (...args: unknown[]) => mockComputeAllLenses(...args),
}));

vi.mock("@/lib/compute-scores/persist-results", () => ({
  persistResults: (...args: unknown[]) => mockPersistResults(...args),
}));

vi.mock("@/lib/cron-tracker", () => ({
  trackCronRun: (...args: unknown[]) => mockTrackCronRun(...args),
}));

vi.mock("@/lib/logging", () => ({
  createTaggedLogger: () => ({
    error: (...args: unknown[]) => mockLogError(...args),
  }),
}));

function makeRequest(authorized = true) {
  return new NextRequest("https://example.com/api/cron/compute-scores", {
    headers: authorized ? { authorization: "Bearer test-cron-secret" } : {},
  });
}

describe("GET /api/cron/compute-scores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

    mockCreateClient.mockReturnValue({ from: vi.fn() });
    mockTrackCronRun.mockResolvedValue({
      complete: (...args: unknown[]) => mockTrackerComplete(...args),
      fail: (...args: unknown[]) => mockTrackerFail(...args),
      skip: (...args: unknown[]) => mockTrackerSkip(...args),
      runId: "run-1",
      shouldSkip: false,
    });
    mockTrackerComplete.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    mockTrackerFail.mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), { status: 500 })
    );
    mockTrackerSkip.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, skipped: true }), { status: 202 })
    );

    mockFetchInputs.mockResolvedValue({
      models: [{ id: "m1" }],
    });
    mockComputeAllLenses.mockResolvedValue({
      scoredModels: [{ id: "m1", category: "llm", qualityScore: 80 }],
      capabilityScoreMap: new Map([["m1", 82]]),
      balancedRankings: [{ id: "m1", balanced_rank: 1, category_balanced_rank: 1 }],
      balancedRankMap: new Map([["m1", { overall: 1, category: 1 }]]),
      normalizedValueMap: new Map([["m1", 70]]),
      agentScoreMap: new Map([["m1", 12]]),
      agentRankMap: new Map([["m1", 1]]),
      popularityMap: new Map([["m1", 55]]),
      popRankMap: new Map([["m1", 1]]),
      adoptionScoreMap: new Map([["m1", 61]]),
      adoptionRankMap: new Map([["m1", 1]]),
      economicFootprintMap: new Map([["m1", 74]]),
      economicFootprintRankMap: new Map([["m1", 1]]),
      marketCapMap: new Map([["m1", 1_000_000]]),
      cheapestPriceMap: new Map([["m1", 5]]),
      capRankMap: new Map([["m1", 1]]),
      usageRankMap: new Map([["m1", 1]]),
      usageScoreMap: new Map([["m1", 58]]),
      expertRankMap: new Map([["m1", 1]]),
      expertScoreMap: new Map([["m1", 63]]),
      valueRankMap: new Map([["m1", 1]]),
      pricingSynced: 1,
      pricingSourceMap: new Map([["m1", new Set(["openrouter"])]]),
      stats: {},
    });
    mockPersistResults.mockResolvedValue({
      updated: 1,
      errors: 0,
      snapshotsCreated: 1,
      snapshotErrors: 0,
    });
  });

  it("returns 401 when authorization is missing", async () => {
    const { GET } = await import("./route");
    const response = await GET(makeRequest(false));

    expect(response.status).toBe(401);
  });

  it("completes successfully when persistence is clean", async () => {
    const { GET } = await import("./route");
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(mockTrackCronRun).toHaveBeenCalledWith("compute-scores", {
      staleAfterMs: 10 * 60 * 1000,
    });
    expect(mockTrackerComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        totalModels: 1,
        updated: 1,
        errors: 0,
        snapshotsCreated: 1,
        snapshotErrors: 0,
      })
    );
    expect(mockTrackerFail).not.toHaveBeenCalled();
  });

  it("fails the cron run when model updates are incomplete", async () => {
    mockPersistResults.mockResolvedValueOnce({
      updated: 1,
      errors: 2,
      snapshotsCreated: 1,
      snapshotErrors: 0,
    });

    const { GET } = await import("./route");
    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(mockTrackerFail).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Score persistence incomplete"),
      })
    );
    expect(mockTrackerComplete).not.toHaveBeenCalled();
  });

  it("fails the cron run when snapshot persistence is incomplete", async () => {
    mockPersistResults.mockResolvedValueOnce({
      updated: 1,
      errors: 0,
      snapshotsCreated: 0,
      snapshotErrors: 1,
    });

    const { GET } = await import("./route");
    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(mockTrackerFail).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("snapshot errors"),
      })
    );
    expect(mockTrackerComplete).not.toHaveBeenCalled();
  });
});
