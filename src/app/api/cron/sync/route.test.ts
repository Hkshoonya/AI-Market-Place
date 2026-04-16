/**
 * Unit tests for cron sync route
 *
 * Covers:
 * 1. Unauthorized request returns 401
 * 2. Invalid tier returns 400
 * 3. Valid requests forward to the shared sync executor
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockExecuteTrackedSyncCronJob = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
);

vi.mock("@/lib/data-sources/cron-sync", () => ({
  executeTrackedSyncCronJob: (...args: unknown[]) =>
    mockExecuteTrackedSyncCronJob(...args),
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

describe("GET /api/cron/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  it("returns 401 when authorization header is missing", async () => {
    const { GET } = await import("./route");
    const response = await GET(makeRequest(1, false));
    expect(response.status).toBe(401);
    expect(mockExecuteTrackedSyncCronJob).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization header has wrong secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("https://example.com/api/cron/sync?tier=1", {
        headers: { authorization: "Bearer wrong-secret" },
      })
    );
    expect(response.status).toBe(401);
    expect(mockExecuteTrackedSyncCronJob).not.toHaveBeenCalled();
  });

  it("returns 400 when tier is 0", async () => {
    const { GET } = await import("./route");
    const response = await GET(makeRequest(0));
    expect(response.status).toBe(400);
    expect(mockExecuteTrackedSyncCronJob).not.toHaveBeenCalled();
  });

  it("returns 400 when tier is 5", async () => {
    const { GET } = await import("./route");
    const response = await GET(makeRequest(5));
    expect(response.status).toBe(400);
    expect(mockExecuteTrackedSyncCronJob).not.toHaveBeenCalled();
  });

  it("returns 400 when neither tier nor source is provided", async () => {
    const { GET } = await import("./route");
    const response = await GET(makeRequest(null));
    expect(response.status).toBe(400);
    expect(mockExecuteTrackedSyncCronJob).not.toHaveBeenCalled();
  });

  it("forwards valid tier requests to the shared executor", async () => {
    const { GET } = await import("./route");
    const response = await GET(makeRequest(1));

    expect(response.status).toBe(200);
    expect(mockExecuteTrackedSyncCronJob).toHaveBeenCalledWith({
      source: undefined,
      tier: 1,
    });
  });

  it("forwards source requests to the shared executor", async () => {
    const { GET } = await import("./route");
    await GET(makeRequest(null, true, "provider-news"));

    expect(mockExecuteTrackedSyncCronJob).toHaveBeenCalledWith({
      source: "provider-news",
      tier: 0,
    });
  });
});
