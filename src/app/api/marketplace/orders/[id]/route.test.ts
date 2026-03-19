import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCompletePurchaseEscrow = vi.fn();
const mockRefundPurchaseEscrow = vi.fn();
const mockDeliverDigitalGood = vi.fn();
const mockError = vi.fn();
const mockCreateClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 20, remaining: 19, reset: 60 })),
  RATE_LIMITS: {
    write: { limit: 20, windowMs: 60_000 },
  },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/marketplace/escrow", () => ({
  completePurchaseEscrow: (...args: unknown[]) => mockCompletePurchaseEscrow(...args),
  refundPurchaseEscrow: (...args: unknown[]) => mockRefundPurchaseEscrow(...args),
}));

vi.mock("@/lib/marketplace/delivery", () => ({
  deliverDigitalGood: (...args: unknown[]) => mockDeliverDigitalGood(...args),
}));

vi.mock("@/lib/logging", () => ({
  systemLog: {
    error: (...args: unknown[]) => mockError(...args),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

function createSupabaseClient({
  userId = "seller-1",
  order = {
    id: "order-1",
    seller_id: "seller-1",
    buyer_id: "buyer-1",
    listing_id: "listing-1",
    status: "approved",
  },
  updateResult = {
    id: "order-1",
    status: "completed",
  },
}: {
  userId?: string | null;
  order?: Record<string, unknown> | null;
  updateResult?: Record<string, unknown>;
}) {
  const updateBuilder = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: updateResult, error: null }),
  };
  const marketplaceOrdersTable = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: order, error: null }),
        }),
        single: vi.fn().mockResolvedValue({ data: order, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue(updateBuilder),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "marketplace_orders") {
        return marketplaceOrdersTable;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("PATCH /api/marketplace/orders/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(createSupabaseClient({}));
    mockCompletePurchaseEscrow.mockResolvedValue(undefined);
    mockRefundPurchaseEscrow.mockResolvedValue(undefined);
    mockDeliverDigitalGood.mockResolvedValue({
      success: true,
      deliveryType: "agent",
      data: { agent_id: "agent-1" },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not mark an order completed when delivery fails", async () => {
    const supabase = createSupabaseClient({});
    mockCreateClient.mockResolvedValueOnce(supabase);
    mockDeliverDigitalGood.mockResolvedValueOnce({
      success: false,
      deliveryType: "agent",
      error: "Provisioning failed",
    });

    const { PATCH } = await import("./route");

    const response = await PATCH(
      new NextRequest("https://aimarketcap.tech/api/marketplace/orders/order-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      }),
      { params: Promise.resolve({ id: "order-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Provisioning failed");
    expect(mockCompletePurchaseEscrow).toHaveBeenCalledWith("order-1");
    const ordersTable = supabase.from.mock.results[0]?.value;
    expect(ordersTable.update).not.toHaveBeenCalled();
  });

  it("marks an order completed only after escrow and delivery succeed", async () => {
    const supabase = createSupabaseClient({});
    mockCreateClient.mockResolvedValueOnce(supabase);

    const { PATCH } = await import("./route");

    const response = await PATCH(
      new NextRequest("https://aimarketcap.tech/api/marketplace/orders/order-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      }),
      { params: Promise.resolve({ id: "order-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockCompletePurchaseEscrow).toHaveBeenCalledWith("order-1");
    expect(mockDeliverDigitalGood).toHaveBeenCalledWith(
      "order-1",
      "listing-1",
      "buyer-1"
    );
    const ordersTable = supabase.from.mock.results[0]?.value;
    expect(ordersTable.update).toHaveBeenCalledTimes(1);
  });
});
