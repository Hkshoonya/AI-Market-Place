import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: rpcMock,
  })),
}));

describe("rate-limit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.RATE_LIMIT_BACKEND;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  afterEach(async () => {
    const mod = await import("./rate-limit");
    mod.resetRateLimitStore();
  });

  it("uses provider IP headers before forwarded headers", async () => {
    const { getClientIp } = await import("./rate-limit");
    const request = new Request("https://aimarketcap.tech/api/models", {
      headers: {
        "cf-connecting-ip": "203.0.113.8",
        "x-forwarded-for": "198.51.100.5, 10.0.0.1",
        "x-forwarded-proto": "https",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.8");
  });

  it("uses the first forwarded IP only when a proxy hint is present", async () => {
    const { getClientIp } = await import("./rate-limit");
    const request = new Request("https://aimarketcap.tech/api/models", {
      headers: {
        "x-forwarded-for": "198.51.100.5, 10.0.0.1",
        "x-forwarded-proto": "https",
      },
    });

    expect(getClientIp(request)).toBe("198.51.100.5");
  });

  it("ignores naked spoofed forwarded headers without a proxy hint", async () => {
    const { getClientIp } = await import("./rate-limit");
    const request = new Request("https://aimarketcap.tech/api/models", {
      headers: {
        "x-forwarded-for": "198.51.100.5",
      },
    });

    expect(getClientIp(request)).toBe("unknown");
  });

  it("uses the durable backend when configured", async () => {
    process.env.RATE_LIMIT_BACKEND = "database";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    rpcMock.mockResolvedValue({
      data: [{ allowed: true, limit_count: 20, remaining: 19, reset: 60 }],
      error: null,
    });

    const { rateLimit } = await import("./rate-limit");
    const result = await rateLimit("models:203.0.113.8", {
      limit: 20,
      windowMs: 60_000,
    });

    expect(result).toEqual({
      success: true,
      limit: 20,
      remaining: 19,
      reset: 60,
    });
    expect(rpcMock).toHaveBeenCalledWith("check_rate_limit", {
      p_bucket_key: "models:203.0.113.8",
      p_max_requests: 20,
      p_window_seconds: 60,
    });
  });

  it("falls back to in-memory limiting when the durable backend errors", async () => {
    process.env.RATE_LIMIT_BACKEND = "database";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: "boom" },
      });

      const { rateLimit } = await import("./rate-limit");
      const config = { limit: 1, windowMs: 60_000 };

      const first = await rateLimit("models:203.0.113.8", config);
      const second = await rateLimit("models:203.0.113.8", config);

      expect(first.success).toBe(true);
      expect(second.success).toBe(false);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
