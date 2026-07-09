import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockAfter = vi.hoisted(() => vi.fn());
const mockSystemLogError = vi.hoisted(() => vi.fn());

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (callback: () => unknown) => mockAfter(callback),
  };
});

vi.mock("@/lib/logging", () => ({
  systemLog: {
    error: (...args: unknown[]) => mockSystemLogError(...args),
  },
}));

function makeRequest(
  body: unknown,
  authorization = "Bearer test-cron-secret"
) {
  return new NextRequest("https://aimarketcap.tech/api/cron/dispatch", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/cron/dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.PORT = "3000";
  });

  it("rejects unauthorized dispatch requests", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      makeRequest(
        { path: "/api/cron/trending-cache?limits=8,10" },
        "Bearer wrong-secret"
      )
    );

    expect(response.status).toBe(401);
    expect(mockAfter).not.toHaveBeenCalled();
  });

  it("rejects paths outside the configured cron allowlist", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      makeRequest({ path: "https://example.com/internal" })
    );

    expect(response.status).toBe(404);
    expect(mockAfter).not.toHaveBeenCalled();
  });

  it("accepts an allowlisted job and executes it over loopback after responding", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./route");
    const response = await POST(
      makeRequest({
        name: "Trending Cache",
        path: "/api/cron/trending-cache?limits=8,10",
        scheduledTime: "2026-07-09T23:20:00.000Z",
      })
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      job: "Trending Cache",
      path: "/api/cron/trending-cache?limits=8,10",
      scheduledTime: "2026-07-09T23:20:00.000Z",
    });
    expect(mockAfter).toHaveBeenCalledOnce();

    const backgroundCallback = mockAfter.mock.calls[0]?.[0] as () => Promise<void>;
    await backgroundCallback();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/cron/trending-cache?limits=8,10",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-cron-secret",
          "X-AIMC-Cron-Job": "Trending Cache",
          "X-AIMC-Scheduled-Time": "2026-07-09T23:20:00.000Z",
        }),
      })
    );
    expect(mockSystemLogError).not.toHaveBeenCalled();
  });
});
