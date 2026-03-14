import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockWarn = vi.fn();
const mockDeliverDigitalGood = vi.fn();
const mockGetOrCreateWallet = vi.fn();
const mockGetWalletBalance = vi.fn();
const mockCreatePurchaseEscrow = vi.fn();
const mockEnforceAutonomousCommerceGuardrails = vi.fn();

vi.mock("@/lib/logging", () => ({
  createTaggedLogger: () => ({
    info: vi.fn(),
    warn: (...args: unknown[]) => mockWarn(...args),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/marketplace/delivery", () => ({
  deliverDigitalGood: (...args: unknown[]) => mockDeliverDigitalGood(...args),
}));

vi.mock("@/lib/marketplace/escrow", () => ({
  createPurchaseEscrow: (...args: unknown[]) => mockCreatePurchaseEscrow(...args),
  completePurchaseEscrow: vi.fn(),
}));

vi.mock("@/lib/payments/wallet", () => ({
  getOrCreateWallet: (...args: unknown[]) => mockGetOrCreateWallet(...args),
  getWalletBalance: (...args: unknown[]) => mockGetWalletBalance(...args),
}));

vi.mock("@/lib/marketplace/policy", () => ({
  enforceAutonomousCommerceGuardrails: (...args: unknown[]) =>
    mockEnforceAutonomousCommerceGuardrails(...args),
}));

import { handleAuthenticatedCheckout, handleGuestCheckout } from "./purchase-handlers";

const ORIGINAL_BLOCK_GUEST_DELIVERY =
  process.env.BLOCK_GUEST_ACCOUNT_BOUND_DELIVERY;

function createMockSupabase() {
  return {
    from: (table: string) => {
      if (table === "marketplace_orders") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => ({
                    single: () => Promise.resolve({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: "order-1" },
                  error: null,
                }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        };
      }

      return {};
    },
  };
}

describe("handleGuestCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BLOCK_GUEST_ACCOUNT_BOUND_DELIVERY;
    mockDeliverDigitalGood.mockResolvedValue({
      success: true,
      deliveryType: "api_access",
      data: { api_key: "aimk_generated" },
    });
    mockEnforceAutonomousCommerceGuardrails.mockResolvedValue({
      allowed: true,
    });
    mockGetOrCreateWallet.mockResolvedValue({ id: "wallet-1" });
    mockGetWalletBalance.mockResolvedValue({ available: 500, held: 0 });
    mockCreatePurchaseEscrow.mockResolvedValue({ escrowId: "escrow-1", walletId: "wallet-1" });
  });

  afterEach(() => {
    if (ORIGINAL_BLOCK_GUEST_DELIVERY === undefined) {
      delete process.env.BLOCK_GUEST_ACCOUNT_BOUND_DELIVERY;
    } else {
      process.env.BLOCK_GUEST_ACCOUNT_BOUND_DELIVERY =
        ORIGINAL_BLOCK_GUEST_DELIVERY;
    }
  });

  it("blocks guest auto-delivery for account-bound products when the flag is enabled", async () => {
    process.env.BLOCK_GUEST_ACCOUNT_BOUND_DELIVERY = "true";

    const result = await handleGuestCheckout(
      createMockSupabase() as never,
      {
        id: "listing-1",
        seller_id: "seller-1",
        price: 0,
        pricing_type: "free",
        listing_type: "api_access",
        slug: "api-access-listing",
      },
      "guest@example.com",
      "Guest User"
    );

    expect(result.success).toBe(false);
    expect(result.httpStatus).toBe(401);
    expect(result.error).toMatch(/Authentication required/i);
  });

  it("allows the legacy path temporarily and logs a deprecation warning when the flag is off", async () => {
    const result = await handleGuestCheckout(
      createMockSupabase() as never,
      {
        id: "listing-1",
        seller_id: "seller-1",
        price: 0,
        pricing_type: "free",
        listing_type: "api_access",
        slug: "api-access-listing",
      },
      "guest@example.com",
      "Guest User"
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe("completed");
    expect(mockWarn).toHaveBeenCalled();
  });

  it("rejects API-key purchases when autonomous guardrails block the order", async () => {
    mockEnforceAutonomousCommerceGuardrails.mockResolvedValue({
      allowed: false,
      httpStatus: 403,
      code: "max_order_amount_exceeded",
      error: "Autonomous purchase cap exceeded.",
    });

    const result = await handleAuthenticatedCheckout(
      createMockSupabase() as never,
      {
        id: "listing-1",
        seller_id: "seller-2",
        price: 250,
        pricing_type: "one_time",
        listing_type: "agent",
        slug: "agent-listing",
      },
      "buyer-1",
      "api_key"
    );

    expect(result.success).toBe(false);
    expect(result.httpStatus).toBe(403);
    expect(result.error).toMatch(/cap/i);
  });
});
