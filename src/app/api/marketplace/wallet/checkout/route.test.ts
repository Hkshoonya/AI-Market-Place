import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateClient = vi.fn();
const mockGetOrCreateWallet = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock("@/lib/payments/wallet", () => ({
  getOrCreateWallet: (...args: unknown[]) => mockGetOrCreateWallet(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true })),
  RATE_LIMITS: { write: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_123",
  },
}));

vi.mock("@/lib/logging", () => ({
  systemLog: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("POST /api/marketplace/wallet/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
    });

    mockGetOrCreateWallet.mockResolvedValue({
      id: "wallet-1",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/c/pay/cs_test_123",
      }),
    });
  });

  it("creates a Stripe checkout session for a wallet pack", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/wallet/checkout", {
        method: "POST",
        headers: {
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({
          pack: "starter",
          return_path: "/wallet?intent=deploy&model=GPT-4.1",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetOrCreateWallet).toHaveBeenCalledWith("user-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.stripe.com/v1/checkout/sessions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk_test_123",
        }),
      })
    );

    const stripeBody = mockFetch.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(stripeBody.get("metadata[wallet_id]")).toBe("wallet-1");
    expect(stripeBody.get("metadata[owner_id]")).toBe("user-1");
    expect(stripeBody.get("payment_intent_data[metadata][wallet_id]")).toBe("wallet-1");
    expect(stripeBody.get("line_items[0][price_data][unit_amount]")).toBe("2000");
    expect(body.url).toBe("https://checkout.stripe.com/c/pay/cs_test_123");
  });

  it("rejects invalid return paths", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/wallet/checkout", {
        method: "POST",
        body: JSON.stringify({
          pack: "starter",
          return_path: "https://evil.example",
        }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/wallet/checkout", {
        method: "POST",
        headers: {
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({ pack: "starter" }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("rejects cross-origin checkout requests for signed-in users", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/wallet/checkout", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
        },
        body: JSON.stringify({ pack: "starter" }),
      })
    );

    expect(response.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("surfaces Stripe API failures", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { message: "Your Stripe account is restricted" },
      }),
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/wallet/checkout", {
        method: "POST",
        headers: {
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({ pack: "starter" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toMatch(/restricted/i);
  });
});
