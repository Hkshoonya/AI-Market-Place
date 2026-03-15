import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateServerClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 30, remaining: 29, reset: 60 })),
  RATE_LIMITS: { write: { limit: 30, windowMs: 60_000 } },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  ),
}));

import { GET } from "./route";

function createSupabase(options: {
  userId: string;
  isAdmin?: boolean;
  order?: Record<string, unknown> | null;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: options.userId } },
      }),
    },
    from: (table: string) => {
      if (table === "marketplace_orders") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data:
                    options.order ?? {
                      id: "order-1",
                      buyer_id: "buyer-1",
                      seller_id: "seller-1",
                      fulfillment_manifest_snapshot: {
                        schema_version: "1.0",
                        listing_slug: "agent-protocol-kit",
                        fulfillment_type: "agent_package",
                      },
                    },
                  error: null,
                }),
            }),
          }),
        };
      }

      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { is_admin: options.isAdmin === true },
                  error: null,
                }),
            }),
          }),
        };
      }

      return {};
    },
  };
}

describe("GET /api/marketplace/orders/[id]/manifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows the buyer to read the order fulfillment manifest", async () => {
    mockCreateServerClient.mockResolvedValue(
      createSupabase({ userId: "buyer-1" })
    );

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/marketplace/orders/order-1/manifest"),
      { params: Promise.resolve({ id: "order-1" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.manifest).toEqual(
      expect.objectContaining({
        listing_slug: "agent-protocol-kit",
      })
    );
  });

  it("allows admins to read any order fulfillment manifest", async () => {
    mockCreateServerClient.mockResolvedValue(
      createSupabase({ userId: "admin-1", isAdmin: true })
    );

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/marketplace/orders/order-1/manifest"),
      { params: Promise.resolve({ id: "order-1" }) }
    );

    expect(response.status).toBe(200);
  });

  it("rejects unrelated users", async () => {
    mockCreateServerClient.mockResolvedValue(
      createSupabase({ userId: "other-user", isAdmin: false })
    );

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/marketplace/orders/order-1/manifest"),
      { params: Promise.resolve({ id: "order-1" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/permission|access/i);
  });
});
