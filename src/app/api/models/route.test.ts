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

type MockModel = Record<string, unknown>;

function createQuery(data: MockModel[]) {
  const query = {
    eq: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: MockModel[]; error: null }) => unknown) =>
      Promise.resolve(resolve({ data, error: null })),
  };

  return query;
}

describe("GET /api/models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("keeps weak wrapper rows out of default public model listings when enough ready models exist", async () => {
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() =>
          createQuery([
            {
              id: "wrapper",
              slug: "community-model-latest",
              name: "Community Model Latest",
              provider: "Community Hub",
              category: "llm",
              release_date: null,
              is_open_weights: false,
              license: null,
              license_name: null,
              context_window: 32768,
              balanced_rank: 1,
              rankings: [],
              model_pricing: [],
            },
            {
              id: "openai-gpt-4-1",
              slug: "openai-gpt-4-1",
              name: "GPT-4.1",
              provider: "OpenAI",
              category: "multimodal",
              release_date: "2025-04-14",
              is_open_weights: false,
              license: null,
              license_name: null,
              context_window: 1047576,
              balanced_rank: 2,
              quality_score: 85,
              capability_score: 86,
              adoption_score: 88,
              popularity_score: 69,
              economic_footprint_score: 84,
              rankings: [],
              model_pricing: [],
            },
            {
              id: "anthropic-claude-opus-4-6",
              slug: "anthropic-claude-opus-4-6",
              name: "Claude Opus 4.6",
              provider: "Anthropic",
              category: "multimodal",
              release_date: "2026-02-05",
              is_open_weights: false,
              license: null,
              license_name: null,
              context_window: 200000,
              balanced_rank: 3,
              quality_score: 91,
              capability_score: 92,
              adoption_score: 90,
              popularity_score: 74,
              economic_footprint_score: 88,
              rankings: [],
              model_pricing: [],
            },
            {
              id: "google-gemma-4-31b-it",
              slug: "google-gemma-4-31b-it",
              name: "Gemma 4 31B IT",
              provider: "Google",
              category: "multimodal",
              release_date: "2026-04-02",
              is_open_weights: true,
              license: "open_source",
              license_name: "Apache 2.0",
              context_window: 128000,
              balanced_rank: 4,
              quality_score: 79,
              capability_score: 80,
              adoption_score: 70,
              popularity_score: 65,
              economic_footprint_score: 72,
              rankings: [],
              model_pricing: [],
            },
            {
              id: "z-ai-glm-5",
              slug: "z-ai-glm-5",
              name: "GLM-5",
              provider: "Z.ai",
              category: "multimodal",
              release_date: "2026-03-29",
              is_open_weights: false,
              license: null,
              license_name: null,
              context_window: 202752,
              balanced_rank: 5,
              quality_score: 77,
              capability_score: 78,
              adoption_score: 68,
              popularity_score: 61,
              economic_footprint_score: 70,
              rankings: [],
              model_pricing: [],
            },
            {
              id: "minimax-minimax-m2-7",
              slug: "minimax-minimax-m2-7",
              name: "MiniMax M2.7",
              provider: "MiniMax",
              category: "llm",
              release_date: "2026-03-20",
              is_open_weights: true,
              license: "open_source",
              license_name: "Apache 2.0",
              context_window: 131072,
              balanced_rank: 6,
              quality_score: 74,
              capability_score: 75,
              adoption_score: 63,
              popularity_score: 60,
              economic_footprint_score: 68,
              rankings: [],
              model_pricing: [],
            },
          ])
        ),
      })),
    } as never);

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/models?limit=10")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.map((model: { slug: string }) => model.slug)).not.toContain(
      "community-model-latest"
    );
    expect(body.total).toBe(5);
  });

  it("keeps exact niche search results when there are not enough readiness-qualified matches", async () => {
    const query = createQuery([
      {
        id: "wrapper",
        slug: "community-model-latest",
        name: "Community Model Latest",
        provider: "Community Hub",
        category: "llm",
        release_date: null,
        is_open_weights: false,
        license: null,
        license_name: null,
        context_window: 32768,
        balanced_rank: 1,
        rankings: [],
        model_pricing: [],
      },
    ]);

    vi.mocked(createClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => query),
      })),
    } as never);

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/models?q=community%20model&limit=10")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].slug).toBe("community-model-latest");
    expect(query.textSearch).toHaveBeenCalledWith("fts", "community model");
  });
});
