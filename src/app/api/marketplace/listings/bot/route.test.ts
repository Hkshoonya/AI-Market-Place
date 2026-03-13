import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockAuthenticateApiKey = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockWarn = vi.fn();

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

vi.mock("@/lib/payments/wallet", () => ({
  getOrCreateWallet: vi.fn().mockResolvedValue({ id: "wallet-1" }),
}));

vi.mock("@/lib/logging", () => ({
  systemLog: {
    warn: (...args: unknown[]) => mockWarn(...args),
    info: vi.fn(),
    error: vi.fn(),
  },
  createTaggedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  ),
}));

import { PATCH, POST } from "./route";

const ORIGINAL_ENFORCE_SELLER_VERIFICATION =
  process.env.ENFORCE_SELLER_VERIFICATION;

function createBenignAdminClient(
  options: {
    sellerVerified?: boolean;
    insertedPayloads?: Record<string, unknown>[];
  } = {}
) {
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
                      agent_id: null,
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

      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "owner-1",
                    is_seller: true,
                    seller_verified: options.sellerVerified ?? true,
                  },
                  error: null,
                }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        };
      }

      if (table === "marketplace_listings") {
        return {
          insert: (payload: Record<string, unknown>) => {
            options.insertedPayloads?.push(payload);
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: "listing-1",
                      slug: "test-bot-listing",
                      title: "Bot Listing",
                      ...payload,
                    },
                    error: null,
                  }),
              }),
            };
          },
          update: (payload: Record<string, unknown>) => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: {
                        id: "listing-1",
                        slug: "test-bot-listing",
                        title: "Bot Listing",
                        price: 9,
                        pricing_type: "one_time",
                        currency: "USD",
                        ...payload,
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

describe("/api/marketplace/listings/bot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAdminClient.mockReturnValue(createBenignAdminClient());
    delete process.env.ENFORCE_SELLER_VERIFICATION;
    mockAuthenticateApiKey.mockResolvedValue({
      authenticated: false,
      response: Response.json({ error: "API key expired" }, { status: 401 }),
    });
  });

  afterEach(() => {
    if (ORIGINAL_ENFORCE_SELLER_VERIFICATION === undefined) {
      delete process.env.ENFORCE_SELLER_VERIFICATION;
    } else {
      process.env.ENFORCE_SELLER_VERIFICATION =
        ORIGINAL_ENFORCE_SELLER_VERIFICATION;
    }
  });

  it("rejects expired API keys on listing creation via shared auth", async () => {
    const request = new NextRequest(
      "https://aimarketcap.tech/api/marketplace/listings/bot",
      {
        method: "POST",
        headers: {
          authorization: "Bearer aimk_expired",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Bot Listing",
          description: "Bot-created listing",
          listing_type: "agent",
        }),
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(mockAuthenticateApiKey).toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect(body.error).toMatch(/expired/i);
  });

  it("rejects expired API keys on listing updates via shared auth", async () => {
    const request = new NextRequest(
      "https://aimarketcap.tech/api/marketplace/listings/bot",
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer aimk_expired",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          slug: "test-bot-listing",
          price: 9,
        }),
      }
    );

    const response = await PATCH(request);
    const body = await response.json();

    expect(mockAuthenticateApiKey).toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect(body.error).toMatch(/expired/i);
  });

  it("creates unverified bot listings as drafts when seller verification enforcement is enabled", async () => {
    process.env.ENFORCE_SELLER_VERIFICATION = "true";
    const insertedPayloads: Record<string, unknown>[] = [];
    mockCreateAdminClient.mockReturnValue(
      createBenignAdminClient({
        sellerVerified: false,
        insertedPayloads,
      })
    );
    mockAuthenticateApiKey.mockResolvedValue({
      authenticated: true,
      keyRecord: {
        id: "key-1",
        owner_id: "owner-1",
        agent_id: null,
        scopes: ["marketplace"],
      },
    });

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/listings/bot", {
        method: "POST",
        headers: {
          authorization: "Bearer aimk_valid",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Bot Listing",
          description: "Bot-created listing",
          listing_type: "agent",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(insertedPayloads[0]?.status).toBe("draft");
  });

  it("keeps the legacy bot publish path temporarily and logs a deprecation warning when enforcement is off", async () => {
    const insertedPayloads: Record<string, unknown>[] = [];
    mockCreateAdminClient.mockReturnValue(
      createBenignAdminClient({
        sellerVerified: false,
        insertedPayloads,
      })
    );
    mockAuthenticateApiKey.mockResolvedValue({
      authenticated: true,
      keyRecord: {
        id: "key-1",
        owner_id: "owner-1",
        agent_id: null,
        scopes: ["marketplace"],
      },
    });

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/listings/bot", {
        method: "POST",
        headers: {
          authorization: "Bearer aimk_valid",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Bot Listing",
          description: "Bot-created listing",
          listing_type: "agent",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(insertedPayloads[0]?.status).toBe("active");
    expect(mockWarn).toHaveBeenCalled();
  });

  it("forces bot listing updates back to draft when an unverified seller tries to publish under enforcement", async () => {
    process.env.ENFORCE_SELLER_VERIFICATION = "true";
    mockCreateAdminClient.mockReturnValue(
      createBenignAdminClient({
        sellerVerified: false,
      })
    );
    mockAuthenticateApiKey.mockResolvedValue({
      authenticated: true,
      keyRecord: {
        id: "key-1",
        owner_id: "owner-1",
        agent_id: null,
        scopes: ["marketplace"],
      },
    });

    const response = await PATCH(
      new NextRequest("https://aimarketcap.tech/api/marketplace/listings/bot", {
        method: "PATCH",
        headers: {
          authorization: "Bearer aimk_valid",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          slug: "test-bot-listing",
          status: "active",
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("draft");
  });

  it("keeps the legacy bot update publish path temporarily and logs when enforcement is off", async () => {
    mockCreateAdminClient.mockReturnValue(
      createBenignAdminClient({
        sellerVerified: false,
      })
    );
    mockAuthenticateApiKey.mockResolvedValue({
      authenticated: true,
      keyRecord: {
        id: "key-1",
        owner_id: "owner-1",
        agent_id: null,
        scopes: ["marketplace"],
      },
    });

    const response = await PATCH(
      new NextRequest("https://aimarketcap.tech/api/marketplace/listings/bot", {
        method: "PATCH",
        headers: {
          authorization: "Bearer aimk_valid",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          slug: "test-bot-listing",
          status: "active",
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("active");
    expect(mockWarn).toHaveBeenCalled();
  });
});
