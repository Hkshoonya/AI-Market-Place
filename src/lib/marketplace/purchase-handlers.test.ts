import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockWarn = vi.fn();
const mockDeliverDigitalGood = vi.fn();

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
  createPurchaseEscrow: vi.fn(),
  completePurchaseEscrow: vi.fn(),
}));

vi.mock("@/lib/payments/wallet", () => ({
  getOrCreateWallet: vi.fn(),
  getWalletBalance: vi.fn(),
}));

import { handleGuestCheckout } from "./purchase-handlers";

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
});
