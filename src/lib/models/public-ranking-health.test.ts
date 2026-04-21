import { describe, expect, it } from "vitest";

import { computePublicRankingHealth } from "./public-ranking-health";

describe("computePublicRankingHealth", () => {
  it("flags lifecycle-warning rows that still survive in the public ranking pool", () => {
    const health = computePublicRankingHealth([
      {
        id: "previous-opus",
        slug: "anthropic-claude-opus-4-6",
        name: "Claude Opus 4.6",
        provider: "Anthropic",
        category: "multimodal",
        overall_rank: 14,
        release_date: "2025-12-12",
        capability_score: 80.2,
        quality_score: 60.3,
        adoption_score: 55.4,
        popularity_score: 47.8,
        economic_footprint_score: 53.6,
        benchmark_scores: [{ source: "livebench" }],
        description:
          "Previous flagship Claude Opus release retained for compatibility after the Claude Opus 4.7 launch. Superseded by Opus 4.7.",
      },
      {
        id: "current-opus",
        slug: "anthropic-claude-opus-4-7",
        name: "Claude Opus 4.7",
        provider: "Anthropic",
        category: "multimodal",
        overall_rank: 312,
        release_date: "2026-04-16",
        capability_score: 49.2,
        quality_score: 44.8,
        adoption_score: 61.6,
        popularity_score: 39,
        economic_footprint_score: 0,
        description:
          "Anthropic's latest generally available flagship. Improves on Opus 4.6 for advanced software engineering and reliability.",
      },
    ]);

    expect(health.healthy).toBe(false);
    expect(health.lifecycleRowsInPool.map((row) => row.slug)).toContain(
      "anthropic-claude-opus-4-6"
    );
  });

  it("stays healthy when the pool surfaces current leadership rows without lifecycle warnings", () => {
    const health = computePublicRankingHealth([
      {
        id: "gemini-3-1-pro",
        slug: "google-gemini-3-1-pro",
        name: "Gemini 3.1 Pro",
        provider: "Google",
        category: "multimodal",
        overall_rank: 5,
        release_date: "2026-02-19",
        capability_score: 92,
        quality_score: 90,
        adoption_score: 66,
        popularity_score: 70,
        economic_footprint_score: 61,
        benchmark_scores: [{ source: "livebench" }],
        description:
          "Updated Gemini 3.1 flagship model that improves on Gemini 2.5 Pro with stronger state-of-the-art performance and broad availability.",
      },
      {
        id: "gpt-5-4",
        slug: "openai-gpt-5-4",
        name: "GPT-5.4",
        provider: "OpenAI",
        category: "llm",
        overall_rank: 2,
        release_date: "2026-03-21",
        capability_score: 93,
        quality_score: 91,
        adoption_score: 72,
        popularity_score: 74,
        economic_footprint_score: 68,
        benchmark_scores: [{ source: "artificial-analysis" }],
        description:
          "OpenAI's latest flagship model for reasoning, coding, and long-context agent workflows.",
      },
    ]);

    expect(health.healthy).toBe(true);
    expect(health.lifecycleRowsInPool).toHaveLength(0);
    expect(health.missingRecentLeadership).toHaveLength(0);
  });

  it("flags preview rows that still survive in the public ranking pool", () => {
    const health = computePublicRankingHealth([
      {
        id: "gemini-preview",
        slug: "google-gemini-3-1-pro-preview",
        name: "Gemini 3.1 Pro Preview",
        provider: "Google",
        category: "multimodal",
        overall_rank: 15,
        release_date: "2026-02-19",
        capability_score: 92,
        quality_score: 90,
        adoption_score: 66,
        popularity_score: 70,
        economic_footprint_score: 61,
        benchmark_scores: [{ source: "livebench" }],
        description: "Preview build of Gemini 3.1 Pro.",
      },
      {
        id: "gpt-standard",
        slug: "openai-gpt-5-4",
        name: "GPT-5.4",
        provider: "OpenAI",
        category: "llm",
        overall_rank: 2,
        release_date: "2026-03-21",
        capability_score: 93,
        quality_score: 91,
        adoption_score: 72,
        popularity_score: 74,
        economic_footprint_score: 68,
        benchmark_scores: [{ source: "artificial-analysis" }],
        description: "OpenAI's latest flagship model.",
      },
    ]);

    expect(health.healthy).toBe(false);
    expect(health.previewRowsInPool.map((row) => row.slug)).toContain(
      "google-gemini-3-1-pro-preview"
    );
  });

  it("flags stale rows that still survive in the public ranking pool", () => {
    const health = computePublicRankingHealth([
      {
        id: "stale-gpt-4o",
        slug: "openai-gpt-4o-2024-05-13",
        name: "GPT-4o",
        provider: "OpenAI",
        category: "multimodal",
        overall_rank: 23,
        release_date: "2024-05-13",
        capability_score: 88,
        quality_score: 82,
        adoption_score: 74,
        popularity_score: 70,
        economic_footprint_score: 65,
        benchmark_scores: [{ source: "livebench" }],
      },
      {
        id: "current-opus",
        slug: "anthropic-claude-opus-4-7",
        name: "Claude Opus 4.7",
        provider: "Anthropic",
        category: "multimodal",
        overall_rank: 199,
        release_date: "2026-04-16",
        capability_score: 68.9,
        quality_score: 57.3,
        adoption_score: 53.8,
        popularity_score: 40.7,
        economic_footprint_score: 57.7,
        benchmark_scores: [{ source: "livebench" }],
        description:
          "Anthropic's latest generally available flagship. Building on Opus 4.6, it improves advanced software engineering and reliability.",
      },
    ]);

    expect(health.healthy).toBe(false);
    expect(health.staleRowsInPool.map((row) => row.slug)).toContain(
      "openai-gpt-4o-2024-05-13"
    );
  });
});
