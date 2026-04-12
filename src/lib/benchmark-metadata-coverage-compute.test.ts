import { describe, expect, it } from "vitest";
import {
  computeBenchmarkMetadataCoverage,
  isBenchmarkMetadataCoverageCandidate,
} from "./benchmark-metadata-coverage-compute";

function createMockSupabase(rows: unknown[]) {
  return {
    from: (table: string) => ({
      select: () => {
        if (table === "models") {
          return {
            eq: () => ({
              range: () => Promise.resolve({ data: rows, error: null }),
            }),
          };
        }

        if (table === "benchmark_scores") {
          return {
            range: () => Promise.resolve({ data: [], error: null }),
          };
        }

        return {
          eq: () => ({
            range: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      },
    }),
  };
}

describe("isBenchmarkMetadataCoverageCandidate", () => {
  it("keeps official benchmark models but excludes wrappers and community rows", () => {
    expect(
      isBenchmarkMetadataCoverageCandidate({
        slug: "google-gemma-4-31b-it",
        id: "gemma-4",
        provider: "google",
        category: "llm",
        hf_model_id: "google/gemma-4-31b-it",
        website_url: null,
        release_date: "2026-04-02",
      })
    ).toBe(true);

    expect(
      isBenchmarkMetadataCoverageCandidate({
        slug: "openai-gpt-5-3-chat-latest",
        id: "openai-latest",
        provider: "OpenAI",
        category: "llm",
        hf_model_id: null,
        website_url: "https://openai.com/gpt-5-3",
        release_date: "2026-02-10",
      })
    ).toBe(false);

    expect(
      isBenchmarkMetadataCoverageCandidate({
        slug: "unsloth-glm-5-1-gguf",
        id: "unsloth-glm",
        provider: "Unsloth",
        category: "llm",
        hf_model_id: "unsloth/GLM-5.1-GGUF",
        website_url: null,
        release_date: "2026-04-08",
      })
    ).toBe(false);
  });
});

describe("computeBenchmarkMetadataCoverage", () => {
  it("measures trusted benchmark locators over canonical official rows only", async () => {
    const supabase = createMockSupabase([
      {
        slug: "google-gemma-4-31b-it",
        id: "gemma-4",
        provider: "google",
        category: "llm",
        hf_model_id: "google/gemma-4-31b-it",
        website_url: null,
        release_date: "2026-04-02",
      },
      {
        slug: "openai-gpt-5-3",
        id: "openai-gpt-5-3",
        provider: "OpenAI",
        category: "llm",
        hf_model_id: null,
        website_url: null,
        release_date: "2026-02-10",
      },
      {
        slug: "openai-gpt-5-3-chat-latest",
        id: "openai-latest",
        provider: "OpenAI",
        category: "llm",
        hf_model_id: null,
        website_url: "https://openai.com/gpt-5-3",
        release_date: "2026-02-10",
      },
      {
        slug: "kai-os-carnice-9b",
        id: "kai-carnice",
        provider: "Kai OS",
        category: "llm",
        hf_model_id: "kai-os/carnice-9b",
        website_url: null,
        release_date: "2026-04-09",
      },
      {
        slug: "black-forest-labs-flux-2",
        id: "flux-2",
        provider: "Black Forest Labs",
        category: "image_generation",
        hf_model_id: null,
        website_url: "https://blackforestlabs.ai",
        release_date: "2026-04-07",
      },
    ]);

    const coverage = await computeBenchmarkMetadataCoverage(supabase as never);

    expect(coverage.benchmarkExpectedModels).toBe(2);
    expect(coverage.withTrustedHfLocator).toBe(1);
    expect(coverage.withTrustedWebsiteLocator).toBe(0);
    expect(coverage.withAnyTrustedBenchmarkLocator).toBe(1);
    expect(coverage.missingTrustedLocatorCount).toBe(1);
    expect(coverage.trustedLocatorCoveragePct).toBe(50);
    expect(coverage.recentMissingTrustedLocators).toEqual([
      {
        slug: "openai-gpt-5-3",
        provider: "OpenAI",
        category: "llm",
        release_date: "2026-02-10",
      },
    ]);
  });

  it("treats existing benchmark evidence as a valid automated update path", async () => {
    const supabase = {
      from: (table: string) => ({
        select: () => {
          if (table === "models") {
            return {
              eq: () => ({
                range: () =>
                  Promise.resolve({
                    data: [
                      {
                        slug: "openai-gpt-5-3",
                        id: "openai-gpt-5-3",
                        provider: "OpenAI",
                        category: "llm",
                        hf_model_id: null,
                        website_url: null,
                        release_date: "2026-02-10",
                      },
                    ],
                    error: null,
                  }),
              }),
            };
          }
          if (table === "benchmark_scores") {
            return {
              range: () =>
                Promise.resolve({
                  data: [{ model_id: "openai-gpt-5-3" }],
                  error: null,
                }),
            };
          }

          return {
            eq: () => ({
              range: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        },
      }),
    };

    const coverage = await computeBenchmarkMetadataCoverage(supabase as never);

    expect(coverage.benchmarkExpectedModels).toBe(1);
    expect(coverage.withAnyTrustedBenchmarkLocator).toBe(1);
    expect(coverage.missingTrustedLocatorCount).toBe(0);
    expect(coverage.trustedLocatorCoveragePct).toBe(100);
    expect(coverage.recentMissingTrustedLocators).toEqual([]);
  });
});
