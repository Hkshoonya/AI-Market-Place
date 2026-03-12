/**
 * Unit tests for cron sync route
 *
 * Covers:
 * 1. Authorized request with successful sync returns 200 with correct body shape
 * 2. Response body details[].errors contains actual error message strings (not count)
 * 3. Unauthorized request returns 401
 * 4. Invalid tier returns 400
 * 5. overallStatus is "partial" when any adapter failed, "success" when all succeeded
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock orchestrator ─────────────────────────────────────────────────────────

const mockRunTierSync = vi.fn();

vi.mock("@/lib/data-sources/orchestrator", () => ({
  runTierSync: (...args: unknown[]) => mockRunTierSync(...args),
}));

// ── Mock cron-tracker ─────────────────────────────────────────────────────────

const mockTrackerComplete = vi.fn();
const mockTrackerFail = vi.fn();
const mockTrackCronRun = vi.fn().mockResolvedValue({
  complete: (...args: unknown[]) => mockTrackerComplete(...args),
  fail: (...args: unknown[]) => mockTrackerFail(...args),
  runId: "test-run-id",
});

vi.mock("@/lib/cron-tracker", () => ({
  trackCronRun: (...args: unknown[]) => mockTrackCronRun(...args),
}));

// ── Mock api-error ─────────────────────────────────────────────────────────────

const mockHandleApiError = vi.fn().mockReturnValue(
  new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 })
);

vi.mock("@/lib/api-error", () => ({
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeRequest(tier: number | null, authorized = true): NextRequest {
  const url = tier !== null
    ? `https://example.com/api/cron/sync?tier=${tier}`
    : "https://example.com/api/cron/sync";
  const headers: Record<string, string> = {};
  if (authorized) {
    headers["authorization"] = "Bearer test-cron-secret";
  }
  return new NextRequest(url, { headers });
}

function makeOrchestratorResult(overrides: {
  sourcesFailed?: number;
  detailErrors?: string[];
} = {}) {
  const hasFailed = (overrides.sourcesFailed ?? 0) > 0;
  return {
    tier: 1,
    sourcesRun: 2,
    sourcesSucceeded: hasFailed ? 1 : 2,
    sourcesFailed: overrides.sourcesFailed ?? 0,
    details: [
      {
        source: "adapter-a",
        status: hasFailed ? "failed" : "success",
        recordsProcessed: hasFailed ? 0 : 10,
        errors: overrides.detailErrors?.map((m) => ({ message: m })) ?? [],
        durationMs: 100,
      },
      {
        source: "adapter-b",
        status: "success",
        recordsProcessed: 5,
        errors: [],
        durationMs: 50,
      },
    ],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/cron/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";

    // Default tracker.complete returns a 200 response with the passed data
    mockTrackerComplete.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, runId: "test-run-id", ...data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  it("returns 401 when authorization header is missing", async () => {
    const { GET } = await import("./route");
    const request = makeRequest(1, false);
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns 401 when authorization header has wrong secret", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest(
      "https://example.com/api/cron/sync?tier=1",
      { headers: { authorization: "Bearer wrong-secret" } }
    );
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when tier is 0", async () => {
    const { GET } = await import("./route");
    const request = makeRequest(0);
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when tier is 5", async () => {
    const { GET } = await import("./route");
    const request = makeRequest(5);
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns 200 with correct body shape on successful sync", async () => {
    const orchestratorResult = makeOrchestratorResult();
    mockRunTierSync.mockResolvedValue(orchestratorResult);

    const { GET } = await import("./route");
    const request = makeRequest(1);
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockTrackerComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 1,
        sourcesRun: 2,
        sourcesSucceeded: 2,
        sourcesFailed: 0,
        overallStatus: "success",
      })
    );
  });

  it("includes details array in tracker.complete call", async () => {
    const orchestratorResult = makeOrchestratorResult();
    mockRunTierSync.mockResolvedValue(orchestratorResult);

    const { GET } = await import("./route");
    const request = makeRequest(1);
    await GET(request);

    const [summary] = mockTrackerComplete.mock.calls[0] as [Record<string, unknown>];
    expect(summary).toHaveProperty("details");
    expect(Array.isArray(summary.details)).toBe(true);
  });

  it("details[].errors contains error message strings (not count)", async () => {
    const orchestratorResult = makeOrchestratorResult({
      sourcesFailed: 1,
      detailErrors: ["Rate limit exceeded", "Timeout after 5000ms"],
    });
    mockRunTierSync.mockResolvedValue(orchestratorResult);

    const { GET } = await import("./route");
    const request = makeRequest(1);
    await GET(request);

    const [summary] = mockTrackerComplete.mock.calls[0] as [Record<string, unknown>];
    const details = summary.details as Array<{ errors: unknown }>;
    expect(details[0].errors).toEqual([
      "Rate limit exceeded",
      "Timeout after 5000ms",
    ]);
  });

  it("details[].errors is empty array when adapter succeeded", async () => {
    const orchestratorResult = makeOrchestratorResult();
    mockRunTierSync.mockResolvedValue(orchestratorResult);

    const { GET } = await import("./route");
    const request = makeRequest(1);
    await GET(request);

    const [summary] = mockTrackerComplete.mock.calls[0] as [Record<string, unknown>];
    const details = summary.details as Array<{ errors: unknown }>;
    const allEmpty = details.every((d) => Array.isArray(d.errors) && d.errors.length === 0);
    expect(allEmpty).toBe(true);
  });

  it("overallStatus is 'partial' when any adapter failed", async () => {
    const orchestratorResult = makeOrchestratorResult({ sourcesFailed: 1 });
    mockRunTierSync.mockResolvedValue(orchestratorResult);

    const { GET } = await import("./route");
    const request = makeRequest(1);
    await GET(request);

    const [summary] = mockTrackerComplete.mock.calls[0] as [Record<string, unknown>];
    expect(summary.overallStatus).toBe("partial");
  });

  it("overallStatus is 'success' when all adapters succeeded", async () => {
    const orchestratorResult = makeOrchestratorResult({ sourcesFailed: 0 });
    mockRunTierSync.mockResolvedValue(orchestratorResult);

    const { GET } = await import("./route");
    const request = makeRequest(1);
    await GET(request);

    const [summary] = mockTrackerComplete.mock.calls[0] as [Record<string, unknown>];
    expect(summary.overallStatus).toBe("success");
  });

  it("calls handleApiError when runTierSync throws", async () => {
    mockRunTierSync.mockRejectedValue(new Error("DB connection failed"));

    const { GET } = await import("./route");
    const request = makeRequest(1);
    await GET(request);

    expect(mockHandleApiError).toHaveBeenCalledWith(
      expect.any(Error),
      "cron/sync"
    );
  });
});
