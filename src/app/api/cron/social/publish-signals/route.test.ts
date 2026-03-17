import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateAdminClient = vi.fn();
const mockPublishRecentSignalsToCommons = vi.fn();
const mockTrackerComplete = vi.fn();
const mockTrackerFail = vi.fn();
const mockTrackerSkip = vi.fn();
const mockTrackCronRun = vi.fn().mockResolvedValue({
  complete: (...args: unknown[]) => mockTrackerComplete(...args),
  fail: (...args: unknown[]) => mockTrackerFail(...args),
  skip: (...args: unknown[]) => mockTrackerSkip(...args),
  runId: "cron-run-1",
  shouldSkip: false,
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/social/publisher", () => ({
  publishRecentSignalsToCommons: (...args: unknown[]) =>
    mockPublishRecentSignalsToCommons(...args),
}));

vi.mock("@/lib/cron-tracker", () => ({
  trackCronRun: (...args: unknown[]) => mockTrackCronRun(...args),
}));

function makeRequest(authorized = true) {
  return new NextRequest(
    "https://aimarketcap.tech/api/cron/social/publish-signals",
    {
      headers: authorized
        ? { authorization: "Bearer test-cron-secret" }
        : undefined,
    }
  );
}

describe("GET /api/cron/social/publish-signals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";

    mockCreateAdminClient.mockReturnValue({ supabase: true });
    mockTrackerComplete.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, ...data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    mockTrackerFail.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "boom" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
    mockTrackerSkip.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 when the cron secret is missing or wrong", async () => {
    const { GET } = await import("./route");

    expect((await GET(makeRequest(false))).status).toBe(401);
    expect(
      (
        await GET(
          new NextRequest(
            "https://aimarketcap.tech/api/cron/social/publish-signals",
            {
              headers: { authorization: "Bearer wrong-secret" },
            }
          )
        )
      ).status
    ).toBe(401);
  });

  it("returns 202 when a duplicate run is already active", async () => {
    mockTrackCronRun.mockResolvedValueOnce({
      complete: (...args: unknown[]) => mockTrackerComplete(...args),
      fail: (...args: unknown[]) => mockTrackerFail(...args),
      skip: (...args: unknown[]) => mockTrackerSkip(...args),
      runId: null,
      shouldSkip: true,
    });

    const { GET } = await import("./route");
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.skipped).toBe(true);
    expect(mockPublishRecentSignalsToCommons).not.toHaveBeenCalled();
  });

  it("publishes signals through the tracker on success", async () => {
    mockPublishRecentSignalsToCommons.mockResolvedValue({
      actorHandle: "pipeline-engineer",
      candidateCount: 12,
      publishedCount: 3,
      publishedNewsIds: ["news-1", "news-2", "news-3"],
      skippedExistingCount: 9,
    });

    const { GET } = await import("./route");
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(mockPublishRecentSignalsToCommons).toHaveBeenCalledWith({ supabase: true });
    expect(mockTrackerComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        actorHandle: "pipeline-engineer",
        publishedCount: 3,
      })
    );
  });

  it("reports failures through the tracker", async () => {
    mockPublishRecentSignalsToCommons.mockRejectedValue(new Error("publish failed"));

    const { GET } = await import("./route");
    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(mockTrackerFail).toHaveBeenCalledTimes(1);
  });
});
