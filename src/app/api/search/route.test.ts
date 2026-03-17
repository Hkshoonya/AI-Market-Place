import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  systemLog: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createTaggedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { windowMs: 60_000, max: 60 } },
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  rateLimitHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/middleware/api-paywall", () => ({
  checkPaywall: vi.fn().mockResolvedValue({ allowed: true }),
  paywallErrorResponse: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import { GET } from "./route";

const createClientMock = vi.mocked(createClient);

function createMockSupabase() {
  return {
    from: (table: string) => {
      if (table === "models") {
        return {
          select: () => ({
            textSearch: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        id: "model-1",
                        slug: "google-deepmind-sonnet",
                        name: "Sonnet",
                        provider: "Google",
                        category: "llm",
                        overall_rank: 12,
                        quality_score: 84,
                        capability_score: 84,
                        is_open_weights: false,
                        parameter_count: null,
                        short_description: "TensorFlow-based neural network library",
                        market_cap_estimate: 123_000_000,
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
            eq: () => ({
              or: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === "model_pricing") {
        return {
          select: () => ({
            in: async () => ({
              data: [],
              error: null,
            }),
          }),
        };
      }

      if (table === "model_news") {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "marketplace_listings") {
        return {
          select: () => ({
            textSearch: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
            eq: () => ({
              or: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [],
                    error: null,
                  }),
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

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    createClientMock.mockReturnValue(createMockSupabase());
  });

  it("returns cleaned display descriptions instead of raw suspicious snippets", async () => {
    const response = await GET(
      new Request("http://localhost/api/search?q=sonnet") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        slug: "google-deepmind-sonnet",
        display_description: expect.stringMatching(/Google llm model/i),
      })
    );
    expect(body.data[0].display_description).not.toMatch(
      /TensorFlow-based neural network library/i
    );
  });
});
