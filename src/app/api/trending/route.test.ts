import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { public: { windowMs: 60_000, max: 60 } },
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  rateLimitHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) => {
    throw error;
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import { GET } from "./route";

const createClientMock = vi.mocked(createClient);

function createMockSupabase() {
  const activeModels = [
    {
      id: "openai-low-context",
      slug: "gpt-image",
      name: "gpt-image",
      provider: "OpenAI",
      category: "image",
      overall_rank: 12,
      quality_score: 0,
      capability_score: null,
      popularity_score: 55,
      adoption_score: 53.3,
      economic_footprint_score: 15.7,
      hf_downloads: 0,
      hf_likes: 0,
      hf_trending_score: 0,
      release_date: null,
      created_at: "2026-03-30T04:56:23.444611+00:00",
      parameter_count: null,
      is_open_weights: false,
    },
    {
      id: "microsoft-release",
      slug: "harrier-oss-v1-27b",
      name: "harrier-oss-v1-27b",
      provider: "Microsoft",
      category: "llm",
      overall_rank: 18,
      quality_score: 30.2,
      capability_score: 41.5,
      popularity_score: 40,
      adoption_score: 42.7,
      economic_footprint_score: 11.3,
      hf_downloads: 0,
      hf_likes: 0,
      hf_trending_score: 0,
      release_date: "2026-03-30",
      created_at: "2026-03-30T16:58:51.385568+00:00",
      parameter_count: null,
      is_open_weights: true,
    },
    {
      id: "meta-popular",
      slug: "llama-3-1-8b-instruct",
      name: "Llama-3.1-8B-Instruct",
      provider: "meta-llama",
      category: "llm",
      overall_rank: 8,
      quality_score: 76,
      capability_score: 74,
      popularity_score: 87,
      adoption_score: 65,
      economic_footprint_score: 40,
      hf_downloads: 120_000,
      hf_likes: 2_500,
      hf_trending_score: 220,
      release_date: "2026-02-01",
      created_at: "2026-02-01T00:00:00.000000+00:00",
      parameter_count: null,
      is_open_weights: true,
    },
  ];

  return {
    from: (table: string) => {
      if (table === "models") {
        return {
          select: () => ({
            eq: () => ({
              data: activeModels,
              error: null,
            }),
          }),
        };
      }

      if (table === "model_news") {
        return {
          select: () => ({
            gte: () => ({
              not: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [],
                    error: null,
                  }),
                }),
              }),
              order: () => ({
                limit: async () => ({
                  data: [],
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
}

describe("GET /api/trending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    createClientMock.mockReturnValue(createMockSupabase() as never);
  });

  it("filters low-context created-at-only rows from recent and normalizes provider names", async () => {
    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/trending?limit=8")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recent.map((model: { slug: string }) => model.slug)).toEqual([
      "harrier-oss-v1-27b",
      "llama-3-1-8b-instruct",
    ]);
    expect(body.recent.find((model: { slug: string }) => model.slug === "gpt-image")).toBeFalsy();
    expect(body.popular[0]).toEqual(
      expect.objectContaining({
        slug: "llama-3-1-8b-instruct",
        provider: "Meta",
      })
    );
  });
});
