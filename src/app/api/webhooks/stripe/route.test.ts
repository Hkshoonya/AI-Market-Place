import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

const mockCreateAdminClient = vi.fn();
const mockCreditWallet = vi.fn();
const mockGetOrCreateWallet = vi.fn();
const mockRecordStripeWebhookEvent = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/payments/wallet", () => ({
  creditWallet: (...args: unknown[]) => mockCreditWallet(...args),
  getOrCreateWallet: (...args: unknown[]) => mockGetOrCreateWallet(...args),
}));

vi.mock("@/lib/payments/stripe-health", () => ({
  recordStripeWebhookEvent: (...args: unknown[]) => mockRecordStripeWebhookEvent(...args),
}));

vi.mock("@/lib/logging", () => ({
  systemLog: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: "whsec_test",
  },
}));

function signStripePayload(
  payload: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000)
) {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function makeRequest(payload: Record<string, unknown>, signature?: string) {
  const body = JSON.stringify(payload);
  return new NextRequest("https://aimarketcap.tech/api/webhooks/stripe", {
    method: "POST",
    headers: signature
      ? {
          "content-type": "application/json",
          "stripe-signature": signature,
        }
      : {
          "content-type": "application/json",
        },
    body,
  });
}

function makeRawRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://aimarketcap.tech/api/webhooks/stripe", {
    method: "POST",
    headers,
    body,
  });
}

