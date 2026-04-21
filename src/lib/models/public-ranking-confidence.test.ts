import { describe, expect, it } from "vitest";

import {
  computePublicRankingConfidenceScore,
  getPublicRankingConfidenceTier,
  hasLifecycleWarningLanguage,
  selectPublicRankingPool,
} from "./public-ranking-confidence";

describe("public ranking confidence", () => {
  it("scores benchmark-backed strong models above weak stale entries", () => {
    const strong = computePublicRankingConfidenceScore({
      slug: "anthropic-claude-opus-4-6",
      name: "Claude Opus 4.6",
      provider: "Anthropic",
      category: "llm",
      release_date: "2026-02-20",
      overall_rank: 4,
      capability_score: 93,
      quality_score: 91,
      adoption_score: 75,
      popularity_score: 72,
      economic_footprint_score: 68,
      benchmark_scores: [{ id: "bench-1", source: "livebench" }],
    });
    const weak = computePublicRankingConfidenceScore({
      slug: "provider-model-mini",
      name: "Provider Model Mini",
      provider: "Provider",
      category: "llm",
      release_date: "2024-01-10",
      overall_rank: 6,
      capability_score: 58,
      quality_score: 54,
      adoption_score: 18,
      popularity_score: 32,
      economic_footprint_score: 12,
    });

    expect(strong).toBeGreaterThan(weak);
    expect(getPublicRankingConfidenceTier({
      slug: "anthropic-claude-opus-4-6",
      name: "Claude Opus 4.6",
      provider: "Anthropic",
      category: "llm",
      release_date: "2026-02-20",
      overall_rank: 4,
      capability_score: 93,
      quality_score: 91,
      adoption_score: 75,
      popularity_score: 72,
      economic_footprint_score: 68,
      benchmark_scores: [{ id: "bench-1", source: "livebench" }],
    })).toBe("high");
  });

  it("prefers medium/high-confidence pools when enough options exist", () => {
    const selected = selectPublicRankingPool(
      [
        {
          slug: "high-a",
          name: "High A",
          provider: "Provider",
          category: "llm",
          release_date: "2026-02-20",
          capability_score: 90,
          quality_score: 88,
          adoption_score: 70,
          benchmark_scores: [{ id: "bench-1", source: "artificial-analysis" }],
        },
        {
          slug: "medium-b",
          name: "Medium B",
          provider: "Provider",
          category: "llm",
          release_date: "2025-11-20",
          capability_score: 78,
          quality_score: 70,
          adoption_score: 45,
        },
        {
          slug: "low-c",
          name: "Low C Mini",
          provider: "Provider",
          category: "llm",
          release_date: "2024-01-10",
          capability_score: 55,
          quality_score: 50,
          popularity_score: 20,
        },
      ],
      2
    );

    expect(selected.map((model) => model.slug)).toEqual(["high-a", "medium-b"]);
  });

  it("prefers standard current rows over preview and mini variants when enough options exist", () => {
    const selected = selectPublicRankingPool(
      [
        {
          slug: "google-gemini-3-1-pro-preview",
          name: "Gemini 3.1 Pro Preview",
          provider: "Google",
          category: "multimodal",
          release_date: "2026-02-19",
          capability_score: 90,
          quality_score: 88,
          adoption_score: 72,
          benchmark_scores: [{ id: "bench-1", source: "livebench" }],
        },
        {
          slug: "openai-o4-mini",
          name: "o4-mini",
          provider: "OpenAI",
          category: "llm",
          release_date: "2025-04-16",
          capability_score: 91,
          quality_score: 87,
          adoption_score: 74,
          benchmark_scores: [{ id: "bench-2", source: "artificial-analysis" }],
        },
        {
          slug: "anthropic-claude-opus-4-7",
          name: "Claude Opus 4.7",
          provider: "Anthropic",
          category: "multimodal",
          release_date: "2026-04-16",
          capability_score: 68.9,
          quality_score: 57.3,
          adoption_score: 53.8,
          economic_footprint_score: 57.7,
          benchmark_scores: [{ id: "bench-3", source: "livebench" }],
        },
        {
          slug: "moonshotai-kimi-k2-thinking",
          name: "Kimi K2 Thinking",
          provider: "Moonshot AI",
          category: "llm",
          release_date: "2025-11-06",
          capability_score: 75.8,
          quality_score: 42.3,
          adoption_score: 51,
          benchmark_scores: [{ id: "bench-4", source: "livebench" }],
        },
      ],
      2
    );

    expect(selected.map((model) => model.slug)).toEqual([
      "anthropic-claude-opus-4-7",
      "moonshotai-kimi-k2-thinking",
    ]);
  });

  it("prefers fresh current rows over stale frontier rows when enough options exist", () => {
    const selected = selectPublicRankingPool(
      [
        {
          slug: "openai-gpt-4o-2024-05-13",
          name: "GPT-4o",
          provider: "OpenAI",
          category: "multimodal",
          release_date: "2024-05-13",
          capability_score: 88,
          quality_score: 82,
          adoption_score: 74,
          benchmark_scores: [{ id: "bench-1", source: "livebench" }],
        },
        {
          slug: "deepseek-v3",
          name: "DeepSeek-V3",
          provider: "DeepSeek",
          category: "llm",
          release_date: "2024-12-26",
          capability_score: 86,
          quality_score: 81,
          adoption_score: 70,
          benchmark_scores: [{ id: "bench-2", source: "livebench" }],
        },
        {
          slug: "anthropic-claude-opus-4-7",
          name: "Claude Opus 4.7",
          provider: "Anthropic",
          category: "multimodal",
          release_date: "2026-04-16",
          capability_score: 68.9,
          quality_score: 57.3,
          adoption_score: 53.8,
          economic_footprint_score: 57.7,
          benchmark_scores: [{ id: "bench-3", source: "livebench" }],
        },
        {
          slug: "openai-gpt-5-4",
          name: "GPT-5.4",
          provider: "OpenAI",
          category: "llm",
          release_date: "2026-03-05",
          capability_score: 59.7,
          quality_score: 50.8,
          adoption_score: 58.9,
          economic_footprint_score: 45.3,
          benchmark_scores: [{ id: "bench-4", source: "artificial-analysis" }],
        },
      ],
      2
    );

    expect(selected.map((model) => model.slug)).toEqual([
      "anthropic-claude-opus-4-7",
      "openai-gpt-5-4",
    ]);
  });

  it("does not give full benchmark credit to rows without trusted source provenance", () => {
    const trusted = computePublicRankingConfidenceScore({
      slug: "trusted-model",
      name: "Trusted Model",
      provider: "Provider",
      category: "llm",
      release_date: "2026-02-20",
      capability_score: 74,
      quality_score: 70,
      benchmark_scores: [{ id: "bench-1", source: "livebench" }],
    });
    const untrusted = computePublicRankingConfidenceScore({
      slug: "untrusted-model",
      name: "Untrusted Model",
      provider: "Provider",
      category: "llm",
      release_date: "2026-02-20",
      capability_score: 74,
      quality_score: 70,
      benchmark_scores: [{ id: "bench-1", source: "unknown-feed" }],
    });

    expect(trusted).toBeGreaterThan(untrusted);
  });

  it("penalizes previous-generation lifecycle rows so current replacements win the public pool", () => {
    const previousGeneration = computePublicRankingConfidenceScore({
      slug: "openai-o1",
      name: "o1",
      provider: "OpenAI",
      category: "llm",
      release_date: "2024-12-17",
      overall_rank: 8,
      capability_score: 77.2,
      quality_score: 59.4,
      adoption_score: 64.8,
      popularity_score: 60.5,
      economic_footprint_score: 69.1,
      description:
        "Previous full o-series reasoning model. Later o3 and o4 releases are the newer frontier generation.",
    });
    const currentReplacement = computePublicRankingConfidenceScore({
      slug: "openai-o3",
      name: "o3",
      provider: "OpenAI",
      category: "llm",
      release_date: "2025-04-16",
      overall_rank: 3,
      capability_score: 80.4,
      quality_score: 63.5,
      adoption_score: 73.2,
      popularity_score: 56,
      economic_footprint_score: 70.3,
      description: "Current frontier reasoning model for complex tasks.",
    });

    expect(currentReplacement).toBeGreaterThan(previousGeneration);
    expect(
      getPublicRankingConfidenceTier({
        slug: "openai-o1",
        name: "o1",
        provider: "OpenAI",
        category: "llm",
        release_date: "2024-12-17",
        overall_rank: 8,
        capability_score: 77.2,
        quality_score: 59.4,
        adoption_score: 64.8,
        popularity_score: 60.5,
        economic_footprint_score: 69.1,
        description:
          "Previous full o-series reasoning model. Later o3 and o4 releases are the newer frontier generation.",
      })
    ).toBe("low");
  });

  it("penalizes unavailable closed models versus similarly strong accessible ones", () => {
    const accessible = computePublicRankingConfidenceScore({
      slug: "moonshotai-kimi-k2-thinking",
      name: "Kimi K2 Thinking",
      provider: "Moonshot AI",
      category: "llm",
      release_date: "2025-11-06",
      is_api_available: true,
      is_open_weights: false,
      overall_rank: 50,
      capability_score: 75.8,
      quality_score: 42.3,
      adoption_score: 51,
      economic_footprint_score: 41.3,
      benchmark_scores: [{ id: "bench-1", source: "livebench" }],
    });
    const unavailable = computePublicRankingConfidenceScore({
      slug: "minimaxai-minimax-m2-5",
      name: "MiniMax-M2.5",
      provider: "MiniMax",
      category: "llm",
      release_date: "2026-02-12",
      is_api_available: false,
      is_open_weights: false,
      overall_rank: 208,
      capability_score: 75.3,
      quality_score: 57.4,
      adoption_score: 68,
      economic_footprint_score: 48.5,
      benchmark_scores: [{ id: "bench-1", source: "livebench" }],
    });

    expect(accessible).toBeGreaterThan(unavailable);
  });

  it("recognizes next-generation upgrade wording as current leadership language", () => {
    expect(
      getPublicRankingConfidenceTier({
        slug: "anthropic-claude-opus-4-7",
        name: "Claude Opus 4.7",
        provider: "Anthropic",
        category: "multimodal",
        release_date: "2026-04-16",
        is_api_available: true,
        capability_score: 68.9,
        quality_score: 57.3,
        adoption_score: 53.8,
        economic_footprint_score: 57.7,
        description:
          "Opus 4.7 is the next generation of Anthropic's Opus family. Building on Opus 4.6, it improves advanced software engineering and reliability.",
      })
    ).toBe("high");
  });

  it("falls back to known-model lifecycle metadata when the live row description is stale", () => {
    expect(
      hasLifecycleWarningLanguage({
        slug: "anthropic-claude-opus-4-6",
        name: "Claude Opus 4.6",
        provider: "Anthropic",
        description:
          "Opus 4.6 is Anthropic's strongest model for coding and long-running professional tasks.",
        short_description: null,
      })
    ).toBe(true);

    const previousGeneration = computePublicRankingConfidenceScore({
      slug: "anthropic-claude-opus-4-6",
      name: "Claude Opus 4.6",
      provider: "Anthropic",
      category: "multimodal",
      release_date: "2026-02-04",
      overall_rank: 7,
      capability_score: 81.2,
      quality_score: 63,
      adoption_score: 54.8,
      popularity_score: 49.6,
      economic_footprint_score: 52.7,
      description:
        "Opus 4.6 is Anthropic's strongest model for coding and long-running professional tasks.",
    });
    const currentReplacement = computePublicRankingConfidenceScore({
      slug: "anthropic-claude-opus-4-7",
      name: "Claude Opus 4.7",
      provider: "Anthropic",
      category: "multimodal",
      release_date: "2026-04-16",
      overall_rank: 199,
      capability_score: 68.9,
      quality_score: 57.3,
      adoption_score: 53.8,
      popularity_score: 40.7,
      economic_footprint_score: 57.7,
      description:
        "Opus 4.7 is the next generation of Anthropic's Opus family, building on Opus 4.6.",
    });

    expect(currentReplacement).toBeGreaterThan(previousGeneration);
  });
});
