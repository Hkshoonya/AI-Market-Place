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
    {
      id: "zai-signal",
      slug: "z-ai-glm-5",
      name: "GLM-5",
      provider: "Z.ai",
      category: "multimodal",
      overall_rank: 55,
      quality_score: 58,
      capability_score: 67,
      popularity_score: 45,
      adoption_score: 39,
      economic_footprint_score: 20,
      hf_downloads: 0,
      hf_likes: 0,
      hf_trending_score: 0,
      release_date: "2026-03-29",
      created_at: "2026-03-29T10:00:00.000000+00:00",
      parameter_count: null,
      is_open_weights: false,
    },
    {
      id: "zai-preview",
      slug: "z-ai-glm-5-preview",
      name: "GLM-5 (Preview)",
      provider: "Z.ai",
      category: "multimodal",
      overall_rank: 30,
      quality_score: 84,
      capability_score: 72,
      popularity_score: 40,
      adoption_score: 35,
      economic_footprint_score: 18,
      hf_downloads: 0,
      hf_likes: 0,
      hf_trending_score: 0,
      release_date: "2026-03-10",
      created_at: "2026-03-10T10:00:00.000000+00:00",
      parameter_count: null,
      is_open_weights: false,
    },
  ];
  const modelNews = [
    {
      id: "deploy-harrier",
      title: "Harrier OSS now has an official self-host path",
      source: "provider-deployment-signals",
      related_provider: "Microsoft",
      related_model_ids: ["microsoft-release"],
      published_at: "2026-03-30T20:00:00.000Z",
      category: "open_source",
      metadata: { signal_type: "open_source", signal_importance: "high" },
    },
    {
      id: "deploy-glm",
      title: "GLM-5 now has an official deployment guide",
      source: "provider-deployment-signals",
      related_provider: "Z.ai",
      related_model_ids: ["zai-signal"],
      published_at: "2026-03-31T20:00:00.000Z",
      category: "api",
      metadata: { signal_type: "api", signal_importance: "medium" },
    },
  ];

  return {
    from: (table: string) => {
      if (table === "models") {
        const result = { data: activeModels, error: null };
        const chain = Object.assign({}, result, {
          eq: () => chain,
          in: () => result,
        });
        return {
          select: () => chain,
        };
      }

      if (table === "model_news") {
        return {
          select: () => ({
            gte: () => ({
              not: () => ({
                order: () => ({
                  limit: async () => ({
                    data: modelNews,
                    error: null,
                  }),
                }),
              }),
              order: () => ({
                limit: async () => ({
                  data: modelNews,
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
      "z-ai-glm-5",
      "harrier-oss-v1-27b",
      "llama-3-1-8b-instruct",
    ]);
    expect(body.recent.find((model: { slug: string }) => model.slug === "gpt-image")).toBeFalsy();
    expect(body.deployable[0]).toEqual(
      expect.objectContaining({
        slug: "z-ai-glm-5",
        recent_signal: expect.objectContaining({
          signalType: "api",
          signalLabel: "API",
        }),
      })
    );
    expect(body.deployable[1]).toEqual(
      expect.objectContaining({
        slug: "harrier-oss-v1-27b",
        recent_signal: expect.objectContaining({
          signalType: "open_source",
          signalLabel: "Open Source",
        }),
      })
    );
    expect(body.popular[0]).toEqual(
      expect.objectContaining({
        slug: "llama-3-1-8b-instruct",
        provider: "Meta",
      })
    );
  });
});
