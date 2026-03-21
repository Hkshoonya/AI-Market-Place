import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { public: {}, write: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) => {
    throw error;
  }),
}));

import { createClient } from "@/lib/supabase/server";
import { GET, PATCH } from "./route";

const mockCreateClient = vi.mocked(createClient);

describe("/api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sanitizes unsafe notification links before returning them", async () => {
    const notificationsSelect = vi.fn().mockResolvedValue({
      data: [
        {
          id: "notif-1",
          user_id: "user-1",
          type: "marketplace",
          title: "Safe",
          message: null,
          link: "/orders/order-1",
          is_read: false,
          created_at: "2026-03-20T10:00:00.000Z",
        },
        {
          id: "notif-2",
          user_id: "user-1",
          type: "system",
          title: "Unsafe",
          message: null,
          link: "https://evil.test",
          is_read: false,
          created_at: "2026-03-20T09:00:00.000Z",
        },
      ],
      error: null,
    });
    const unreadCountSelect = vi.fn().mockResolvedValue({ count: 4, error: null });

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table === "notifications") {
          return {
            select: vi.fn((_query?: string, options?: { count?: string; head?: boolean }) => {
              if (options?.head) {
                return {
                  eq: vi.fn(() => ({
                    eq: unreadCountSelect,
                  })),
                };
              }

              return {
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: notificationsSelect,
                  })),
                })),
              };
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/notifications?limit=2")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.unreadCount).toBe(4);
    expect(body.data[0].link).toBe("/orders/order-1");
    expect(body.data[1].link).toBeNull();
  });

  it("marks a bounded set of ids as read for the signed-in user", async () => {
    const updateEq = vi.fn(() => ({
      in: vi.fn().mockResolvedValue({ error: null }),
    }));

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table === "notifications") {
          return {
            update: vi.fn(() => ({
              eq: updateEq,
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await PATCH(
      new NextRequest("https://aimarketcap.tech/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({
          ids: [
            "550e8400-e29b-41d4-a716-446655440000",
            "550e8400-e29b-41d4-a716-446655440001",
          ],
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(updateEq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
