import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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
const mockCreateAdminClient = vi.fn();
const mockReconcileHostedDeployments = vi.fn();

vi.mock("@/lib/cron-tracker", () => ({
  trackCronRun: (...args: unknown[]) => mockTrackCronRun(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/workspace/reconcile-hosted-deployments", () => ({
  reconcileHostedDeployments: (...args: unknown[]) => mockReconcileHostedDeployments(...args),
}));

describe("GET /api/cron/deployments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mockCreateAdminClient.mockReturnValue({});
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

  it("returns 401 without the cron secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("https://aimarketcap.tech/api/cron/deployments"));
    expect(response.status).toBe(401);
  });

  it("reconciles hosted deployments and completes the cron run", async () => {
    mockReconcileHostedDeployments.mockResolvedValue({
      scanned: 5,
      updated: 2,
      unchanged: 3,
      errors: [],
    });

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/cron/deployments", {
        headers: { authorization: "Bearer test-cron-secret" },
      })
    );

    expect(response.status).toBe(200);
    expect(mockReconcileHostedDeployments).toHaveBeenCalled();
    expect(mockTrackerComplete).toHaveBeenCalledWith({
      scanned: 5,
      updated: 2,
      unchanged: 3,
      errors: [],
    });
  });
});
