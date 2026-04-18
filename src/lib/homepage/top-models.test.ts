import { describe, expect, it } from "vitest";

import { selectHomepageTopModelIds } from "./top-models";

describe("selectHomepageTopModelIds", () => {
  const now = Date.parse("2026-04-02T00:00:00Z");

  it("prioritizes enterprise traction and real-world usage over a single raw rank", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "economic-only",
          slug: "economic-only",
          name: "Economic Only",
          provider: "Provider A",
          overall_rank: 42,
          economic_footprint_score: 95,
          adoption_score: 42,
          capability_score: 50,
          quality_score: 58,
          popularity_score: 40,
          release_date: "2025-05-01",
        },
        {
          id: "balanced-enterprise-leader",
          slug: "balanced-enterprise-leader",
          name: "Balanced Enterprise Leader",
          provider: "Provider B",
          overall_rank: 5,
          economic_footprint_score: 89,
          adoption_score: 86,
          capability_score: 91,
          quality_score: 90,
          popularity_score: 72,
          release_date: "2026-02-10",
        },
        {
          id: "quality-only",
          slug: "quality-only",
          name: "Quality Only",
          provider: "Provider C",
          overall_rank: 14,
          economic_footprint_score: 55,
          adoption_score: 44,
          capability_score: 96,
          quality_score: 97,
          popularity_score: 30,
          release_date: "2026-01-14",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("balanced-enterprise-leader");
    expect(ids).toContain("quality-only");
  });

  it("does not let legacy footprint leaders outrank stronger current top models", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "legacy-footprint-winner",
          slug: "legacy-footprint-winner",
          name: "Legacy Footprint Winner",
          provider: "OpenAI",
          overall_rank: 42,
          economic_footprint_score: 89.1,
          adoption_score: 87.5,
          capability_score: 77.8,
          quality_score: 68.7,
          popularity_score: 63,
          release_date: "2024-12-17",
        },
        {
          id: "current-top-model",
          slug: "current-top-model",
          name: "Current Top Model",
          provider: "Anthropic",
          overall_rank: 12,
          economic_footprint_score: 71.6,
          adoption_score: 90.6,
          capability_score: 78.1,
          quality_score: 77.3,
          popularity_score: 65.3,
          release_date: "2025-06-17",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("current-top-model");
  });

  it("penalizes stale legacy leaders when newer top models are otherwise comparable", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "legacy-o1-shape",
          slug: "legacy-o1-shape",
          name: "Legacy O1 Shape",
          provider: "OpenAI",
          overall_rank: 45,
          economic_footprint_score: 89.1,
          adoption_score: 87.5,
          capability_score: 77.8,
          quality_score: 68.1,
          popularity_score: 62.3,
          release_date: "2024-12-17",
        },
        {
          id: "current-gpt-4-1-shape",
          slug: "current-gpt-4-1-shape",
          name: "Current GPT-4.1 Shape",
          provider: "OpenAI",
          overall_rank: 36,
          economic_footprint_score: 77.6,
          adoption_score: 89.8,
          capability_score: 77.1,
          quality_score: 68.2,
          popularity_score: 62.2,
          release_date: "2025-04-14",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("current-gpt-4-1-shape");
  });

  it("discounts old footprint and adoption signals when a newer peer is otherwise close", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "legacy-o1-like",
          slug: "legacy-o1-like",
          name: "Legacy O1 Like",
          provider: "OpenAI",
          overall_rank: 8,
          economic_footprint_score: 95,
          adoption_score: 93,
          capability_score: 79,
          quality_score: 73,
          popularity_score: 68,
          release_date: "2024-09-12",
        },
        {
          id: "current-frontier-peer",
          slug: "current-frontier-peer",
          name: "Current Frontier Peer",
          provider: "Anthropic",
          overall_rank: 10,
          economic_footprint_score: 86,
          adoption_score: 90,
          capability_score: 84,
          quality_score: 82,
          popularity_score: 66,
          release_date: "2026-01-18",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("current-frontier-peer");
  });

  it("penalizes previous-generation lifecycle rows when a fresher replacement is otherwise competitive", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "previous-generation-row",
          slug: "openai-o1",
          name: "o1",
          provider: "OpenAI",
          overall_rank: 8,
          economic_footprint_score: 69.1,
          adoption_score: 64.8,
          capability_score: 77.2,
          quality_score: 59.4,
          popularity_score: 60.5,
          release_date: "2024-12-17",
          description: "Previous full o-series reasoning model for complex tasks.",
        },
        {
          id: "current-replacement-row",
          slug: "openai-o3",
          name: "o3",
          provider: "OpenAI",
          overall_rank: 3,
          economic_footprint_score: 70.3,
          adoption_score: 73.2,
          capability_score: 80.4,
          quality_score: 63.5,
          popularity_score: 56,
          release_date: "2025-04-16",
          description: "Current frontier reasoning model for complex tasks.",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("current-replacement-row");
  });

  it("keeps a recent flagship upgrade ahead of the previous frontier release while benchmarks catch up", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "previous-flagship-row",
          slug: "anthropic-claude-opus-4-6",
          name: "Claude Opus 4.6",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 14,
          economic_footprint_score: 74.2,
          adoption_score: 55.4,
          capability_score: 80.2,
          quality_score: 60.3,
          popularity_score: 47.8,
          release_date: "2025-12-12",
          description:
            "Previous flagship Claude Opus release retained for compatibility after the Claude Opus 4.7 launch. Superseded by Opus 4.7 for Anthropic's latest top-end performance.",
        },
        {
          id: "recent-flagship-upgrade",
          slug: "anthropic-claude-opus-4-7",
          name: "Claude Opus 4.7",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 312,
          economic_footprint_score: 0,
          adoption_score: 61.6,
          capability_score: 49.2,
          quality_score: 44.8,
          popularity_score: 39,
          release_date: "2026-04-16",
          description:
            "Anthropic's latest generally available flagship. Improves on Opus 4.6 for advanced software engineering, long-running task reliability, self-verification, and high-resolution vision while keeping the same pricing.",
        },
      ],
      2,
      Date.parse("2026-04-17T12:00:00Z")
    );

    expect(ids[0]).toBe("recent-flagship-upgrade");
  });

  it("keeps specialized image and audio variants from crowding out mainstream top models", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "image-specialist",
          slug: "google-gemini-2-5-flash-image",
          name: "Gemini 2.5 Flash Image",
          category: "image_generation",
          overall_rank: 18,
          economic_footprint_score: 82,
          adoption_score: 87,
          capability_score: 76,
          quality_score: 73,
          popularity_score: 62,
          release_date: "2025-05-20",
        },
        {
          id: "general-frontier-model",
          slug: "openai-gpt-4-1",
          name: "GPT-4.1",
          category: "multimodal",
          overall_rank: 28,
          economic_footprint_score: 77,
          adoption_score: 89,
          capability_score: 76,
          quality_score: 72,
          popularity_score: 61,
          release_date: "2025-04-14",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("general-frontier-model");
  });

  it("penalizes preview-style rows when a stable peer is otherwise comparable", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "preview-row",
          slug: "google-gemini-2-5-pro-preview-05-06",
          name: "Gemini 2.5 Pro Preview 05-06",
          category: "multimodal",
          overall_rank: 14,
          economic_footprint_score: 76,
          adoption_score: 75,
          capability_score: 79,
          quality_score: 71,
          popularity_score: 56,
          release_date: "2025-05-07",
        },
        {
          id: "stable-row",
          slug: "openai-gpt-4-1",
          name: "GPT-4.1",
          category: "multimodal",
          overall_rank: 24,
          economic_footprint_score: 77,
          adoption_score: 83,
          capability_score: 76,
          quality_score: 72,
          popularity_score: 60,
          release_date: "2025-04-14",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("stable-row");
  });

  it("keeps flagship models ahead of older efficiency-tier rows with strong adoption", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "older-flash-leader",
          slug: "google-gemini-2-5-flash",
          name: "Gemini 2.5 Flash",
          provider: "Google",
          category: "multimodal",
          overall_rank: 8,
          economic_footprint_score: 72.3,
          adoption_score: 91.1,
          capability_score: 77.7,
          quality_score: 70,
          popularity_score: 63.8,
          release_date: "2025-05-20",
        },
        {
          id: "current-flagship",
          slug: "anthropic-claude-opus-4-6",
          name: "Claude Opus 4.6",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 75,
          economic_footprint_score: 74.8,
          adoption_score: 80.5,
          capability_score: 80.4,
          quality_score: 69.5,
          popularity_score: 53.1,
          release_date: "2025-12-12",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("current-flagship");
  });

  it("does not let stale free-provider rows outrank a current open-weight release on old adoption alone", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "stale-gemini-2-5-pro",
          slug: "google-gemini-2-5-pro",
          name: "Gemini 2.5 Pro",
          provider: "Google",
          category: "multimodal",
          overall_rank: 1,
          economic_footprint_score: 95,
          adoption_score: 96,
          capability_score: 89,
          quality_score: 88,
          popularity_score: 74,
          release_date: "2025-03-25",
        },
        {
          id: "current-gemma-4",
          slug: "google-gemma-4-31b-it",
          name: "Gemma 4 31B IT",
          provider: "Google",
          category: "multimodal",
          overall_rank: 40,
          economic_footprint_score: 68,
          adoption_score: 68,
          capability_score: 91,
          quality_score: 90,
          popularity_score: 58,
          release_date: "2026-04-02",
          is_open_weights: true,
          license: "open_source",
          license_name: "Apache 2.0",
          context_window: 128000,
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("current-gemma-4");
  });

  it("keeps older efficiency tiers behind current frontier models even with inflated rank signals", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "old-gemini-2-5-flash",
          slug: "google-gemini-2-5-flash",
          name: "Gemini 2.5 Flash",
          provider: "Google",
          category: "multimodal",
          overall_rank: 2,
          economic_footprint_score: 95,
          adoption_score: 95,
          capability_score: 86,
          quality_score: 84,
          popularity_score: 72,
          release_date: "2025-05-20",
        },
        {
          id: "current-frontier-release",
          slug: "anthropic-claude-opus-4-6",
          name: "Claude Opus 4.6",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 35,
          economic_footprint_score: 70,
          adoption_score: 72,
          capability_score: 90,
          quality_score: 89,
          popularity_score: 60,
          release_date: "2026-03-25",
        },
      ],
      2,
      now
    );

    expect(ids[0]).toBe("current-frontier-release");
  });

  it("collapses dated sibling variants to a single representative model", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "stable-o4-mini",
          slug: "openai-o4-mini",
          name: "o4-mini",
          provider: "OpenAI",
          category: "llm",
          overall_rank: 20,
          economic_footprint_score: 75,
          adoption_score: 90,
          capability_score: 81,
          quality_score: 69,
          popularity_score: 57,
          release_date: "2025-04-16",
          hf_downloads: 500000,
        },
        {
          id: "dated-o4-mini",
          slug: "openai-o4-mini-2025-04-16",
          name: "o4-mini-2025-04-16",
          provider: "OpenAI",
          category: "llm",
          overall_rank: 5,
          economic_footprint_score: 54,
          adoption_score: 63,
          capability_score: 82,
          quality_score: 63,
          popularity_score: 50,
          release_date: null,
          hf_downloads: 0,
        },
      ],
      2,
      now
    );

    expect(ids).toEqual(["stable-o4-mini"]);
  });

  it("keeps incomplete wrapper rows out when enough discovery-ready models exist", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "community-wrapper",
          slug: "community-model-latest",
          name: "Community Model Latest",
          provider: "Community Hub",
          category: "llm",
          overall_rank: 3,
          economic_footprint_score: 82,
          adoption_score: 80,
          capability_score: 82,
          quality_score: 82,
          popularity_score: 80,
          release_date: null,
        },
        {
          id: "ready-google",
          slug: "google-gemma-4-31b-it",
          name: "Gemma 4 31B IT",
          provider: "Google",
          category: "multimodal",
          overall_rank: 18,
          economic_footprint_score: 72,
          adoption_score: 70,
          capability_score: 80,
          quality_score: 79,
          popularity_score: 65,
          release_date: "2026-04-02",
          is_open_weights: true,
          license: "open_source",
          license_name: "Apache 2.0",
          context_window: 128000,
        },
        {
          id: "ready-anthropic",
          slug: "anthropic-claude-opus-4-6",
          name: "Claude Opus 4.6",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 6,
          economic_footprint_score: 88,
          adoption_score: 90,
          capability_score: 92,
          quality_score: 91,
          popularity_score: 74,
          release_date: "2026-02-05",
          context_window: 200000,
        },
        {
          id: "ready-openai",
          slug: "openai-gpt-4-1",
          name: "GPT-4.1",
          provider: "OpenAI",
          category: "multimodal",
          overall_rank: 11,
          economic_footprint_score: 84,
          adoption_score: 88,
          capability_score: 86,
          quality_score: 85,
          popularity_score: 69,
          release_date: "2025-04-14",
          context_window: 1047576,
        },
        {
          id: "ready-zai",
          slug: "z-ai-glm-5",
          name: "GLM-5",
          provider: "Z.ai",
          category: "multimodal",
          overall_rank: 17,
          economic_footprint_score: 70,
          adoption_score: 68,
          capability_score: 78,
          quality_score: 77,
          popularity_score: 61,
          release_date: "2026-03-29",
          context_window: 202752,
        },
        {
          id: "ready-minimax",
          slug: "minimax-minimax-m2-7",
          name: "MiniMax M2.7",
          provider: "MiniMax",
          category: "llm",
          overall_rank: 16,
          economic_footprint_score: 68,
          adoption_score: 63,
          capability_score: 75,
          quality_score: 74,
          popularity_score: 60,
          release_date: "2026-03-20",
          is_open_weights: true,
          license: "open_source",
          license_name: "Apache 2.0",
          context_window: 131072,
        },
      ],
      5,
      now
    );

    expect(ids).not.toContain("community-wrapper");
  });

  it("keeps specialized rows out of the homepage shortlist when enough strong general-purpose models exist", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "specialized-agent-row",
          slug: "deepseek-ai-deepseek-v3-1",
          name: "deepseek-v3.1",
          provider: "DeepSeek",
          category: "specialized",
          overall_rank: 12,
          economic_footprint_score: 70,
          adoption_score: 79,
          capability_score: 81,
          quality_score: 74,
          popularity_score: 63,
          release_date: "2026-03-03",
        },
        {
          id: "strong-openai",
          slug: "openai-gpt-4-1",
          name: "GPT-4.1",
          provider: "OpenAI",
          category: "llm",
          overall_rank: 14,
          economic_footprint_score: 70,
          adoption_score: 73,
          capability_score: 76.2,
          quality_score: 60.6,
          popularity_score: 57,
          release_date: "2025-04-14",
        },
        {
          id: "strong-anthropic",
          slug: "anthropic-claude-opus-4-6",
          name: "Claude Opus 4.6",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 18,
          economic_footprint_score: 75.1,
          adoption_score: 81.1,
          capability_score: 80.3,
          quality_score: 69.6,
          popularity_score: 53.7,
          release_date: "2025-12-12",
          context_window: 200000,
        },
        {
          id: "strong-qwen",
          slug: "alibaba-qwen3-235b",
          name: "Qwen3-235B",
          provider: "Alibaba",
          category: "llm",
          overall_rank: 11,
          economic_footprint_score: 58.1,
          adoption_score: 76.4,
          capability_score: 77.5,
          quality_score: 80.9,
          popularity_score: 66.8,
          release_date: "2025-04-29",
          is_open_weights: true,
          license: "open_source",
          license_name: "Apache 2.0",
          context_window: 131072,
        },
      ],
      2,
      now
    );

    expect(ids).not.toContain("specialized-agent-row");
    expect(ids).toContain("strong-anthropic");
    expect(ids).toContain("strong-qwen");
  });

  it("drops weak quality rows from the homepage shortlist when stronger benchmark-style peers exist", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "weak-commercial-row",
          slug: "minimax-minimax-m2",
          name: "MiniMax M2",
          provider: "MiniMax",
          category: "llm",
          overall_rank: 10,
          economic_footprint_score: 38.3,
          adoption_score: 51,
          capability_score: 74.4,
          quality_score: 45.6,
          popularity_score: 50.3,
          release_date: "2025-10-23",
        },
        {
          id: "strong-openai",
          slug: "openai-o3-pro",
          name: "o3",
          provider: "OpenAI",
          category: "llm",
          overall_rank: 20,
          economic_footprint_score: 83,
          adoption_score: 73.1,
          capability_score: 77.3,
          quality_score: 59.5,
          popularity_score: 55.1,
          release_date: "2025-04-16",
        },
        {
          id: "strong-qwen",
          slug: "alibaba-qwen3-235b",
          name: "Qwen3-235B",
          provider: "Alibaba",
          category: "llm",
          overall_rank: 11,
          economic_footprint_score: 58.1,
          adoption_score: 76.4,
          capability_score: 77.5,
          quality_score: 80.9,
          popularity_score: 66.8,
          release_date: "2025-04-29",
          is_open_weights: true,
          license: "open_source",
          license_name: "Apache 2.0",
          context_window: 131072,
        },
      ],
      2,
      now
    );

    expect(ids).not.toContain("weak-commercial-row");
    expect(ids).toEqual(["strong-qwen", "strong-openai"]);
  });
});
