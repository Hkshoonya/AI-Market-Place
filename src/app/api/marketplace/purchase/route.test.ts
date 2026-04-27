import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true })),
  RATE_LIMITS: { write: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/auth/resolve-user", () => ({
  resolveAuthUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/marketplace/purchase-handlers", () => ({
  handleGuestCheckout: vi.fn(),
  handleAuthenticatedCheckout: vi.fn(),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  ),
}));

import { resolveAuthUser } from "@/lib/auth/resolve-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleAuthenticatedCheckout } from "@/lib/marketplace/purchase-handlers";
import { POST } from "./route";

const resolveAuthUserMock = vi.mocked(resolveAuthUser);
const createAdminClientMock = vi.mocked(createAdminClient);
const handleAuthenticatedCheckoutMock = vi.mocked(handleAuthenticatedCheckout);

function createAdminClientStub() {
  return {
    from: vi.fn((table: string) => {
      if (table !== "marketplace_listings") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: "listing-1",
                  status: "active",
                  seller_id: "seller-1",
                  price: 25,
                  pricing_type: "fixed",
                },
                error: null,
              }),
            }),
          }),
        }),
      };
    }),
  };
}

describe("POST /api/marketplace/purchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects cross-origin browser purchases for signed-in sessions", async () => {
    resolveAuthUserMock.mockResolvedValue({
      userId: "buyer-1",
      authMethod: "session",
    } as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/purchase", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({
          listing_id: "11111111-1111-4111-8111-111111111111",
          payment_method: "balance",
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("keeps API-key purchase calls origin-agnostic for agents", async () => {
    resolveAuthUserMock.mockResolvedValue({
      userId: "buyer-1",
      authMethod: "api_key",
      apiKeyId: "key-1",
      apiKeyScopes: ["marketplace"],
    } as never);
    createAdminClientMock.mockReturnValue(createAdminClientStub() as never);
    handleAuthenticatedCheckoutMock.mockResolvedValue({
      success: true,
      httpStatus: 201,
      orderId: "order-1",
      status: "completed",
      escrowId: "escrow-1",
      delivery: { kind: "download", value: "https://download.example/item.zip" },
      payment: { method: "balance", amount: 25 },
    } as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/purchase", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer aimk_test",
        },
        body: JSON.stringify({
          listing_id: "11111111-1111-4111-8111-111111111111",
          payment_method: "balance",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(handleAuthenticatedCheckoutMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "listing-1" }),
      "buyer-1",
      "api_key"
    );
    expect(body.order_id).toBe("order-1");
  });
});
