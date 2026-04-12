import { describe, expect, it } from "vitest";
import { computeBenchmarkCoverage } from "./benchmark-coverage-compute";

function createMockSupabase({
  models,
  scores = [],
  news = [],
}: {
  models: unknown[];
  scores?: unknown[];
  news?: unknown[];
}) {
  return {
    from: (table: string) => ({
      select: () => {
        if (table === "models") {
          return {
            eq: () => ({
              range: () => Promise.resolve({ data: models, error: null }),
            }),
          };
        }
        if (table === "benchmark_scores") {
          return {
            range: () => Promise.resolve({ data: scores, error: null }),
          };
        }

        return {
          eq: () => ({
            range: () => Promise.resolve({ data: news, error: null }),
          }),
        };
      },
    }),
  };
}

describe("computeBenchmarkCoverage", () => {
  it("reports recent official gaps only for canonical benchmark candidates", async () => {
    const supabase = createMockSupabase({
      models: [
        {
          id: "gpt-5-3",
          slug: "openai-gpt-5-3",
          provider: "OpenAI",
          category: "llm",
          hf_model_id: null,
          website_url: null,
          release_date: "2026-02-10",
        },
        {
          id: "gpt-5-3-latest",
          slug: "openai-gpt-5-3-chat-latest",
          provider: "OpenAI",
          category: "llm",
          hf_model_id: null,
          website_url: null,
          release_date: "2026-02-10",
        },
        {
          id: "community-wrapper",
          slug: "unsloth-glm-5-1-gguf",
          provider: "Unsloth",
          category: "llm",
          hf_model_id: "unsloth/GLM-5.1-GGUF",
          website_url: null,
          release_date: "2026-04-08",
        },
        {
          id: "qwen-covered",
          slug: "qwen-qwen3-max",
          provider: "Qwen",
          category: "llm",
          hf_model_id: null,
          website_url: null,
          release_date: "2025-09-23",
        },
      ],
      scores: [{ model_id: "qwen-covered" }],
    });

    const coverage = await computeBenchmarkCoverage(supabase as never);

    expect(coverage.totals.covered_models).toBe(1);
    expect(coverage.recent_sparse_benchmark_expected_official).toEqual([
      {
        slug: "openai-gpt-5-3",
        provider: "OpenAI",
        category: "llm",
        release_date: "2026-02-10",
      },
    ]);
  });
});
