import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockAuthenticateApiKey = vi.fn();
const mockCreateAdminClient = vi.fn();

vi.mock("@/lib/agents/auth", () => ({
  authenticateApiKey: (...args: unknown[]) => mockAuthenticateApiKey(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 30, remaining: 29, reset: 60 })),
  RATE_LIMITS: { api: { limit: 30, windowMs: 60_000 } },
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

import { PATCH } from "./route";

function createBenignAdminClient() {
  return {
    from: (table: string) => {
      if (table === "api_keys") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: "key-1",
                      owner_id: "owner-1",
                      scopes: ["marketplace"],
                      is_active: true,
                      expires_at: "2026-12-31T00:00:00.000Z",
                    },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }

      if (table === "marketplace_listings") {
        return {
          update: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: {
                        id: "listing-1",
                        slug: "test-bot-listing",
                        title: "Bot Listing",
                        price: 7,
                        pricing_type: "one_time",
                        currency: "USD",
                        updated_at: "2026-03-12T00:00:00.000Z",
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    },
  };
}

describe("PATCH /api/marketplace/listings/[slug]/pricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAdminClient.mockReturnValue(createBenignAdminClient());
    mockAuthenticateApiKey.mockResolvedValue({
      authenticated: false,
      response: Response.json({ error: "API key expired" }, { status: 401 }),
    });
  });

  it("rejects expired API keys via shared auth", async () => {
    const request = new NextRequest(
      "https://aimarketcap.tech/api/marketplace/listings/test-bot-listing/pricing",
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer aimk_expired",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          price: 7,
        }),
      }
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ slug: "test-bot-listing" }),
    });
    const body = await response.json();

    expect(mockAuthenticateApiKey).toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect(body.error).toMatch(/expired/i);
  });
});
