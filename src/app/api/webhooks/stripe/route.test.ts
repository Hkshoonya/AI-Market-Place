import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

const mockCreateAdminClient = vi.fn();
const mockCreditWallet = vi.fn();
const mockGetOrCreateWallet = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/payments/wallet", () => ({
  creditWallet: (...args: unknown[]) => mockCreditWallet(...args),
  getOrCreateWallet: (...args: unknown[]) => mockGetOrCreateWallet(...args),
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
  });

  it("credits the wallet for a paid checkout session", async () => {
    const payload = {
      id: "evt_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          payment_intent: "pi_123",
          payment_status: "paid",
          amount_total: 2500,
          currency: "usd",
          metadata: {
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
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_owner",
          status: "succeeded",
          amount_received: 4000,
          currency: "usd",
          metadata: {
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

  it("treats duplicate payment credits as idempotent success", async () => {
    mockCreditWallet.mockRejectedValueOnce(
      new Error(
        "credit_wallet failed: duplicate key value violates unique constraint \"idx_wallet_tx_unique_hash\""
      )
    );

    const payload = {
      id: "evt_dup",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_dup",
          status: "succeeded",
          amount_received: 1200,
          currency: "usd",
          metadata: {
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
});
