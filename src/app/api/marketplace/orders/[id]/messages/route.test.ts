import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { public: {}, write: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) => {
    throw error;
  }),
}));

vi.mock("@/lib/logging", () => ({
  systemLog: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/schemas/parse", () => ({
  parseQueryResult: vi.fn((response: { data: unknown[] | null }) => response.data ?? []),
  parseQueryResultSingle: vi.fn((response: { data: unknown | null }) => response.data),
}));

import { createClient } from "@/lib/supabase/server";
import { GET, POST } from "./route";

const mockCreateClient = vi.mocked(createClient);

function createOrderLookup(order: { id: string; buyer_id: string; seller_id: string } | null) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: order, error: null }),
      })),
    })),
  };
}

describe("marketplace order messages route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects message reads for users outside the order", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "intruder" } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "marketplace_orders") {
          return createOrderLookup({
            id: "order-1",
            buyer_id: "buyer-1",
            seller_id: "seller-1",
          });
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/marketplace/orders/order-1/messages"),
      { params: Promise.resolve({ id: "order-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatch(/do not have access/i);
  });

  it("sends trimmed messages for order participants and notifies the counterparty", async () => {
    const notificationsInsert = vi.fn().mockResolvedValue({ error: null });
    const messageInsertSingle = vi.fn().mockResolvedValue({
      data: {
        id: "msg-1",
        order_id: "order-1",
        sender_id: "buyer-1",
        content: "hello seller",
        is_read: false,
        created_at: "2026-03-20T12:30:00.000Z",
      },
      error: null,
    });
    const orderMessagesInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: messageInsertSingle,
      }),
    });
    const profileSingle = vi.fn().mockResolvedValue({
      data: {
        id: "buyer-1",
        display_name: "Buyer",
        avatar_url: null,
        username: "buyer",
      },
      error: null,
    });

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "buyer-1" } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "marketplace_orders") {
          return createOrderLookup({
            id: "order-1",
            buyer_id: "buyer-1",
            seller_id: "seller-1",
          });
        }

        if (table === "order_messages") {
          return {
            insert: orderMessagesInsert,
          };
        }

        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: profileSingle,
              })),
            })),
          };
        }

        if (table === "notifications") {
          return {
            insert: notificationsInsert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/orders/order-1/messages", {
        method: "POST",
        body: JSON.stringify({ content: "  hello seller  " }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "order-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(orderMessagesInsert).toHaveBeenCalledWith({
      order_id: "order-1",
      sender_id: "buyer-1",
      content: "hello seller",
    });
    expect(notificationsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "seller-1",
        type: "order_update",
        title: "New message on your order",
        message: "hello seller",
        link: "/orders/order-1",
      })
    );
    expect(body.data).toEqual(
      expect.objectContaining({
        id: "msg-1",
        content: "hello seller",
        profiles: expect.objectContaining({
          id: "buyer-1",
          display_name: "Buyer",
        }),
      })
    );
  });
});
