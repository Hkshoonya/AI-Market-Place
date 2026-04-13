import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/models/public-families", () => ({
  dedupePublicModelFamilies: vi.fn((models) => models),
}));

vi.mock("@/lib/models/public-surface-readiness", () => ({
  preferDefaultPublicSurfaceReady: vi.fn((models) => models),
}));

import { createClient } from "@supabase/supabase-js";
import { GET } from "./route";

const mockCreateClient = vi.mocked(createClient);

describe("GET /api/charts/market-kpis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("counts only distinct trusted benchmark-covered models", async () => {
    mockCreateClient.mockReturnValue({
      from: (table: string) => ({
        select: () => {
          if (table === "models") {
            return {
              eq: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "model-1",
                      slug: "model-1",
                      name: "Model 1",
                      quality_score: 80,
                      category: "llm",
                      provider: "OpenAI",
                      is_open_weights: false,
                      hf_downloads: 1000,
                    },
                    {
                      id: "model-2",
                      slug: "model-2",
                      name: "Model 2",
                      quality_score: 70,
                      category: "llm",
                      provider: "Anthropic",
                      is_open_weights: false,
                      hf_downloads: 500,
                    },
                  ],
                  error: null,
                }),
            };
          }

          if (table === "benchmark_scores") {
            return Promise.resolve({
              data: [
                { model_id: "model-1", source: "livebench" },
                { model_id: "model-1", source: "artificial-analysis" },
                { model_id: "model-2", source: "unknown-feed" },
              ],
              error: null,
            });
          }

          if (table === "elo_ratings") {
            return Promise.resolve({
              data: [
                { model_id: "model-1" },
                { model_id: "model-1" },
                { model_id: "model-2" },
              ],
              error: null,
            });
          }

          throw new Error(`Unexpected table ${table}`);
        },
      }),
    } as never);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.kpis.modelsWithBenchmarks).toBe(1);
    expect(body.kpis.modelsWithElo).toBe(2);
  });
});

