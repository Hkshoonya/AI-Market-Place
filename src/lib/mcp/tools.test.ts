import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHandleAuthenticatedCheckout = vi.fn();

vi.mock("@/lib/marketplace/purchase-handlers", () => ({
  handleAuthenticatedCheckout: (...args: unknown[]) =>
    mockHandleAuthenticatedCheckout(...args),
}));

import { executeTool } from "./tools";

function createMockSupabase() {
  return {
    from: (table: string) => {
      if (table === "models") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      slug: "google-deepmind-sonnet",
                      name: "Sonnet",
                      provider: "Google",
                      category: "llm",
                      description: "TensorFlow-based neural network library",
                      short_description: null,
                      quality_score: 84,
                      hf_downloads: 1_000_000,
                      overall_rank: 12,
                      is_open_weights: false,
                    },
                  ],
                  error: null,
                }),
              }),
              single: async () => ({
                data: {
                  slug: "google-deepmind-sonnet",
                  name: "Sonnet",
                  provider: "Google",
                  category: "llm",
                  description: "TensorFlow-based neural network library",
                  short_description: null,
                  benchmark_scores: [],
                  model_pricing: [],
                  elo_ratings: [],
                  rankings: [],
                },
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

describe("MCP model tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cleaned display descriptions for search_models", async () => {
    const result = await executeTool(
      createMockSupabase() as never,
      "search_models",
      { limit: 1 }
    );

    expect(result).toEqual(
      expect.objectContaining({
        models: [
          expect.objectContaining({
            slug: "google-deepmind-sonnet",
            display_description: expect.stringMatching(/Google llm model/i),
          }),
        ],
      })
    );
  });

  it("returns cleaned display descriptions for get_model", async () => {
    const result = await executeTool(
      createMockSupabase() as never,
      "get_model",
      { slug: "google-deepmind-sonnet" }
    );

    expect(result).toEqual(
      expect.objectContaining({
        slug: "google-deepmind-sonnet",
        display_description: expect.stringMatching(/Google llm model/i),
      })
    );
  });

  it("routes MCP purchases through the shared authenticated checkout flow", async () => {
    mockHandleAuthenticatedCheckout.mockResolvedValue({
      success: true,
      orderId: "order-1",
      status: "completed",
      escrowId: "escrow-1",
      delivery: { type: "api_access", data: { key_prefix: "aimk_saved" } },
      payment: null,
      httpStatus: 201,
      message: "ok",
    });

    const supabase = {
      from: (table: string) => {
        if (table === "marketplace_listings") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: "listing-1",
                      seller_id: "seller-1",
                      price: 19,
                      pricing_type: "one_time",
                      listing_type: "api_access",
                      status: "active",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    const result = await executeTool(
      supabase as never,
      "purchase",
      { listing_id: "listing-1" },
      { owner_id: "buyer-1", scopes: ["marketplace"] }
    );

    expect(mockHandleAuthenticatedCheckout).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        id: "listing-1",
        seller_id: "seller-1",
        pricing_type: "one_time",
        listing_type: "api_access",
        slug: "listing-1",
      }),
      "buyer-1",
      "api_key"
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: "order-1",
        status: "completed",
        escrow_id: "escrow-1",
      })
    );
  });
});
