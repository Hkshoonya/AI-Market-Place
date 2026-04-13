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

describe("GET /api/models/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    vi.mocked(createClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "models") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "model-1",
                    slug: "openai-o3",
                    name: "o3",
                    provider: "OpenAI",
                    category: "llm",
                    benchmark_scores: [
                      {
                        id: "bench-1",
                        benchmark_id: 1,
                        score: 84,
                        score_normalized: 84,
                        source: "provider-blog",
                        benchmarks: { slug: "mmlu", name: "MMLU", category: "reasoning" },
                      },
                      {
                        id: "bench-2",
                        benchmark_id: 2,
                        score: 91,
                        score_normalized: 91,
                        source: "livebench",
                        benchmarks: { slug: "mmlu-pro", name: "MMLU-Pro", category: "reasoning" },
                      },
                    ],
                    model_pricing: [],
                    elo_ratings: [],
                    rankings: [],
                    model_updates: [],
                  },
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === "model_news") {
          return {
            select: vi.fn(() => ({
              contains: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
              eq: vi.fn(() => ({
                or: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(async () => ({ data: [], error: null })),
                  })),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);
  });

  it("returns only trusted structured benchmark rows", async () => {
    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/models/openai-o3"),
      { params: Promise.resolve({ slug: "openai-o3" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.benchmark_scores).toEqual([
      expect.objectContaining({
        id: "bench-2",
        source: "livebench",
        benchmarks: expect.objectContaining({ slug: "mmlu-pro" }),
      }),
    ]);
    expect(body.benchmark_tracking).toMatchObject({
      status: "structured",
      badgeLabel: "Structured",
    });
  });
});
