import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { public: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimit: vi.fn(async () => ({ success: true })),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/middleware/api-paywall", () => ({
  checkPaywall: vi.fn(async () => ({ allowed: true })),
  paywallErrorResponse: vi.fn(),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) => {
    throw error;
  }),
}));

import { createClient } from "@supabase/supabase-js";
import { GET } from "./route";

function createQuery<T>(data: T) {
  const query = {
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: T; error: null }) => unknown) =>
      Promise.resolve(resolve({ data, error: null })),
  };

  return query;
}

describe("GET /api/rankings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("returns canonical arena families and deduplicated model families", async () => {
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "models") {
          return {
            select: vi.fn(() =>
              createQuery([
                {
                  id: "model-1",
                  slug: "openai-o3",
                  name: "o3",
                  provider: "OpenAI",
                  category: "llm",
                  overall_rank: 1,
                  parameter_count: null,
                  is_open_weights: false,
                  hf_downloads: 1000,
                  quality_score: 91,
                  capability_score: 96,
                  capability_rank: 1,
                  adoption_score: 80,
                  adoption_rank: 1,
                  economic_footprint_score: 87,
                  economic_footprint_rank: 1,
                  usage_score: 82,
                  usage_rank: 1,
                  expert_score: 90,
                  expert_rank: 1,
                  balanced_rank: 1,
                  popularity_score: 78,
                  popularity_rank: 1,
                  market_cap_estimate: 1200000000,
                  agent_score: 66,
                  agent_rank: 1,
                  value_score: 72,
                  status: "active",
                  benchmark_scores: [],
                  model_pricing: [],
                  elo_ratings: [
                    {
                      arena_name: "Chatbot Arena",
                      elo_score: 1400,
                      snapshot_date: "2026-03-17T00:00:00.000Z",
                      num_battles: 1000,
                    },
                    {
                      arena_name: "chatbot-arena",
                      elo_score: 1390,
                      snapshot_date: "2026-03-10T00:00:00.000Z",
                      num_battles: 900,
                    },
                  ],
                },
                {
                  id: "model-2",
                  slug: "openai-o3-2026-03-01",
                  name: "o3",
                  provider: "OpenAI",
                  category: "llm",
                  overall_rank: 3,
                  parameter_count: null,
                  is_open_weights: false,
                  hf_downloads: 400,
                  quality_score: 88,
                  capability_score: 92,
                  capability_rank: 3,
                  adoption_score: 72,
                  adoption_rank: 3,
                  economic_footprint_score: 79,
                  economic_footprint_rank: 3,
                  usage_score: 75,
                  usage_rank: 3,
                  expert_score: 82,
                  expert_rank: 3,
                  balanced_rank: 3,
                  popularity_score: 68,
                  popularity_rank: 3,
                  market_cap_estimate: 980000000,
                  agent_score: 61,
                  agent_rank: 3,
                  value_score: 70,
                  status: "active",
                  benchmark_scores: [],
                  model_pricing: [],
                  elo_ratings: [],
                },
              ])
            ),
          };
        }

        if (table === "benchmark_scores" || table === "elo_ratings") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({ data: [], error: null })),
            })),
          };
        }

        if (table === "model_news") {
          return {
            select: vi.fn(() => ({
              overlaps: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/rankings?lens=capability&limit=10")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lens).toBe("capability");
    expect(body.data).toHaveLength(1);
    expect(body.data[0].slug).toBe("openai-o3");
    expect(body.data[0]).toHaveProperty("benchmark_tracking");
    expect(body.data[0].elo_ratings).toEqual([
      expect.objectContaining({
        displayName: "Chatbot Arena",
        variantCount: 2,
      }),
    ]);
  });

  it("accepts economic_footprint as a compatible lens alias", async () => {
    const from = vi.fn(() => ({
      select: vi.fn(() => createQuery([])),
    }));

    vi.mocked(createClient).mockReturnValue({ from } as never);

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/rankings?lens=economic_footprint")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lens).toBe("economic_footprint");
    expect(from).toHaveBeenCalledWith("models");
  });

  it("enforces active-only rankings by default and broadens only when lifecycle=all", async () => {
    const defaultQuery = createQuery([]);
    const allQuery = createQuery([]);
    const select = vi
      .fn()
      .mockReturnValueOnce(defaultQuery)
      .mockReturnValueOnce(allQuery);
    const from = vi.fn((table: string) => {
      if (table === "models") return { select };
      if (table === "benchmark_scores" || table === "elo_ratings") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: [], error: null })),
          })),
        };
      }
      if (table === "model_news") {
        return {
          select: vi.fn(() => ({
            overlaps: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: [], error: null })),
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    vi.mocked(createClient).mockReturnValue({ from } as never);

    const defaultResponse = await GET(
      new NextRequest("https://aimarketcap.tech/api/rankings?lens=capability&limit=10")
    );
    const allResponse = await GET(
      new NextRequest("https://aimarketcap.tech/api/rankings?lens=capability&lifecycle=all&limit=10")
    );

    expect(defaultResponse.status).toBe(200);
    expect(await defaultResponse.json()).toMatchObject({ lifecycle: "active" });
    expect(defaultQuery.eq).toHaveBeenCalledWith("status", "active");
    expect(defaultQuery.in).not.toHaveBeenCalledWith("status", expect.anything());

    expect(allResponse.status).toBe(200);
    expect(await allResponse.json()).toMatchObject({ lifecycle: "all" });
    expect(allQuery.in).toHaveBeenCalledWith(
      "status",
      expect.arrayContaining(["active", "preview", "beta", "deprecated", "archived"])
    );
  });

  it("applies category scoping alongside the default active-first ranking filter", async () => {
    const categoryQuery = createQuery([]);
    const from = vi.fn((table: string) => {
      if (table === "models") {
        return {
          select: vi.fn(() => categoryQuery),
        };
      }
      if (table === "benchmark_scores" || table === "elo_ratings") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: [], error: null })),
          })),
        };
      }
      if (table === "model_news") {
        return {
          select: vi.fn(() => ({
            overlaps: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: [], error: null })),
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    vi.mocked(createClient).mockReturnValue({ from } as never);

    const response = await GET(
      new NextRequest(
        "https://aimarketcap.tech/api/rankings?lens=capability&category=agentic_browser&limit=10"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lifecycle).toBe("active");
    expect(categoryQuery.eq).toHaveBeenCalledWith("status", "active");
    expect(categoryQuery.eq).toHaveBeenCalledWith("category", "agentic_browser");
  });
});
