import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateServerClient = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockWarn = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 30, remaining: 29, reset: 60 })),
  RATE_LIMITS: {
    api: { limit: 30, windowMs: 60_000 },
    public: { limit: 60, windowMs: 60_000 },
  },
  getClientIp: vi.fn(() => "127.0.0.1"),
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

vi.mock("@/lib/marketplace/enrich-listings", () => ({
  enrichListingWithProfile: vi.fn(),
  PROFILE_FIELDS_FULL: "id, display_name",
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

const ORIGINAL_ENFORCE_SELLER_VERIFICATION =
  process.env.ENFORCE_SELLER_VERIFICATION;

function makeRequest(status: "active" | "paused" | "draft"): NextRequest {
  return new NextRequest(
    "https://aimarketcap.tech/api/marketplace/listings/test-listing",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }
  );
}

function createServerSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "seller-1" } },
      }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { is_admin: false },
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

function createAdminSupabase(updatePayloads: Record<string, unknown>[]) {
  return {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "seller-1",
                    is_seller: true,
                    seller_verified: false,
                  },
                  error: null,
                }),
            }),
          }),
        };
      }

      if (table === "marketplace_listings") {
        return {
          update: (payload: Record<string, unknown>) => {
            updatePayloads.push(payload);
            return {
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: () =>
                      Promise.resolve({
                        data: { id: "listing-1", slug: "test-listing", ...payload },
                        error: null,
                      }),
                  }),
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

describe("PATCH /api/marketplace/listings/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateServerClient.mockResolvedValue(createServerSupabase());
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

  it("forces unverified seller listing status back to draft when enforcement is enabled", async () => {
    process.env.ENFORCE_SELLER_VERIFICATION = "true";
    const updatePayloads: Record<string, unknown>[] = [];
    mockCreateAdminClient.mockReturnValue(createAdminSupabase(updatePayloads));

    const response = await PATCH(makeRequest("active"), {
      params: Promise.resolve({ slug: "test-listing" }),
    });

    expect(response.status).toBe(200);
    expect(updatePayloads[0]?.status).toBe("draft");
  });

  it("keeps the legacy active status path temporarily and logs a warning when enforcement is off", async () => {
    const updatePayloads: Record<string, unknown>[] = [];
    mockCreateAdminClient.mockReturnValue(createAdminSupabase(updatePayloads));

    const response = await PATCH(makeRequest("active"), {
      params: Promise.resolve({ slug: "test-listing" }),
    });

    expect(response.status).toBe(200);
    expect(updatePayloads[0]?.status).toBe("active");
    expect(mockWarn).toHaveBeenCalled();
  });
});
