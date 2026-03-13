import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateClient = vi.fn();
const mockWarn = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 30, remaining: 29, reset: 60 })),
  RATE_LIMITS: { api: { limit: 30, windowMs: 60_000 } },
  rateLimitHeaders: vi.fn(() => ({})),
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

import { POST } from "./route";

const ORIGINAL_ENFORCE_SELLER_VERIFICATION =
  process.env.ENFORCE_SELLER_VERIFICATION;

function createMockSupabase(insertedPayloads: Record<string, unknown>[]) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
      }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: "user-1", is_seller: false, seller_verified: false },
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
            insertedPayloads.push(payload);
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: "listing-1", ...payload },
                    error: null,
                  }),
              }),
            };
          },
        };
      }

      return {};
    },
  };
}

function makeRequest(): NextRequest {
  return new NextRequest("https://aimarketcap.tech/api/marketplace/listings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Test Listing",
      description: "Listing description",
      listing_type: "agent",
    }),
  });
}

describe("POST /api/marketplace/listings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENFORCE_SELLER_VERIFICATION;
  });

  afterEach(() => {
    if (ORIGINAL_ENFORCE_SELLER_VERIFICATION === undefined) {
      delete process.env.ENFORCE_SELLER_VERIFICATION;
    } else {
      process.env.ENFORCE_SELLER_VERIFICATION =
        ORIGINAL_ENFORCE_SELLER_VERIFICATION;
    }
  });

  it("creates unverified seller listings as drafts when enforcement is enabled", async () => {
    process.env.ENFORCE_SELLER_VERIFICATION = "true";
    const insertedPayloads: Record<string, unknown>[] = [];
    mockCreateClient.mockResolvedValue(createMockSupabase(insertedPayloads));

    const response = await POST(makeRequest());

    expect(response.status).toBe(201);
    expect(insertedPayloads[0]?.status).toBe("draft");
  });

  it("keeps the legacy active publish path temporarily and logs a deprecation warning when enforcement is off", async () => {
    const insertedPayloads: Record<string, unknown>[] = [];
    mockCreateClient.mockResolvedValue(createMockSupabase(insertedPayloads));

    const response = await POST(makeRequest());

    expect(response.status).toBe(201);
    expect(insertedPayloads[0]?.status).toBe("active");
    expect(mockWarn).toHaveBeenCalled();
  });
});
