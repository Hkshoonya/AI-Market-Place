/**
 * Unit tests for cron sync route
 *
 * Covers:
 * 1. Authorized request with successful sync returns 200 with correct body shape
 * 2. Response body details[].errors contains actual error message strings (not count)
 * 3. Unauthorized request returns 401
 * 4. Invalid tier returns 400
 * 5. overallStatus is "partial" when any adapter failed, "success" when all succeeded
 * 6. Duplicate cron runs return a 202 skip response
 * 7. Errors are recorded through tracker.fail()
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockRunTierSync = vi.fn();
const mockRunSingleSync = vi.fn();

vi.mock("@/lib/data-sources/orchestrator", () => ({
  runTierSync: (...args: unknown[]) => mockRunTierSync(...args),
  runSingleSync: (...args: unknown[]) => mockRunSingleSync(...args),
}));

const mockTrackerComplete = vi.fn();
const mockTrackerFail = vi.fn();
const mockTrackerSkip = vi.fn();
const mockTrackCronRun = vi.fn().mockResolvedValue({
  complete: (...args: unknown[]) => mockTrackerComplete(...args),
  fail: (...args: unknown[]) => mockTrackerFail(...args),
  skip: (...args: unknown[]) => mockTrackerSkip(...args),
  runId: "test-run-id",
  shouldSkip: false,
});

vi.mock("@/lib/cron-tracker", () => ({
  trackCronRun: (...args: unknown[]) => mockTrackCronRun(...args),
}));

function makeRequest(
  tier: number | null,
  authorized = true,
  source?: string
): NextRequest {
  const params = new URLSearchParams();
  if (tier !== null) params.set("tier", String(tier));
  if (source) params.set("source", source);
  const query = params.toString();
  const url = query
    ? `https://example.com/api/cron/sync?${query}`
    : "https://example.com/api/cron/sync";
  const headers: Record<string, string> = {};
  if (authorized) {
    headers.authorization = "Bearer test-cron-secret";
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
        errors: overrides.detailErrors?.map((message) => ({ message })) ?? [],
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

describe("GET /api/cron/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";

    mockTrackerComplete.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, runId: "test-run-id", ...data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    mockTrackerFail.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "DB connection failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
    mockTrackerSkip.mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "already_running" }),
        {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  it("returns 401 when authorization header is missing", async () => {
    const { GET } = await import("./route");
    const response = await GET(makeRequest(1, false));
    expect(response.status).toBe(401);
  });

  it("returns 401 when authorization header has wrong secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("https://example.com/api/cron/sync?tier=1", {
        headers: { authorization: "Bearer wrong-secret" },
      })
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 when tier is 0", async () => {
    const { GET } = await import("./route");
    const response = await GET(makeRequest(0));
    expect(response.status).toBe(400);
  });

  it("returns 400 when tier is 5", async () => {
    const { GET } = await import("./route");
    const response = await GET(makeRequest(5));
    expect(response.status).toBe(400);
  });

  it("returns 400 when neither tier nor source is provided", async () => {
    const { GET } = await import("./route");
    const response = await GET(makeRequest(null));
    expect(response.status).toBe(400);
  });

  it("returns 200 with correct body shape on successful sync", async () => {
    mockRunTierSync.mockResolvedValue(makeOrchestratorResult());

    const { GET } = await import("./route");
    const response = await GET(makeRequest(1));

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

  it("returns 202 when a duplicate cron run is already in progress", async () => {
    mockTrackCronRun.mockResolvedValueOnce({
      complete: (...args: unknown[]) => mockTrackerComplete(...args),
      fail: (...args: unknown[]) => mockTrackerFail(...args),
      skip: (...args: unknown[]) => mockTrackerSkip(...args),
      runId: null,
      shouldSkip: true,
    });

    const { GET } = await import("./route");
    const response = await GET(makeRequest(1));
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.skipped).toBe(true);
    expect(mockTrackerSkip).toHaveBeenCalledTimes(1);
    expect(mockRunTierSync).not.toHaveBeenCalled();
  });

  it("includes details array in tracker.complete call", async () => {
    mockRunTierSync.mockResolvedValue(makeOrchestratorResult());

    const { GET } = await import("./route");
    await GET(makeRequest(1));

    const [summary] = mockTrackerComplete.mock.calls[0] as [Record<string, unknown>];
    expect(summary).toHaveProperty("details");
    expect(Array.isArray(summary.details)).toBe(true);
  });

  it("details[].errors contains error message strings (not count)", async () => {
    mockRunTierSync.mockResolvedValue(
      makeOrchestratorResult({
        sourcesFailed: 1,
        detailErrors: ["Rate limit exceeded", "Timeout after 5000ms"],
      })
    );

    const { GET } = await import("./route");
    await GET(makeRequest(1));

    const [summary] = mockTrackerComplete.mock.calls[0] as [Record<string, unknown>];
    const details = summary.details as Array<{ errors: unknown }>;
    expect(details[0].errors).toEqual([
      "Rate limit exceeded",
      "Timeout after 5000ms",
    ]);
  });

  it("details[].errors is empty array when adapter succeeded", async () => {
    mockRunTierSync.mockResolvedValue(makeOrchestratorResult());

    const { GET } = await import("./route");
    await GET(makeRequest(1));

    const [summary] = mockTrackerComplete.mock.calls[0] as [Record<string, unknown>];
    const details = summary.details as Array<{ errors: unknown }>;
    expect(
      details.every((detail) => Array.isArray(detail.errors) && detail.errors.length === 0)
    ).toBe(true);
  });

  it("overallStatus is 'partial' when any adapter failed", async () => {
    mockRunTierSync.mockResolvedValue(makeOrchestratorResult({ sourcesFailed: 1 }));

    const { GET } = await import("./route");
    await GET(makeRequest(1));

    const [summary] = mockTrackerComplete.mock.calls[0] as [Record<string, unknown>];
    expect(summary.overallStatus).toBe("partial");
  });

  it("overallStatus is 'success' when all adapters succeeded", async () => {
    mockRunTierSync.mockResolvedValue(makeOrchestratorResult({ sourcesFailed: 0 }));

    const { GET } = await import("./route");
    await GET(makeRequest(1));

    const [summary] = mockTrackerComplete.mock.calls[0] as [Record<string, unknown>];
    expect(summary.overallStatus).toBe("success");
  });

  it("runs a single source when source query param is provided", async () => {
    mockRunSingleSync.mockResolvedValue({
      tier: 2,
      sourcesRun: 1,
      sourcesSucceeded: 1,
      sourcesFailed: 0,
      details: [
        {
          source: "vision-arena",
          status: "success",
          recordsProcessed: 42,
          errors: [],
          durationMs: 123,
        },
      ],
    });

    const { GET } = await import("./route");
    const response = await GET(makeRequest(null, true, "vision-arena"));

    expect(response.status).toBe(200);
    expect(mockRunSingleSync).toHaveBeenCalledWith("vision-arena");
    expect(mockRunTierSync).not.toHaveBeenCalled();

    const [summary] = mockTrackerComplete.mock.calls[0] as [Record<string, unknown>];
    expect(summary.overallStatus).toBe("success");
    expect(summary.details).toEqual([
      {
        source: "vision-arena",
        status: "success",
        records: 42,
        durationMs: 123,
        errors: [],
      },
    ]);
  });

  it("calls tracker.fail when runTierSync throws", async () => {
    mockRunTierSync.mockRejectedValue(new Error("DB connection failed"));

    const { GET } = await import("./route");
    const response = await GET(makeRequest(1));

    expect(response.status).toBe(500);
    expect(mockTrackerFail).toHaveBeenCalledWith(expect.any(Error));
  });
});
