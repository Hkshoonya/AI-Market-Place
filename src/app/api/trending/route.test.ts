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
      license: "open_source",
      license_name: "MIT",
      context_window: 131072,
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
      license: "open_source",
      license_name: "Llama Community License",
      context_window: 131072,
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
      context_window: 202752,
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
    {
      id: "old-deploy-only",
      slug: "minimax-m2-5",
      name: "MiniMax M2.5",
      provider: "MiniMax",
      category: "llm",
      overall_rank: 40,
      quality_score: 70,
      capability_score: 74,
      popularity_score: 48,
      adoption_score: 54,
      economic_footprint_score: 36,
      hf_downloads: 0,
      hf_likes: 0,
      hf_trending_score: 0,
      release_date: "2026-02-12",
      created_at: "2026-02-28T19:35:17.301715+00:00",
      parameter_count: null,
      is_open_weights: false,
    },
    {
      id: "minimax-base",
      slug: "minimax-minimax-m2-7",
      name: "MiniMax M2.7",
      provider: "MiniMax",
      category: "llm",
      overall_rank: 26,
      quality_score: 76,
      capability_score: 77,
      popularity_score: 52,
      adoption_score: 47,
      economic_footprint_score: 24,
      hf_downloads: 0,
      hf_likes: 0,
      hf_trending_score: 0,
      release_date: "2026-03-20",
      created_at: "2026-03-20T08:00:00.000000+00:00",
      parameter_count: null,
      is_open_weights: true,
      license: "open_source",
      license_name: "Apache 2.0",
      context_window: 131072,
    },
    {
      id: "minimax-highspeed",
      slug: "minimax-minimax-m2-7-highspeed",
      name: "MiniMax M2.7 Highspeed",
      provider: "MiniMax",
      category: "llm",
      overall_rank: 32,
      quality_score: 70,
      capability_score: 73,
      popularity_score: 46,
      adoption_score: 40,
      economic_footprint_score: 18,
      hf_downloads: 0,
      hf_likes: 0,
      hf_trending_score: 0,
      release_date: "2026-04-01",
      created_at: "2026-04-01T08:00:00.000000+00:00",
      parameter_count: null,
      is_open_weights: true,
      license: "open_source",
      license_name: "Apache 2.0",
      context_window: 131072,
    },
    {
      id: "gemma-4-31b",
      slug: "google-gemma-4-31b-it",
      name: "Gemma 4 31B IT",
      provider: "Google",
      category: "multimodal",
      overall_rank: 24,
      quality_score: 79,
      capability_score: 77,
      popularity_score: 58,
      adoption_score: 49,
      economic_footprint_score: 28,
      hf_downloads: 0,
      hf_likes: 0,
      hf_trending_score: 0,
      release_date: "2026-04-01",
      created_at: "2026-04-01T08:00:00.000000+00:00",
      parameter_count: null,
      is_open_weights: true,
      license: "open_source",
      license_name: "Apache 2.0",
      context_window: 128000,
    },
    {
      id: "gemma-4-27b",
      slug: "google-gemma-4-27b-it",
      name: "Gemma 4 27B IT",
      provider: "Google",
      category: "multimodal",
      overall_rank: 28,
      quality_score: 75,
      capability_score: 74,
      popularity_score: 56,
      adoption_score: 46,
      economic_footprint_score: 25,
      hf_downloads: 0,
      hf_likes: 0,
      hf_trending_score: 0,
      release_date: "2026-04-01",
      created_at: "2026-04-01T08:00:00.000000+00:00",
      parameter_count: null,
      is_open_weights: true,
      license: "open_source",
      license_name: "Apache 2.0",
      context_window: 128000,
    },
    {
      id: "qwen-main",
      slug: "qwen-qwen3-5-122b-a10b",
      name: "Qwen3.5 122B A10B",
      provider: "Qwen",
      category: "llm",
      overall_rank: 20,
      quality_score: 81,
      capability_score: 79,
      popularity_score: 59,
      adoption_score: 44,
      economic_footprint_score: 24,
      hf_downloads: 0,
      hf_likes: 0,
      hf_trending_score: 0,
      release_date: "2026-03-25",
      created_at: "2026-03-25T08:00:00.000000+00:00",
      parameter_count: null,
      is_open_weights: true,
      license: "open_source",
      license_name: "Apache 2.0",
      context_window: 262144,
    },
    {
      id: "qwen-gguf",
      slug: "unsloth-qwen3-5-122b-a10b-gguf",
      name: "Qwen3.5-122B-A10B-GGUF",
      provider: "Unsloth",
      category: "llm",
      overall_rank: 36,
      quality_score: 63,
      capability_score: 60,
      popularity_score: 41,
      adoption_score: 28,
      economic_footprint_score: 10,
      hf_downloads: 0,
      hf_likes: 0,
      hf_trending_score: 0,
      release_date: "2026-03-25",
      created_at: "2026-03-25T08:00:00.000000+00:00",
      parameter_count: null,
      is_open_weights: true,
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
    {
      id: "deploy-old-minimax",
      title: "MiniMax M2.5 now has a new deployment guide",
      source: "provider-deployment-signals",
      related_provider: "MiniMax",
      related_model_ids: ["old-deploy-only"],
      published_at: "2026-03-31T21:00:00.000Z",
      category: "api",
      metadata: { signal_type: "api", signal_importance: "medium" },
    },
    {
      id: "deploy-qwen-main",
      title: "Qwen3.5 122B A10B is now available on Ollama",
      source: "ollama-library",
      related_provider: "Qwen",
      related_model_ids: ["qwen-main"],
      published_at: "2026-03-31T19:00:00.000Z",
      category: "open_source",
      metadata: { signal_type: "open_source", signal_importance: "medium" },
    },
    {
      id: "deploy-qwen-gguf",
      title: "Qwen3.5-122B-A10B-GGUF is now available on Ollama",
      source: "ollama-library",
      related_provider: "Unsloth",
      related_model_ids: ["qwen-gguf"],
      published_at: "2026-03-31T20:00:00.000Z",
      category: "open_source",
      metadata: { signal_type: "open_source", signal_importance: "medium" },
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
            overlaps: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      id: "benchmark-gemma",
                      title: "Gemma 4 benchmark update",
                      source: "provider-blog",
                      category: "benchmark",
                      related_model_ids: ["gemma-4-31b"],
                      metadata: { signal_type: "benchmark" },
                      published_at: "2026-04-02T12:00:00.000Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
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

      if (table === "benchmark_scores") {
        return {
          select: () => ({
            in: async () => ({
              data: [{ model_id: "gemma-4-31b" }],
              error: null,
            }),
          }),
        };
      }

      if (table === "elo_ratings") {
        return {
          select: () => ({
            in: async () => ({
              data: [],
              error: null,
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
      "google-gemma-4-31b-it",
      "qwen-qwen3-5-122b-a10b",
      "minimax-minimax-m2-7",
      "z-ai-glm-5",
      "harrier-oss-v1-27b",
    ]);
    expect(body.recent.find((model: { slug: string }) => model.slug === "google-gemma-4-27b-it")).toBeFalsy();
    expect(body.recent.find((model: { slug: string }) => model.slug === "minimax-m2-5")).toBeFalsy();
    expect(body.recent.find((model: { slug: string }) => model.slug === "llama-3-1-8b-instruct")).toBeFalsy();
    expect(body.recent.find((model: { slug: string }) => model.slug === "gpt-image")).toBeFalsy();
    expect(body.deployable).toContainEqual(
      expect.objectContaining({
        slug: "z-ai-glm-5",
        recent_signal: expect.objectContaining({
          signalType: "api",
          signalLabel: "API",
        }),
      })
    );
    expect(body.deployable).toContainEqual(
      expect.objectContaining({
        slug: "harrier-oss-v1-27b",
        recent_signal: expect.objectContaining({
          signalType: "open_source",
          signalLabel: "Open Source",
        }),
      })
    );
    expect(
      body.deployable.filter((model: { slug: string }) =>
        model.slug.includes("qwen3-5-122b-a10b")
      )
    ).toHaveLength(1);
    expect(
      body.deployable.find((model: { slug: string }) =>
        model.slug === "unsloth-qwen3-5-122b-a10b-gguf"
      )
    ).toBeFalsy();
    expect(body.popular[0]).toEqual(
      expect.objectContaining({
        slug: "llama-3-1-8b-instruct",
        provider: "Meta",
      })
    );
    expect(body.recent.find((model: { slug: string }) => model.slug === "google-gemma-4-31b-it"))
      .toEqual(
        expect.objectContaining({
          benchmark_tracking: expect.objectContaining({
            status: "provider_reported",
            badgeLabel: "Provider-reported*",
          }),
        })
      );
  });

  it("keeps usage updates out of the recent release rail", async () => {
    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/trending?limit=8")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recent.find((model: { slug: string }) => model.slug === "minimax-m2-5")).toBeFalsy();
    expect(body.recent.find((model: { slug: string }) => model.slug === "z-ai-glm-5")).toBeTruthy();
  });

  it("caps sibling recent variants so one launch family does not dominate the rail", async () => {
    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/trending?limit=8")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    const gemmaRecent = body.recent.filter((model: { slug: string }) =>
      model.slug.startsWith("google-gemma-4-")
    );

    expect(gemmaRecent).toHaveLength(1);
    expect(gemmaRecent[0]).toEqual(
      expect.objectContaining({
        slug: "google-gemma-4-31b-it",
      })
    );
  });

  it("shows the canonical family model when a recent sibling variant is newer", async () => {
    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/trending?limit=8")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(
      body.recent.find((model: { slug: string }) => model.slug === "minimax-minimax-m2-7")
    ).toBeTruthy();
    expect(
      body.recent.find(
        (model: { slug: string }) => model.slug === "minimax-minimax-m2-7-highspeed"
      )
    ).toBeFalsy();
  });
});
