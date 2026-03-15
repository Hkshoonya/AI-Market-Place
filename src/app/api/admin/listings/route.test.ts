import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
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

import { GET } from "./route";

function createSessionClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "admin-1" } },
      }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { is_admin: true },
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

function createAdminClient() {
  return {
    from: (table: string) => {
      if (table === "marketplace_listings") {
        return {
          select: () => ({
            order: () => ({
              range: async () => ({
                data: [
                  {
                    id: "listing-1",
                    slug: "listing-1",
                    title: "Listing One",
                    listing_type: "agent",
                    status: "active",
                    pricing_type: "one_time",
                    price: 15,
                    avg_rating: null,
                    review_count: 0,
                    view_count: 10,
                    inquiry_count: 0,
                    is_featured: false,
                    created_at: "2026-03-13T00:00:00.000Z",
                    seller_id: "seller-1",
                  },
                ],
                count: 1,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "profiles") {
        return {
          select: () => ({
            in: async () => ({
              data: [{ id: "seller-1", display_name: "Seller", username: "seller" }],
              error: null,
            }),
          }),
        };
      }

      if (table === "listing_policy_reviews") {
        return {
          select: () => ({
            in: () => ({
              order: async () => ({
                data: [
                  {
                    listing_id: "listing-1",
                    decision: "review",
                    classifier_label: "suspicious_capability",
                    review_status: "open",
                    created_at: "2026-03-13T01:00:00.000Z",
                    content_risk_level: "review",
                    autonomy_risk_level: "block",
                    purchase_mode: "manual_review_required",
                    autonomy_mode: "autonomous_blocked",
                    reason_codes: ["suspicious_capability"],
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("GET /api/admin/listings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(createSessionClient());
    mockCreateAdminClient.mockReturnValue(createAdminClient());
  });

  it("includes the latest policy review summary for listings", async () => {
    const response = await GET(new NextRequest("https://aimarketcap.tech/api/admin/listings"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0]?.policy_review).toEqual({
      decision: "review",
      label: "suspicious_capability",
      review_status: "open",
      created_at: "2026-03-13T01:00:00.000Z",
      content_risk_level: "review",
      autonomy_risk_level: "block",
      purchase_mode: "manual_review_required",
      autonomy_mode: "autonomous_blocked",
      reason_codes: ["suspicious_capability"],
    });
  });
});
