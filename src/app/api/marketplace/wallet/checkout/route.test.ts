import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateClient = vi.fn();
const mockGetOrCreateWallet = vi.fn();
const mockFetch = vi.fn();
const mockEnv = vi.hoisted(() => ({
  NEXT_PUBLIC_STRIPE_PAYMENTS_ENABLED: true,
  STRIPE_SECRET_KEY: "sk_test_123",
}));

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
  env: mockEnv,
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
    mockEnv.NEXT_PUBLIC_STRIPE_PAYMENTS_ENABLED = true;

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

  it("fails closed when Stripe payments are not explicitly enabled", async () => {
    mockEnv.NEXT_PUBLIC_STRIPE_PAYMENTS_ENABLED = false;

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/wallet/checkout", {
        method: "POST",
        headers: { origin: "https://aimarketcap.tech" },
        body: JSON.stringify({ pack: "starter" }),
      })
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Card checkout is not enabled" });
    expect(mockGetOrCreateWallet).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
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
    expect(stripeBody.get("metadata[purpose]")).toBe("wallet_top_up");
    expect(stripeBody.get("metadata[owner_id]")).toBe("user-1");
    expect(stripeBody.get("payment_intent_data[metadata][wallet_id]")).toBe("wallet-1");
    expect(stripeBody.get("payment_intent_data[metadata][purpose]")).toBe("wallet_top_up");
    expect(stripeBody.get("line_items[0][price_data][unit_amount]")).toBe("2000");
    expect(stripeBody.get("success_url")).toBe(
      "https://aimarketcap.tech/wallet?intent=deploy&model=GPT-4.1&stripe=success&pack=starter"
    );
    expect(stripeBody.get("cancel_url")).toBe(
      "https://aimarketcap.tech/wallet?intent=deploy&model=GPT-4.1&stripe=cancelled&pack=starter"
    );
    expect(body.url).toBe("https://checkout.stripe.com/c/pay/cs_test_123");
  });

  it.each([
    "https://evil.example",
    "//evil.example/path",
    "/\\evil.example/path",
    "/%5Cevil.example/path",
    "/%252F%252Fevil.example/path",
  ])("rejects the unsafe return path %s", async (returnPath) => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/wallet/checkout", {
        method: "POST",
        body: JSON.stringify({
          pack: "starter",
          return_path: returnPath,
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
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
