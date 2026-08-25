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
          slug: "anthropic-claude-opus-4-8",
          name: "Claude Opus 4.8",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 14,
          economic_footprint_score: 74.2,
          adoption_score: 55.4,
          capability_score: 80.2,
          quality_score: 60.3,
          popularity_score: 47.8,
          release_date: "2026-05-28",
          description:
            "Previous generally available Opus release retained for compatibility after Claude Opus 5.",
        },
        {
          id: "recent-flagship-upgrade",
          slug: "anthropic-claude-opus-5",
          name: "Claude Opus 5",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 312,
          economic_footprint_score: 47,
          adoption_score: 61.6,
          capability_score: 49.2,
          quality_score: 44.8,
          popularity_score: 39,
          release_date: "2026-07-24",
          description:
            "Anthropic's current Opus model. It improves on Opus 4.8 for advanced software engineering, reliability, and high-autonomy work.",
        },
      ],
      2,
      Date.parse("2026-07-30T12:00:00Z")
    );

    expect(ids[0]).toBe("recent-flagship-upgrade");
  });

  it("surfaces a verified official frontier launch before score feeds catch up", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "previous-opus",
          slug: "anthropic-claude-opus-4-8",
          name: "Claude Opus 4.8",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 94,
          economic_footprint_score: 66,
          adoption_score: 70.2,
          capability_score: 76,
          quality_score: 66.5,
          popularity_score: 47.4,
          release_date: "2026-05-28",
          context_window: 1000000,
          description:
            "Previous generally available Opus release retained for compatibility after Claude Opus 5.",
        },
        {
          id: "official-opus-5",
          slug: "anthropic-claude-opus-5",
          name: "Claude Opus 5",
          provider: "Anthropic",
          category: "multimodal",
          release_date: "2026-07-24",
          context_window: 1000000,
          description:
            "Anthropic's current Opus model for complex reasoning and long-horizon agentic coding.",
        },
      ],
      1,
      Date.parse("2026-07-30T12:00:00Z")
    );

    expect(ids[0]).toBe("official-opus-5");
    expect(ids).not.toContain("previous-opus");
  });

  it("surfaces a verified flagship when capability evidence is missing but partial scores exist", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "previous-openai-flagship",
          slug: "openai-gpt-5-5",
          name: "GPT-5.5",
          provider: "OpenAI",
          category: "llm",
          is_api_available: true,
          overall_rank: 21,
          economic_footprint_score: 55,
          adoption_score: 65,
          capability_score: 72,
          quality_score: 58,
          popularity_score: 50,
          release_date: "2026-04-23",
          context_window: 1050000,
          description: "Previous OpenAI flagship for complex professional work.",
        },
        {
          id: "current-openai-flagship",
          slug: "openai-gpt-5-6-sol",
          name: "GPT-5.6 Sol",
          provider: "OpenAI",
          category: "llm",
          is_api_available: true,
          overall_rank: 260,
          economic_footprint_score: 38,
          adoption_score: 47,
          capability_score: null,
          quality_score: 22,
          popularity_score: 31,
          release_date: "2026-07-09",
          context_window: 1050000,
          description:
            "OpenAI's current flagship for complex reasoning, coding, and professional work.",
        },
      ],
      1,
      Date.parse("2026-07-30T12:00:00Z")
    );

    expect(ids).toEqual(["current-openai-flagship"]);
  });

  it("uses verified provider leadership while computed scores catch up", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "proven-market-leader",
          slug: "moonshotai-kimi-k2-6",
          name: "Kimi K2.6",
          provider: "Moonshot AI",
          category: "multimodal",
          is_api_available: true,
          overall_rank: 2,
          economic_footprint_score: 50.7,
          adoption_score: 68.4,
          capability_score: 80.9,
          quality_score: 80.9,
          popularity_score: 52,
          release_date: "2026-04-20",
        },
        {
          id: "previous-openai",
          slug: "openai-gpt-5-5",
          name: "GPT-5.5",
          provider: "OpenAI",
          category: "llm",
          is_api_available: true,
          overall_rank: 1,
          economic_footprint_score: 55.2,
          adoption_score: 59.6,
          capability_score: 85.1,
          quality_score: 67.6,
          popularity_score: 59,
          release_date: "2026-04-23",
        },
        {
          id: "current-openai",
          slug: "openai-gpt-5-6-sol",
          name: "GPT-5.6 Sol",
          provider: "OpenAI",
          category: "llm",
          is_api_available: true,
          overall_rank: 596,
          economic_footprint_score: 38,
          adoption_score: 47,
          capability_score: 43,
          quality_score: 38.6,
          popularity_score: 31,
          release_date: "2026-07-09",
        },
        {
          id: "highest-capability-anthropic",
          slug: "anthropic-claude-fable-5",
          name: "Claude Fable 5",
          provider: "Anthropic",
          category: "multimodal",
          is_api_available: true,
          overall_rank: 119,
          economic_footprint_score: 67.1,
          adoption_score: 76.9,
          capability_score: 66.6,
          quality_score: 59,
          popularity_score: 47,
          release_date: "2026-06-09",
        },
        {
          id: "current-anthropic",
          slug: "anthropic-claude-opus-5",
          name: "Claude Opus 5",
          provider: "Anthropic",
          category: "multimodal",
          is_api_available: true,
          overall_rank: 57,
          economic_footprint_score: 46,
          adoption_score: 52,
          capability_score: 52,
          quality_score: 57.5,
          popularity_score: 40,
          release_date: "2026-07-24",
        },
      ],
      3,
      Date.parse("2026-07-30T12:00:00Z")
    );

    expect(ids).toContain("current-openai");
    expect(ids).toContain("highest-capability-anthropic");
    expect(ids).not.toContain("previous-openai");
    expect(ids).not.toContain("current-anthropic");
  });

  it("does not replace a newer provider leader with an older verified catalog entry", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "older-verified-zai",
          slug: "z-ai-glm-5-1",
          name: "GLM-5.1",
          provider: "Z.ai",
          category: "llm",
          is_api_available: true,
          overall_rank: 120,
          economic_footprint_score: 45,
          adoption_score: 54,
          capability_score: 70,
          quality_score: 60,
          popularity_score: 45,
          release_date: "2026-04-03",
        },
        {
          id: "newer-zai-leader",
          slug: "zai-org-glm-5-2",
          name: "GLM-5.2",
          provider: "Z.ai",
          category: "llm",
          is_api_available: true,
          overall_rank: 10,
          economic_footprint_score: 62,
          adoption_score: 68,
          capability_score: 92,
          quality_score: 90,
          popularity_score: 58,
          release_date: "2026-06-16",
          description:
            "Z.ai's latest flagship model for advanced reasoning and agentic coding.",
        },
      ],
      1,
      Date.parse("2026-07-30T12:00:00Z")
    );

    expect(ids).toEqual(["newer-zai-leader"]);
  });

  it("uses known-model lifecycle metadata when a previous generation row still has stale live copy", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "previous-flagship-row",
          slug: "anthropic-claude-opus-4-8",
          name: "Claude Opus 4.8",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 7,
          economic_footprint_score: 52.7,
          adoption_score: 54.8,
          capability_score: 81.2,
          quality_score: 63,
          popularity_score: 49.6,
          release_date: "2026-05-28",
          description:
            "Opus 4.8 is Anthropic's strongest model for coding and long-running professional tasks.",
        },
        {
          id: "current-flagship-row",
          slug: "anthropic-claude-opus-5",
          name: "Claude Opus 5",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 199,
          economic_footprint_score: 57.7,
          adoption_score: 53.8,
          capability_score: 68.9,
          quality_score: 57.3,
          popularity_score: 40.7,
          release_date: "2026-07-24",
          description:
            "Opus 5 is the next generation of Anthropic's Opus family, building on Opus 4.8.",
        },
      ],
      2,
      Date.parse("2026-07-30T12:00:00Z")
    );

    expect(ids[0]).toBe("current-flagship-row");
  });

  it("treats next-generation upgrade wording as current-flagship leadership language", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "older-anthropic-frontier",
          slug: "anthropic-claude-sonnet-4-6",
          name: "Claude Sonnet 4.6",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 202,
          economic_footprint_score: 47.3,
          adoption_score: 54.6,
          capability_score: 64.6,
          quality_score: 54.8,
          popularity_score: 40.1,
          release_date: "2026-02-17",
          description:
            "High-performance model balancing intelligence and speed for coding, analysis, and complex instruction following.",
        },
        {
          id: "next-generation-opus",
          slug: "anthropic-claude-opus-5",
          name: "Claude Opus 5",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 195,
          economic_footprint_score: 57.7,
          adoption_score: 53.8,
          capability_score: 68.9,
          quality_score: 57.3,
          popularity_score: 40.7,
          release_date: "2026-07-24",
          description:
            "Opus 5 is the next generation of Anthropic's Opus family, built for long-running asynchronous agents. Building on Opus 4.8, it improves advanced software engineering, reliability, and high-autonomy work.",
        },
      ],
      2,
      Date.parse("2026-07-30T12:00:00Z")
    );

    expect(ids[0]).toBe("next-generation-opus");
  });

  it("requires stronger readiness signals before a fresh flagship row outranks proven frontier peers", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "low-evidence-fresh-flagship",
          slug: "minimax-minimax-m2-1",
          name: "MiniMax M2.1",
          provider: "MiniMax",
          category: "llm",
          overall_rank: 15,
          economic_footprint_score: 37.5,
          adoption_score: 50.3,
          capability_score: 75.3,
          quality_score: 44.8,
          popularity_score: 47.4,
          release_date: "2025-12-23",
          description:
            "MiniMax-M2.1 is a lightweight, state-of-the-art large language model optimized for coding, agentic workflows, and modern application development.",
        },
        {
          id: "proven-current-flagship",
          slug: "google-gemini-3-1-pro",
          name: "Gemini 3.1 Pro",
          provider: "Google",
          category: "multimodal",
          overall_rank: 130,
          economic_footprint_score: 31.7,
          adoption_score: 52.5,
          capability_score: 69.4,
          quality_score: 56.6,
          popularity_score: 44.3,
          release_date: "2026-02-19",
          description:
            "Updated Gemini 3.1 flagship model for complex reasoning, coding, and long-context multimodal work. Improves on Gemini 2.5 Pro with stronger state-of-the-art performance and broad availability across the Gemini API and Vertex AI.",
        },
      ],
      2,
      Date.parse("2026-04-17T12:00:00Z")
    );

    expect(ids[0]).toBe("proven-current-flagship");
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
          slug: "anthropic-claude-opus-5",
          name: "Claude Opus 5",
          provider: "Anthropic",
          category: "multimodal",
          overall_rank: 120,
          economic_footprint_score: 57.7,
          adoption_score: 53.8,
          capability_score: 68.9,
          quality_score: 57.3,
          popularity_score: 40.7,
          release_date: "2026-07-24",
          context_window: 1000000,
          description:
            "Claude Opus 5 is Anthropic's current flagship, building on Opus 4.8.",
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
      Date.parse("2026-07-30T12:00:00Z")
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

  it("keeps the first homepage screen diverse across providers before allowing provider repeats", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "provider-a-1",
          slug: "openai-gpt-5-4",
          name: "GPT-5.4",
          provider: "OpenAI",
          category: "llm",
          overall_rank: 2,
          economic_footprint_score: 88,
          adoption_score: 90,
          capability_score: 90,
          quality_score: 89,
          popularity_score: 70,
          release_date: "2026-03-01",
          context_window: 128000,
        },
        {
          id: "provider-a-2",
          slug: "openai-o3",
          name: "o3",
          provider: "OpenAI",
          category: "llm",
          overall_rank: 3,
          economic_footprint_score: 85,
          adoption_score: 88,
          capability_score: 88,
          quality_score: 87,
          popularity_score: 68,
          release_date: "2026-02-20",
          context_window: 128000,
        },
        {
          id: "provider-b-1",
          slug: "anthropic-frontier-a",
          name: "Anthropic Frontier A",
          provider: "Anthropic",
          category: "llm",
          overall_rank: 5,
          economic_footprint_score: 82,
          adoption_score: 84,
          capability_score: 86,
          quality_score: 85,
          popularity_score: 66,
          release_date: "2026-02-10",
          context_window: 128000,
        },
        {
          id: "provider-c-1",
          slug: "google-frontier-a",
          name: "Google Frontier A",
          provider: "Google",
          category: "llm",
          overall_rank: 7,
          economic_footprint_score: 80,
          adoption_score: 82,
          capability_score: 84,
          quality_score: 83,
          popularity_score: 64,
          release_date: "2026-01-30",
          context_window: 128000,
        },
      ],
      3,
      now
    );

    expect(ids).toEqual(["provider-a-1", "provider-b-1", "provider-c-1"]);
  });

  it("fills remaining homepage slots with new providers before falling back to duplicate-provider rows", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "provider-a-1",
          slug: "openai-gpt-5-4",
          name: "GPT-5.4",
          provider: "OpenAI",
          category: "llm",
          overall_rank: 2,
          economic_footprint_score: 88,
          adoption_score: 90,
          capability_score: 90,
          quality_score: 89,
          popularity_score: 70,
          release_date: "2026-03-01",
          context_window: 128000,
        },
        {
          id: "provider-a-2",
          slug: "openai-o3",
          name: "o3",
          provider: "OpenAI",
          category: "llm",
          overall_rank: 3,
          economic_footprint_score: 85,
          adoption_score: 88,
          capability_score: 88,
          quality_score: 87,
          popularity_score: 68,
          release_date: "2026-02-20",
          context_window: 128000,
        },
        {
          id: "provider-b-1",
          slug: "anthropic-claude-opus-4-8",
          name: "Claude Opus 4.8",
          provider: "Anthropic",
          category: "llm",
          overall_rank: 5,
          economic_footprint_score: 82,
          adoption_score: 84,
          capability_score: 86,
          quality_score: 85,
          popularity_score: 66,
          release_date: "2026-02-10",
          context_window: 128000,
        },
        {
          id: "provider-c-1",
          slug: "google-gemini-3-1-pro",
          name: "Gemini 3.1 Pro",
          provider: "Google",
          category: "llm",
          overall_rank: 7,
          economic_footprint_score: 80,
          adoption_score: 82,
          capability_score: 84,
          quality_score: 83,
          popularity_score: 64,
          release_date: "2026-01-30",
          context_window: 128000,
        },
        {
          id: "provider-d-1",
          slug: "x-ai-grok-4-20",
          name: "Grok 4.20",
          provider: "xAI",
          category: "multimodal",
          overall_rank: 12,
          economic_footprint_score: 76,
          adoption_score: 81,
          capability_score: 79,
          quality_score: 72,
          popularity_score: 58,
          release_date: "2026-03-31",
          description:
            "xAI's latest flagship model with stronger reasoning and multimodal assistant performance.",
          context_window: 128000,
        },
      ],
      4,
      now
    );

    expect(ids).toContain("provider-a-1");
    expect(ids).toContain("provider-b-1");
    expect(ids).toContain("provider-c-1");
    expect(ids).toContain("provider-d-1");
    expect(ids).not.toContain("provider-a-2");
  });

  it("prefers accessible providers over inaccessible closed rows when filling homepage diversity slots", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "anthropic-current",
          slug: "anthropic-current-general",
          name: "Anthropic Current General",
          provider: "Anthropic",
          category: "multimodal",
          is_api_available: true,
          overall_rank: 195,
          economic_footprint_score: 57.7,
          adoption_score: 53.8,
          capability_score: 68.9,
          quality_score: 57.3,
          popularity_score: 40.7,
          release_date: "2026-04-16",
          description:
            "Anthropic's latest flagship. Building on Opus 4.7, it improves software engineering and reliability.",
          context_window: 1000000,
        },
        {
          id: "minimax-unavailable",
          slug: "minimaxai-minimax-m2-5",
          name: "MiniMax-M2.5",
          provider: "MiniMax",
          category: "llm",
          is_api_available: false,
          overall_rank: 208,
          economic_footprint_score: 48.5,
          adoption_score: 68,
          capability_score: 75.3,
          quality_score: 57.4,
          popularity_score: 49,
          release_date: "2026-02-12",
          description:
            "High-performance reasoning model with strong benchmark results but limited current access.",
          context_window: 128000,
        },
        {
          id: "moonshot-accessible",
          slug: "moonshotai-kimi-k2-thinking",
          name: "Kimi K2 Thinking",
          provider: "Moonshot AI",
          category: "llm",
          is_api_available: true,
          overall_rank: 50,
          economic_footprint_score: 41.3,
          adoption_score: 51,
          capability_score: 75.8,
          quality_score: 42.3,
          popularity_score: 45.3,
          release_date: "2025-11-06",
          description:
            "Reasoning-focused model available through current API access.",
          context_window: 128000,
        },
      ],
      2,
      Date.parse("2026-04-20T12:00:00Z")
    );

    expect(ids).toEqual(["anthropic-current", "moonshot-accessible"]);
  });

  it("fills unseen providers before duplicate-provider rows when the diversity target cannot be reached", () => {
    const now = Date.parse("2026-04-20T12:00:00Z");
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "provider-a-1",
          slug: "openai-gpt-5-4",
          name: "GPT-5.4",
          provider: "OpenAI",
          category: "llm",
          is_api_available: true,
          overall_rank: 10,
          economic_footprint_score: 80,
          adoption_score: 78,
          capability_score: 72,
          quality_score: 58,
          popularity_score: 52,
          release_date: "2026-03-05",
          description: "OpenAI's latest generally available flagship.",
          context_window: 128000,
        },
        {
          id: "provider-b-1",
          slug: "anthropic-claude-opus-4-8",
          name: "Claude Opus 4.8",
          provider: "Anthropic",
          category: "multimodal",
          is_api_available: true,
          overall_rank: 12,
          economic_footprint_score: 78,
          adoption_score: 75,
          capability_score: 71,
          quality_score: 57,
          popularity_score: 50,
          release_date: "2026-04-16",
          description: "Anthropic's latest flagship, building on Opus 4.7.",
          context_window: 1000000,
        },
        {
          id: "provider-c-1",
          slug: "google-gemini-3-1-pro",
          name: "Gemini 3.1 Pro",
          provider: "Google",
          category: "multimodal",
          is_api_available: true,
          overall_rank: 15,
          economic_footprint_score: 76,
          adoption_score: 74,
          capability_score: 70,
          quality_score: 56,
          popularity_score: 49,
          release_date: "2026-02-19",
          description: "Google's latest flagship multimodal model.",
          context_window: 200000,
        },
        {
          id: "provider-d-1",
          slug: "x-ai-grok-4-20",
          name: "Grok 4.20",
          provider: "xAI",
          category: "multimodal",
          is_api_available: true,
          overall_rank: 18,
          economic_footprint_score: 74,
          adoption_score: 73,
          capability_score: 69,
          quality_score: 55,
          popularity_score: 48,
          release_date: "2026-03-31",
          description: "xAI's latest flagship model.",
          context_window: 128000,
        },
        {
          id: "provider-e-1",
          slug: "deepseek-deepseek-v3-2-speciale",
          name: "DeepSeek V3.2 Speciale",
          provider: "DeepSeek",
          category: "llm",
          is_api_available: true,
          is_open_weights: true,
          overall_rank: 13,
          economic_footprint_score: 73,
          adoption_score: 72,
          capability_score: 80,
          quality_score: 66,
          popularity_score: 49,
          release_date: "2025-12-01",
          context_window: 128000,
        },
        {
          id: "provider-f-1",
          slug: "qwen-qwen3-5-397b-a17b",
          name: "Qwen3.5 397B A17B",
          provider: "Qwen",
          category: "llm",
          is_api_available: true,
          is_open_weights: true,
          overall_rank: 20,
          economic_footprint_score: 71,
          adoption_score: 70,
          capability_score: 76,
          quality_score: 55,
          popularity_score: 47,
          release_date: "2026-02-16",
          context_window: 128000,
        },
        {
          id: "provider-g-1",
          slug: "alibaba-qwen3-235b",
          name: "Qwen3-235B",
          provider: "Alibaba",
          category: "llm",
          is_api_available: true,
          is_open_weights: true,
          overall_rank: 25,
          economic_footprint_score: 69,
          adoption_score: 69,
          capability_score: 75,
          quality_score: 54,
          popularity_score: 46,
          release_date: "2025-04-29",
          context_window: 128000,
        },
        {
          id: "provider-h-1",
          slug: "meta-llama-4-maverick",
          name: "Llama 4 Maverick",
          provider: "Meta",
          category: "llm",
          is_api_available: true,
          is_open_weights: true,
          overall_rank: 28,
          economic_footprint_score: 68,
          adoption_score: 68,
          capability_score: 74,
          quality_score: 53,
          popularity_score: 45,
          release_date: "2025-04-05",
          context_window: 128000,
        },
        {
          id: "provider-a-2",
          slug: "x-openai-grok-3-like-duplicate",
          name: "OpenAI Duplicate",
          provider: "OpenAI",
          category: "llm",
          is_api_available: true,
          overall_rank: 5,
          economic_footprint_score: 85,
          adoption_score: 84,
          capability_score: 83,
          quality_score: 80,
          popularity_score: 60,
          release_date: "2026-03-01",
          description: "Duplicate provider row that should not win before new providers.",
          context_window: 128000,
        },
        {
          id: "provider-i-1",
          slug: "moonshotai-kimi-k2-thinking",
          name: "Kimi K2 Thinking",
          provider: "Moonshot AI",
          category: "llm",
          is_api_available: true,
          overall_rank: 50,
          economic_footprint_score: 41.3,
          adoption_score: 51,
          capability_score: 75.8,
          quality_score: 42.3,
          popularity_score: 45.3,
          release_date: "2025-11-06",
          description: "Reasoning-focused model available through current API access.",
          context_window: 128000,
        },
      ],
      9,
      now
    );

    expect(ids).toContain("provider-i-1");
    expect(ids).toContain("provider-a-2");
    expect(ids.indexOf("provider-i-1")).toBeLessThan(ids.indexOf("provider-a-2"));
  });

  it("uses score order with at most two rows per provider after eight distinct providers", () => {
    const providers = [
      { id: "openai-one", provider: "OpenAI", score: 96 },
      { id: "openai-two", provider: "OpenAI", score: 95 },
      { id: "openai-three", provider: "OpenAI", score: 94 },
      { id: "anthropic-one", provider: "Anthropic", score: 93 },
      { id: "google-one", provider: "Google", score: 92 },
      { id: "xai-one", provider: "xAI", score: 91 },
      { id: "deepseek-one", provider: "DeepSeek", score: 90 },
      { id: "qwen-one", provider: "Qwen", score: 89 },
      { id: "meta-one", provider: "Meta", score: 88 },
      { id: "mistral-one", provider: "Mistral AI", score: 87 },
      { id: "minimax-one", provider: "MiniMax", score: 72 },
    ];
    const candidates = providers.map(({ id, provider, score }, index) => ({
      id,
      slug: `${id}-model`,
      name: `${id} model`,
      provider,
      category: "llm",
      is_api_available: true,
      overall_rank: index + 1,
      economic_footprint_score: score,
      adoption_score: score,
      capability_score: score,
      quality_score: score,
      popularity_score: score,
      release_date: "2026-03-01",
      description: "General-purpose production model.",
      context_window: 128000,
    }));

    const ids = selectHomepageTopModelIds(candidates, 10, now);

    expect(ids).toHaveLength(10);
    expect(ids).toContain("openai-one");
    expect(ids).toContain("openai-two");
    expect(ids).not.toContain("openai-three");
    expect(ids).toContain("minimax-one");
  });

  it("counts Alibaba and Qwen as one provider family for homepage diversity", () => {
    const now = Date.parse("2026-08-25T12:00:00Z");
    const candidates = [
      { id: "qwen-current", provider: "Qwen", score: 95 },
      { id: "alibaba-qwen-older", provider: "Alibaba", score: 94 },
      { id: "anthropic", provider: "Anthropic", score: 93 },
      { id: "openai", provider: "OpenAI", score: 92 },
    ].map(({ id, provider, score }, index) => ({
      id,
      slug: id,
      name: id,
      provider,
      category: "llm",
      is_api_available: true,
      overall_rank: index + 1,
      economic_footprint_score: score,
      adoption_score: score,
      capability_score: score,
      quality_score: score,
      popularity_score: score,
      release_date: "2026-08-01",
      description: "Current production model.",
      context_window: 128000,
    }));

    const ids = selectHomepageTopModelIds(candidates, 3, now);

    expect(ids).toEqual(["qwen-current", "anthropic", "openai"]);
  });

  it("prefers a recent verified frontier release while benchmarks catch up", () => {
    const ids = selectHomepageTopModelIds(
      [
        {
          id: "glm-5-2",
          slug: "zai-org-glm-5-2",
          name: "GLM-5.2",
          provider: "Z.ai",
          category: "llm",
          is_api_available: true,
          overall_rank: 10,
          economic_footprint_score: 62,
          adoption_score: 68,
          capability_score: 92,
          quality_score: 90,
          popularity_score: 58,
          release_date: "2026-06-16",
          description: "Z.ai reasoning and coding model.",
        },
        {
          id: "glm-5-3",
          slug: "z-ai-glm-5-3",
          name: "GLM-5.3",
          provider: "Z.ai",
          category: "llm",
          is_api_available: true,
          overall_rank: 239,
          economic_footprint_score: 42,
          adoption_score: 48,
          capability_score: 57,
          quality_score: 39,
          popularity_score: 34,
          release_date: "2026-08-14",
          description:
            "Z.ai's frontier coding and cyber-reasoning model for long-horizon agentic work.",
        },
      ],
      1,
      Date.parse("2026-08-25T12:00:00Z")
    );

    expect(ids).toEqual(["glm-5-3"]);
  });
});