function createWalletLookupStub(walletId = "wallet-1") {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: walletId }, error: null }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table !== "wallets") throw new Error(`Unexpected table ${table}`);
      return builder;
    }),
  };
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockCreateAdminClient.mockReturnValue(createWalletLookupStub());
    mockGetOrCreateWallet.mockResolvedValue({ id: "wallet-owner-1" });
    mockCreditWallet.mockResolvedValue("tx-1");
    mockRecordStripeWebhookEvent.mockResolvedValue(undefined);
  });

  it("rejects requests without a valid Stripe signature", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      makeRequest({
        id: "evt_1",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_1",
            status: "succeeded",
            amount_received: 2000,
            currency: "usd",
          },
        },
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing Stripe signature",
    });
    expect(mockRecordStripeWebhookEvent).not.toHaveBeenCalled();
  });

  it("rejects oversized payloads without recording attacker-controlled telemetry", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      makeRawRequest("{}", {
        "content-length": "1000001",
        "stripe-signature": "invalid",
      })
    );

    expect(response.status).toBe(413);
    expect(mockRecordStripeWebhookEvent).not.toHaveBeenCalled();
  });

  it("credits the wallet for a paid checkout session", async () => {
    const payload = {
      id: "evt_checkout",
      livemode: true,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          payment_intent: "pi_123",
          payment_status: "paid",
          amount_total: 2500,
          currency: "usd",
          metadata: {
            app: "aimarketcap", purpose: "wallet_top_up",
            wallet_id: "wallet-1",
          },
        },
      },
    };
    const signature = signStripePayload(JSON.stringify(payload), "whsec_test");

    const { POST } = await import("./route");
    const response = await POST(makeRequest(payload, signature));

    expect(response.status).toBe(200);
    expect(mockCreditWallet).toHaveBeenCalledWith(
      "wallet-1",
      25,
      "deposit",
      expect.objectContaining({
        chain: "internal",
        txHash: "stripe:pi_123",
        referenceType: "stripe_payment",
        referenceId: "pi_123",
      })
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        received: true,
        processed: true,
        duplicate: false,
        walletId: "wallet-1",
        amount: 25,
      })
    );
  });

  it("credits an owner wallet for succeeded payment intents", async () => {
    const payload = {
      id: "evt_pi",
      livemode: true,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_owner",
          status: "succeeded",
          amount_received: 4000,
          currency: "usd",
          metadata: {
            app: "aimarketcap", purpose: "wallet_top_up",
            owner_id: "user-123",
            owner_type: "user",
          },
        },
      },
    };
    const signature = signStripePayload(JSON.stringify(payload), "whsec_test");

    const { POST } = await import("./route");
    const response = await POST(makeRequest(payload, signature));

    expect(response.status).toBe(200);
    expect(mockGetOrCreateWallet).toHaveBeenCalledWith("user-123", "user");
    expect(mockCreditWallet).toHaveBeenCalledWith(
      "wallet-owner-1",
      40,
      "deposit",
      expect.objectContaining({
        txHash: "stripe:pi_owner",
      })
    );
  });

  it("falls back to owner metadata when the wallet id is stale", async () => {
    const walletLookup = createWalletLookupStub();
    const builder = walletLookup.from("wallets");
    builder.single.mockResolvedValue({ data: null, error: { message: "not found" } });
    mockCreateAdminClient.mockReturnValue(walletLookup);

    const payload = {
      id: "evt_owner_fallback",
      livemode: true,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_owner_fallback",
          status: "succeeded",
          amount_received: 5000,
          currency: "usd",
          metadata: {
            app: "aimarketcap", purpose: "wallet_top_up",
            wallet_id: "wallet-missing",
            owner_id: "user-999",
            owner_type: "user",
          },
        },
      },
    };
    const signature = signStripePayload(JSON.stringify(payload), "whsec_test");

    const { POST } = await import("./route");
    const response = await POST(makeRequest(payload, signature));

    expect(response.status).toBe(200);
    expect(mockGetOrCreateWallet).toHaveBeenCalledWith("user-999", "user");
    expect(mockCreditWallet).toHaveBeenCalledWith(
      "wallet-owner-1",
      50,
      "deposit",
      expect.objectContaining({
        txHash: "stripe:pi_owner_fallback",
      })
    );
  });

  it("uses expanded payment_intent ids on checkout completion", async () => {
    const payload = {
      id: "evt_checkout_expanded",
      livemode: true,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_456",
          payment_intent: {
            id: "pi_expanded_456",
          },
          payment_status: "paid",
          amount_total: 2500,
          currency: "usd",
          metadata: {
            app: "aimarketcap", purpose: "wallet_top_up",
            wallet_id: "wallet-1",
          },
        },
      },
    };
    const signature = signStripePayload(JSON.stringify(payload), "whsec_test");

    const { POST } = await import("./route");
    const response = await POST(makeRequest(payload, signature));

    expect(response.status).toBe(200);
    expect(mockCreditWallet).toHaveBeenCalledWith(
      "wallet-1",
      25,
      "deposit",
      expect.objectContaining({
        txHash: "stripe:pi_expanded_456",
        referenceId: "pi_expanded_456",
      })
    );
  });

  it("treats duplicate payment credits as idempotent success", async () => {
    mockCreditWallet.mockRejectedValueOnce(
      new Error(
        "credit_wallet failed: duplicate key value violates unique constraint \"idx_wallet_tx_unique_hash\""
      )
    );

    const payload = {
      id: "evt_dup",
      livemode: true,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_dup",
          status: "succeeded",
          amount_received: 1200,
          currency: "usd",
          metadata: {
            app: "aimarketcap", purpose: "wallet_top_up",
            wallet_id: "wallet-1",
          },
        },
      },
    };
    const signature = signStripePayload(JSON.stringify(payload), "whsec_test");

    const { POST } = await import("./route");
    const response = await POST(makeRequest(payload, signature));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        received: true,
        processed: true,
        duplicate: true,
      })
    );
  });

  it("ignores unrelated Stripe events", async () => {
    const payload = {
      id: "evt_ignore",
      livemode: true,
      type: "customer.created",
      data: {
        object: {
          id: "cus_123",
        },
      },
    };
    const signature = signStripePayload(JSON.stringify(payload), "whsec_test");

    const { POST } = await import("./route");
    const response = await POST(makeRequest(payload, signature));

    expect(response.status).toBe(200);
    expect(mockCreditWallet).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        received: true,
        processed: false,
        ignored: true,
      })
    );
  });

  it("acknowledges successful payment intents that do not target an AIMC wallet", async () => {
    const payload = {
      id: "evt_other_product",
      livemode: true,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_other_product",
          status: "succeeded",
          amount_received: 9900,
          currency: "usd",
          metadata: {},
        },
      },
    };
    const signature = signStripePayload(JSON.stringify(payload), "whsec_test");

    const { POST } = await import("./route");
    const response = await POST(makeRequest(payload, signature));

    expect(response.status).toBe(200);
    expect(mockCreditWallet).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        received: true,
        processed: false,
        ignored: true,
      })
    );
  });

  it.each(["checkout.session.completed", "payment_intent.succeeded"])("never credits a signed test-mode %s", async (type) => {
    const payload = {
      id: "evt_sandbox", type, livemode: false,
      data: { object: {
        id: "pi_sandbox", payment_intent: "pi_sandbox", status: "succeeded", payment_status: "paid",
        amount_received: 10000, amount_total: 10000, currency: "usd",
        metadata: { app: "aimarketcap", purpose: "wallet_top_up", wallet_id: "wallet-1" },
      } },
    };
    const { POST } = await import("./route");
    const response = await POST(makeRequest(payload, signStripePayload(JSON.stringify(payload), "whsec_test")));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ignored: true, reason: "test_mode_not_funded" });
    expect(mockCreditWallet).not.toHaveBeenCalled();
    expect(mockGetOrCreateWallet).not.toHaveBeenCalled();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it.each([
    { owner_id: "user-123" },
    { app: "greenbook", purpose: "wallet_top_up", wallet_id: "wallet-1" },
    { app: "aimarketcap", purpose: "data_subscription", owner_id: "user-123" },
  ])("ignores other products even with owner-like metadata %j", async (metadata) => {
    const payload = { id: "evt_other", type: "payment_intent.succeeded", livemode: true, data: { object: {
      id: "pi_other", status: "succeeded", amount_received: 4900, currency: "usd", metadata,
    } } };
    const { POST } = await import("./route");
    const response = await POST(makeRequest(payload, signStripePayload(JSON.stringify(payload), "whsec_test")));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ignored: true });
    expect(mockCreditWallet).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "true"])("rejects a missing or invalid event mode %s", async (livemode) => {
    const payload = { id: "evt_mode", type: "payment_intent.succeeded", livemode, data: { object: { id: "pi_mode" } } };
    const { POST } = await import("./route");
    const response = await POST(makeRequest(payload, signStripePayload(JSON.stringify(payload), "whsec_test")));
    expect(response.status).toBe(400);
    expect(mockCreditWallet).not.toHaveBeenCalled();
  });

  it.each([0, -100, 20.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid funding amount %s", async (amount_received) => {
    const payload = { id: "evt_amount", type: "payment_intent.succeeded", livemode: true, data: { object: {
      id: "pi_amount", status: "succeeded", amount_received, currency: "usd",
      metadata: { app: "aimarketcap", purpose: "wallet_top_up", wallet_id: "wallet-1" },
    } } };
    const { POST } = await import("./route");
    const response = await POST(makeRequest(payload, signStripePayload(JSON.stringify(payload), "whsec_test")));
    expect(response.status).toBe(400);
    expect(mockCreditWallet).not.toHaveBeenCalled();
  });
});
