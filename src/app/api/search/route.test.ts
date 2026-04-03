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

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) => {
    throw error;
  }),
}));

vi.mock("@/lib/middleware/api-paywall", () => ({
  checkPaywall: vi.fn().mockResolvedValue({ allowed: true }),
  paywallErrorResponse: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/public-server", () => ({
  createOptionalPublicClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/marketplace/policy-read", () => ({
  attachListingPolicies: vi.fn(async (_admin, listings) => listings),
}));

import { createClient } from "@supabase/supabase-js";
import { createOptionalPublicClient } from "@/lib/supabase/public-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

const createClientMock = vi.mocked(createClient);
const createOptionalPublicClientMock = vi.mocked(createOptionalPublicClient);
const createAdminClientMock = vi.mocked(createAdminClient);

function createMockSupabase(options?: {
  modelFtsData?: Array<Record<string, unknown>>;
  modelFtsError?: { message: string } | null;
  modelIlikeData?: Array<Record<string, unknown>>;
  marketplaceFtsData?: Array<Record<string, unknown>>;
  marketplaceFtsError?: { message: string } | null;
  marketplaceIlikeData?: Array<Record<string, unknown>>;
}) {
  const {
    modelFtsData = [
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
    modelFtsError = null,
    modelIlikeData = [],
    marketplaceFtsData = [],
    marketplaceFtsError = null,
    marketplaceIlikeData = [],
  } = options ?? {};

  return {
    from: (table: string) => {
      if (table === "models") {
        return {
          select: () => ({
            textSearch: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({
                    data: modelFtsData,
                    error: modelFtsError,
                  }),
                }),
              }),
            }),
            eq: () => ({
              or: () => ({
                order: () => ({
                  limit: async () => ({
                    data: modelIlikeData,
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

      if (table === "deployment_platforms") {
        return {
          select: () => ({
            order: async () => ({
              data: [
                {
                  id: "platform-1",
                  slug: "ollama-cloud",
                  name: "Ollama Cloud",
                  type: "hosting",
                  base_url: "https://ollama.com",
                  has_affiliate: false,
                  affiliate_url_template: null,
                },
              ],
              error: null,
            }),
          }),
        };
      }

      if (table === "model_deployments") {
        return {
          select: () => ({
            in: () => ({
              eq: async () => ({
                data: [
                  {
                    id: "deployment-1",
                    model_id: "model-1",
                    platform_id: "platform-1",
                    pricing_model: null,
                    price_per_unit: null,
                    unit_description: null,
                    free_tier: null,
                    one_click: true,
                    status: "available",
                  },
                ],
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
                    data: marketplaceFtsData,
                    error: marketplaceFtsError,
                  }),
                }),
              }),
            }),
            eq: () => ({
              or: () => ({
                order: () => ({
                  limit: async () => ({
                    data: marketplaceIlikeData,
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
    createOptionalPublicClientMock.mockReturnValue(null);
    createAdminClientMock.mockReturnValue(createMockSupabase());
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
        deployability_label: "Ready to Use",
      })
    );
    expect(body.data[0].display_description).not.toMatch(
      /TensorFlow-based neural network library/i
    );
  });

  it("falls back to ilike search when model full-text search errors", async () => {
    const fallbackClient = createMockSupabase({
      modelFtsData: [],
      modelFtsError: { message: "fts missing" },
      modelIlikeData: [
        {
          id: "model-2",
          slug: "gpt-4o",
          name: "GPT-4o",
          provider: "OpenAI",
          category: "llm",
          overall_rank: 1,
          quality_score: 95,
          capability_score: 95,
          is_open_weights: false,
          parameter_count: null,
          short_description: "Multimodal assistant",
          market_cap_estimate: 500_000_000,
        },
      ],
    });
    createOptionalPublicClientMock.mockReturnValue(fallbackClient);

    const response = await GET(
      new Request("http://localhost/api/search?q=gpt") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        slug: "gpt-4o",
        name: "GPT-4o",
      })
    );
  });

  it("falls back to ilike search when marketplace full-text search errors", async () => {
    const fallbackClient = createMockSupabase({
      marketplaceFtsError: { message: "fts missing" },
      marketplaceIlikeData: [
        {
          id: "listing-1",
          slug: "gpt-4-api-access",
          title: "GPT-4 API Access",
          listing_type: "api_access",
          price: 19,
          avg_rating: 4.8,
          preview_manifest: null,
          mcp_manifest: null,
          agent_config: null,
          agent_id: null,
        },
      ],
    });
    createOptionalPublicClientMock.mockReturnValue(fallbackClient);

    const response = await GET(
      new Request("http://localhost/api/search?q=gpt&marketplace=true") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.marketplace).toHaveLength(1);
    expect(body.marketplace[0]).toEqual(
      expect.objectContaining({
        slug: "gpt-4-api-access",
        title: "GPT-4 API Access",
      })
    );
  });

  it("shows open-weight deployability when no direct deployment signal is present", async () => {
    const openWeightClient = createMockSupabase({
      modelFtsData: [
        {
          id: "model-open-1",
          slug: "google-gemma-4-31b-it",
          name: "Gemma 4 31B IT",
          provider: "Google",
          category: "multimodal",
          overall_rank: 45,
          quality_score: 77,
          capability_score: 78,
          is_open_weights: true,
          parameter_count: null,
          short_description: null,
          market_cap_estimate: null,
        },
      ],
    });
    createOptionalPublicClientMock.mockReturnValue(openWeightClient);

    const response = await GET(
      new Request("http://localhost/api/search?q=gemma") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        slug: "google-gemma-4-31b-it",
        deployability_label: "Open Weights",
      })
    );
  });

  it("merges normalized fallback matches for versioned queries like 4.6", async () => {
    const versionedClient = createMockSupabase({
      modelFtsData: [],
      modelIlikeData: [
        {
          id: "model-claude-46",
          slug: "anthropic-claude-opus-4-6",
          name: "Claude Opus 4.6",
          provider: "Anthropic",
          category: "llm",
          overall_rank: 2,
          quality_score: 94,
          capability_score: 95,
          is_open_weights: false,
          parameter_count: null,
          short_description: "Frontier Anthropic model",
          market_cap_estimate: 700_000_000,
        },
      ],
    });
    createOptionalPublicClientMock.mockReturnValue(versionedClient);

    const response = await GET(
      new Request("http://localhost/api/search?q=claude%20opus%204.6") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        slug: "anthropic-claude-opus-4-6",
        name: "Claude Opus 4.6",
      })
    );
  });
});
