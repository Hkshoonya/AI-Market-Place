import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  systemLog: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  createTaggedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 60, remaining: 59, reset: 60 })),
  RATE_LIMITS: { public: { limit: 60, windowMs: 60_000 }, write: { limit: 30, windowMs: 60_000 } },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/auth/resolve-user", () => ({
  resolveAuthUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { resolveAuthUser } from "@/lib/auth/resolve-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { POST } from "./route";

const resolveAuthUserMock = vi.mocked(resolveAuthUser);
const createAdminClientMock = vi.mocked(createAdminClient);
const createClientMock = vi.mocked(createClient);

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("https://aimarketcap.tech/api/marketplace/orders", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function createServerClient(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
      }),
    },
  };
}

function createAdminClientStub(options?: {
  listing?: {
    seller_id: string;
    price: number | null;
    pricing_type: string;
    status: string;
  } | null;
  existingBuyerOrder?: { id: string } | null;
  existingGuestOrder?: { id: string } | null;
  insertedOrder?: { id: string; listing_id: string } | null;
}) {
  const listing =
    options?.listing ??
    ({
      seller_id: "seller-1",
      price: 0,
      pricing_type: "free",
      status: "active",
    } as const);

  return {
    from: vi.fn((table: string) => {
      if (table === "marketplace_listings") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: listing,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "marketplace_orders") {
        return {
          select: () => ({
            eq: (column: string, value: string) => {
              if (column === "listing_id") {
                return {
                  eq: (nestedColumn: string) => ({
                    in: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({
                          data:
                            nestedColumn === "buyer_id"
                              ? (options?.existingBuyerOrder ?? null)
                              : nestedColumn === "guest_email" && value
                                ? (options?.existingGuestOrder ?? null)
                                : null,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                };
              }

              return {
                in: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: null,
                      error: null,
                    }),
                  }),
                }),
              };
            },
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: options?.insertedOrder ?? {
                  id: "order-1",
                  listing_id: "listing-1",
                },
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("POST /api/marketplace/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthUserMock.mockResolvedValue(null);
    createClientMock.mockResolvedValue(createServerClient(null) as never);
  });

  it("rejects paid listings and points callers to the purchase endpoint", async () => {
    createAdminClientMock.mockReturnValue(
      createAdminClientStub({
        listing: {
          seller_id: "seller-1",
          price: 49,
          pricing_type: "fixed",
          status: "active",
        },
      }) as never
    );

    const response = await POST(
      makeRequest({
        listing_id: "11111111-1111-4111-8111-111111111111",
        guest_email: "buyer@example.com",
        message: "I want access",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/purchase flow/i);
  });

  it("blocks duplicate guest requests for the same listing", async () => {
    createAdminClientMock.mockReturnValue(
      createAdminClientStub({
        existingGuestOrder: { id: "order-existing" },
      }) as never
    );

    const response = await POST(
      makeRequest({
        listing_id: "11111111-1111-4111-8111-111111111111",
        guest_email: "guest@example.com",
        message: "Please grant access",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/already have an active request or order/i);
  });

  it("allows request-only listings to create a pending order record", async () => {
    createAdminClientMock.mockReturnValue(createAdminClientStub() as never);

    const response = await POST(
      makeRequest({
        listing_id: "11111111-1111-4111-8111-111111111111",
        guest_email: "guest@example.com",
        message: "Please grant access",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toEqual(
      expect.objectContaining({
        id: "order-1",
      })
    );
  });

  it("rejects cross-origin order creation for signed-in browser sessions", async () => {
    createClientMock.mockResolvedValue(
      createServerClient({ id: "buyer-1" }) as never
    );
    createAdminClientMock.mockReturnValue(createAdminClientStub() as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({
          listing_id: "11111111-1111-4111-8111-111111111111",
          message: "I want access",
        }),
      })
    );

    expect(response.status).toBe(403);
  });
});
