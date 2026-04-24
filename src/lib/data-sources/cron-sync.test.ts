import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRunTierSync = vi.fn();
const mockRunSingleSync = vi.fn();

vi.mock("./orchestrator", () => ({
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

describe("executeTrackedSyncCronJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
  });

  it("returns a completed response for tier syncs", async () => {
    mockRunTierSync.mockResolvedValue(makeOrchestratorResult());

    const { executeTrackedSyncCronJob } = await import("./cron-sync");
    const response = await executeTrackedSyncCronJob({ tier: 1 });

    expect(response.status).toBe(200);
    expect(mockTrackCronRun).toHaveBeenCalledWith("sync-tier-1", {
      staleAfterMs: 10 * 60 * 1000,
    });
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

  it("includes error message strings in summary details", async () => {
    mockRunTierSync.mockResolvedValue(
      makeOrchestratorResult({
        sourcesFailed: 1,
        detailErrors: ["Rate limit exceeded", "Timeout after 5000ms"],
      })
    );

    const { executeTrackedSyncCronJob } = await import("./cron-sync");
    await executeTrackedSyncCronJob({ tier: 1 });

    const [summary] = mockTrackerComplete.mock.calls[0] as [Record<string, unknown>];
    const details = summary.details as Array<{ errors: unknown }>;
    expect(details[0].errors).toEqual([
      "Rate limit exceeded",
      "Timeout after 5000ms",
    ]);
    expect(summary.overallStatus).toBe("partial");
  });

  it("returns a skip response when the cron run is already in progress", async () => {
    mockTrackCronRun.mockResolvedValueOnce({
      complete: (...args: unknown[]) => mockTrackerComplete(...args),
      fail: (...args: unknown[]) => mockTrackerFail(...args),
      skip: (...args: unknown[]) => mockTrackerSkip(...args),
      runId: null,
      shouldSkip: true,
    });

    const { executeTrackedSyncCronJob } = await import("./cron-sync");
    const response = await executeTrackedSyncCronJob({ tier: 1 });
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.skipped).toBe(true);
    expect(mockRunTierSync).not.toHaveBeenCalled();
  });

  it("runs a single source sync when source is provided", async () => {
    mockRunSingleSync.mockResolvedValue({
      tier: 2,
      sourcesRun: 1,
      sourcesSucceeded: 1,
      sourcesFailed: 0,
      details: [
        {
          source: "provider-news",
          status: "success",
          recordsProcessed: 7,
          errors: [],
          durationMs: 12,
        },
      ],
    });

    const { executeTrackedSyncCronJob } = await import("./cron-sync");
    const response = await executeTrackedSyncCronJob({ source: "provider-news" });

    expect(response.status).toBe(200);
    expect(mockTrackCronRun).toHaveBeenCalledWith("sync-source-provider-news", {
      staleAfterMs: 10 * 60 * 1000,
    });
    expect(mockRunSingleSync).toHaveBeenCalledWith("provider-news");
  });

  it("records failures through tracker.fail", async () => {
    mockRunTierSync.mockRejectedValue(new Error("DB connection failed"));

    const { executeTrackedSyncCronJob } = await import("./cron-sync");
    const response = await executeTrackedSyncCronJob({ tier: 1 });

    expect(response.status).toBe(500);
    expect(mockTrackerFail).toHaveBeenCalled();
  });
});
