import { describe, expect, it } from "vitest";

import {
  collapsePublicModelFamilies,
  dedupePublicModelFamilies,
  getPublicSurfaceSeriesKey,
} from "./public-families";

describe("public model family dedupe", () => {
  it("collapses alias-family siblings into one representative row", () => {
    const families = collapsePublicModelFamilies([
      {
        id: "deepseek-base",
        slug: "deepseek-v3",
        name: "DeepSeek-V3",
        provider: "DeepSeek",
        category: "llm",
        overall_rank: 6,
        quality_score: 78.5,
        hf_downloads: 320_000_000,
      },
      {
        id: "deepseek-router",
        slug: "deepseek-deepseek-chat",
        name: "DeepSeek V3",
        provider: "DeepSeek",
        category: "llm",
        overall_rank: 93,
        quality_score: 59.1,
        hf_downloads: 0,
      },
      {
        id: "deepseek-hf",
        slug: "deepseek-ai-deepseek-v3",
        name: "deepseek-v3",
        provider: "DeepSeek",
        category: "specialized",
        overall_rank: 48,
        quality_score: 75.8,
        hf_downloads: 5_011_355,
      },
    ]);

    expect(families).toHaveLength(1);
    expect(families[0]?.representative.slug).toBe("deepseek-v3");
    expect(families[0]?.variantCount).toBe(3);
  });

  it("prefers the base undated model over a dated sibling when both represent the same public family", () => {
    const deduped = dedupePublicModelFamilies([
      {
        id: "o3-base",
        slug: "openai-o3",
        name: "o3",
        provider: "OpenAI",
        category: "llm",
        overall_rank: 1,
        quality_score: 64.5,
        hf_downloads: 0,
      },
      {
        id: "o3-dated",
        slug: "openai-o3-2025-04-16",
        name: "o3-2025-04-16",
        provider: "OpenAI",
        category: "llm",
        overall_rank: 20,
        quality_score: 63.7,
        hf_downloads: 0,
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.slug).toBe("openai-o3");
  });

  it("keeps distinct families separate while reducing duplicate public rows", () => {
    const deduped = dedupePublicModelFamilies([
      {
        id: "gpt-4o",
        slug: "openai-gpt-4o",
        name: "gpt-4o",
        provider: "OpenAI",
        category: "llm",
        overall_rank: 21,
        quality_score: 79.9,
        hf_downloads: 590_545,
      },
      {
        id: "gpt-4o-dated",
        slug: "openai-gpt-4o-2024-08-06",
        name: "gpt-4o-2024-08-06",
        provider: "OpenAI",
        category: "llm",
        overall_rank: 10,
        quality_score: 57.9,
        hf_downloads: 0,
      },
      {
        id: "gpt-4o-mini",
        slug: "openai-gpt-4o-mini",
        name: "GPT-4o Mini",
        provider: "OpenAI",
        category: "multimodal",
        overall_rank: 37,
        quality_score: 51.3,
        hf_downloads: 0,
      },
    ]);

    expect(deduped.map((model) => model.slug)).toEqual([
      "openai-gpt-4o",
      "openai-gpt-4o-mini",
    ]);
  });

  it("prefers general-purpose rows over specialized duplicates inside the same family", () => {
    const deduped = dedupePublicModelFamilies([
      {
        id: "grok-general",
        slug: "x-ai-grok-4",
        name: "Grok 4",
        provider: "xAI",
        category: "llm",
        overall_rank: 30,
        quality_score: 66.1,
        capability_score: 84.7,
        is_api_available: true,
        is_open_weights: false,
        release_date: "2025-08-20",
      },
      {
        id: "grok-specialized",
        slug: "xai-grok-4",
        name: "grok-4",
        provider: "xAI",
        category: "specialized",
        overall_rank: 197,
        quality_score: 77.9,
        capability_score: 88.3,
        is_api_available: true,
        is_open_weights: true,
        release_date: "2026-03-03",
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.slug).toBe("x-ai-grok-4");
  });

  it("collapses provider alias prefixes into the same public surface series", () => {
    const canonical = getPublicSurfaceSeriesKey({
      slug: "minimax-minimax-m2-7-highspeed",
      name: "MiniMax M2.7 Highspeed",
      provider: "MiniMax",
    });
    const alias = getPublicSurfaceSeriesKey({
      slug: "minimaxai-minimax-m2-7",
      name: "MiniMax M2.7",
      provider: "MiniMax",
    });
    const splitAlias = getPublicSurfaceSeriesKey({
      slug: "z-ai-glm-5",
      name: "GLM-5",
      provider: "Z.ai",
    });
    const compactAlias = getPublicSurfaceSeriesKey({
      slug: "zai-org-glm-5",
      name: "GLM-5",
      provider: "Z.ai",
    });

    expect(alias).toBe(canonical);
    expect(compactAlias).toBe(splitAlias);
  });

  it("collapses DeepSeek provider aliases and Meta Llama branding into the same series", () => {
    const deepseekCanonical = getPublicSurfaceSeriesKey({
      slug: "deepseek-deepseek-v3-2",
      name: "DeepSeek V3.2",
      provider: "DeepSeek",
    });
    const deepseekAlias = getPublicSurfaceSeriesKey({
      slug: "deepseek-ai-deepseek-v3-2",
      name: "DeepSeek-V3.2",
      provider: "DeepSeek",
    });
    const metaCanonical = getPublicSurfaceSeriesKey({
      slug: "meta-llama-llama-3-1-405b-instruct",
      name: "Llama 3.1 405B Instruct",
      provider: "Meta",
    });
    const metaAlias = getPublicSurfaceSeriesKey({
      slug: "meta-meta-llama-3-1-405b-instruct",
      name: "meta-llama-3.1-405b-instruct",
      provider: "Meta",
    });

    expect(deepseekAlias).toBe(deepseekCanonical);
    expect(metaAlias).toBe(metaCanonical);
  });

  it("collapses DeepSeek endpoint aliases and release snapshots into the same series", () => {
    const deepseekV3Base = getPublicSurfaceSeriesKey({
      slug: "deepseek-v3",
      name: "DeepSeek-V3",
      provider: "DeepSeek",
    });
    const deepseekV3Chat = getPublicSurfaceSeriesKey({
      slug: "deepseek-deepseek-chat",
      name: "DeepSeek V3",
      provider: "DeepSeek",
    });
    const deepseekV3Snapshot = getPublicSurfaceSeriesKey({
      slug: "deepseek-deepseek-chat-v3-0324",
      name: "DeepSeek V3 0324",
      provider: "DeepSeek",
    });
    const deepseekR1Base = getPublicSurfaceSeriesKey({
      slug: "deepseek-r1",
      name: "DeepSeek-R1",
      provider: "DeepSeek",
    });
    const deepseekR1Snapshot = getPublicSurfaceSeriesKey({
      slug: "deepseek-deepseek-r1-0528",
      name: "R1 0528",
      provider: "DeepSeek",
    });

    expect(deepseekV3Chat).toBe(deepseekV3Base);
    expect(deepseekV3Snapshot).toBe(deepseekV3Base);
    expect(deepseekR1Snapshot).toBe(deepseekR1Base);
  });

  it("collapses LiteRT packaging suffixes into the base public series", () => {
    const litert = getPublicSurfaceSeriesKey({
      slug: "google-gemma-3n-e4b-it-litert-lm",
      name: "gemma-3n-E4B-it-litert-lm",
      provider: "Google",
    });
    const base = getPublicSurfaceSeriesKey({
      slug: "google-gemma-3n-e4b-it",
      name: "Gemma 3n",
      provider: "Google",
    });

    expect(litert).toBe(base);
  });

  it("does not emit overlapping duplicate families when a late variant resolves back to an existing cluster", () => {
    const families = collapsePublicModelFamilies([
      {
        id: "gpt-4o-base",
        slug: "openai-gpt-4o",
        name: "gpt-4o",
        provider: "OpenAI",
        category: "llm",
        overall_rank: 21,
        quality_score: 79.9,
        hf_downloads: 590_545,
      },
      {
        id: "gpt-4o-dated",
        slug: "openai-gpt-4o-2024-08-06",
        name: "gpt-4o-2024-08-06",
        provider: "OpenAI",
        category: "llm",
        overall_rank: 10,
        quality_score: 57.9,
        hf_downloads: 0,
      },
      {
        id: "gpt-4o-extended",
        slug: "openai-gpt-4o-extended",
        name: "GPT-4o (extended)",
        provider: "OpenAI",
        category: "multimodal",
        overall_rank: 80,
        quality_score: 51.2,
        hf_downloads: 0,
      },
    ]);

    expect(families).toHaveLength(1);
    expect(families[0]?.variantCount).toBe(3);
  });

  it("collapses exact normalized name/provider duplicates even when alias lookup misses them", () => {
    const deduped = dedupePublicModelFamilies([
      {
        id: "gpt4-current",
        slug: "openai-gpt-4",
        name: "GPT-4",
        provider: "OpenAI",
        category: "llm",
        overall_rank: 282,
        quality_score: 13.1,
        hf_downloads: 0,
      },
      {
        id: "gpt4-older",
        slug: "openai-gpt-4-0314",
        name: "GPT-4 (older v0314)",
        provider: "OpenAI",
        category: "llm",
        overall_rank: 190,
        quality_score: 34.5,
        hf_downloads: 0,
      },
    ]);

    expect(deduped).toHaveLength(1);
  });

  it("prefers the canonical provider-prefixed slug over an older alias slug in the same family", () => {
    const deduped = dedupePublicModelFamilies([
      {
        id: "glm5-canonical",
        slug: "z-ai-glm-5",
        name: "GLM-5",
        provider: "Z.ai",
        category: "llm",
        overall_rank: 153,
        quality_score: 38.8,
        popularity_score: 43.8,
        hf_downloads: 0,
      },
      {
        id: "glm5-alias",
        slug: "zai-org-glm-5",
        name: "GLM-5",
        provider: "Z.ai",
        category: "llm",
        overall_rank: 396,
        quality_score: 57,
        popularity_score: 46.2,
        hf_downloads: 0,
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.slug).toBe("z-ai-glm-5");
  });

  it("prefers the cleaner public slug over machine snapshot variants", () => {
    const deduped = dedupePublicModelFamilies([
      {
        id: "imagen-clean",
        slug: "google-imagen-4",
        name: "Imagen 4",
        provider: "Google",
        category: "image_generation",
        overall_rank: 480,
        quality_score: 24.7,
        hf_downloads: 0,
      },
      {
        id: "imagen-snapshot",
        slug: "google-imagen-4-0-generate-001",
        name: "Imagen 4",
        provider: "Google",
        category: "image_generation",
        overall_rank: 538,
        quality_score: 0,
        hf_downloads: 0,
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.slug).toBe("google-imagen-4");
  });

  it("collapses multi-agent and highspeed suffixes into the same public surface series", () => {
    const base = getPublicSurfaceSeriesKey({
      slug: "x-ai-grok-4-20",
      name: "Grok 4.20",
      provider: "xAI",
    });
    const multiAgent = getPublicSurfaceSeriesKey({
      slug: "x-ai-grok-4-20-multi-agent",
      name: "Grok 4.20 Multi-Agent",
      provider: "xAI",
    });
    const highspeed = getPublicSurfaceSeriesKey({
      slug: "minimax-minimax-m2-7-highspeed",
      name: "MiniMax M2.7 Highspeed",
      provider: "MiniMax",
    });
    const standard = getPublicSurfaceSeriesKey({
      slug: "minimax-minimax-m2-7",
      name: "MiniMax M2.7",
      provider: "MiniMax",
    });

    expect(multiAgent).toBe(base);
    expect(highspeed).toBe(standard);
  });

  it("treats v1-0 and v1 sized variants as the same public surface series", () => {
    const small = getPublicSurfaceSeriesKey({
      slug: "microsoft-harrier-oss-v1-0-6b",
      name: "Harrier OSS v1.0 6B",
      provider: "Microsoft",
    });
    const large = getPublicSurfaceSeriesKey({
      slug: "microsoft-harrier-oss-v1-27b",
      name: "Harrier OSS v1 27B",
      provider: "Microsoft",
    });

    expect(small).toBe(large);
  });

  it("prefers a fresher non-lifecycle representative over an older compatibility variant in the same family", () => {
    const deduped = dedupePublicModelFamilies([
      {
        id: "opus-current",
        slug: "anthropic-claude-opus-4-7",
        name: "Claude Opus 4.7",
        provider: "Anthropic",
        category: "multimodal",
        overall_rank: 312,
        quality_score: 44.8,
        capability_score: 49.2,
        adoption_score: 61.6,
        popularity_score: 39,
        economic_footprint_score: 0,
        release_date: "2026-04-16",
        description:
          "Opus 4.7 is the next generation of Anthropic's Opus family. Building on Opus 4.6, it improves advanced software engineering and reliability.",
        hf_downloads: 0,
      },
      {
        id: "opus-compat",
        slug: "anthropic-claude-opus-4-7-older",
        name: "Claude Opus 4.7 (older)",
        provider: "Anthropic",
        category: "multimodal",
        overall_rank: 14,
        quality_score: 60.3,
        capability_score: 80.2,
        adoption_score: 55.4,
        popularity_score: 47.8,
        economic_footprint_score: 53.6,
        release_date: "2025-12-12",
        description:
          "Previous flagship Claude Opus release retained for compatibility after the Claude Opus 4.7 launch. Superseded by the latest release.",
        hf_downloads: 0,
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.slug).toBe("anthropic-claude-opus-4-7");
  });

  it("prefers the standard release over a preview sibling in the same family", () => {
    const deduped = dedupePublicModelFamilies([
      {
        id: "gemini-pro",
        slug: "google-gemini-3-1-pro",
        name: "Gemini 3.1 Pro",
        provider: "Google",
        category: "multimodal",
        overall_rank: 46,
        quality_score: 55.2,
        capability_score: 69.3,
        adoption_score: 52.6,
        popularity_score: 42.1,
        economic_footprint_score: 31.8,
        is_api_available: true,
        release_date: "2026-02-19",
        description:
          "Gemini 3.1 Pro is Google's standard frontier multimodal release for broad production use.",
        hf_downloads: 0,
      },
      {
        id: "gemini-pro-preview",
        slug: "google-gemini-3-1-pro-preview",
        name: "Gemini 3.1 Pro Preview",
        provider: "Google",
        category: "multimodal",
        overall_rank: 15,
        quality_score: 60.6,
        capability_score: 84.5,
        adoption_score: 57.6,
        popularity_score: 47.4,
        economic_footprint_score: 47.2,
        is_api_available: true,
        release_date: "2026-02-19",
        description:
          "Gemini 3.1 Pro Preview is the preview access track for Google's frontier reasoning model.",
        hf_downloads: 0,
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.slug).toBe("google-gemini-3-1-pro");
  });

  it("prefers the canonical DeepSeek family representative over alias and snapshot variants", () => {
    const deduped = dedupePublicModelFamilies([
      {
        id: "deepseek-v3-base",
        slug: "deepseek-v3",
        name: "DeepSeek-V3",
        provider: "DeepSeek",
        category: "llm",
        overall_rank: 88,
        quality_score: 79.9,
        capability_score: 77,
        adoption_score: 74.7,
        popularity_score: 77.6,
        economic_footprint_score: 46.7,
        hf_downloads: 0,
      },
      {
        id: "deepseek-v3-chat",
        slug: "deepseek-deepseek-chat",
        name: "DeepSeek V3",
        provider: "DeepSeek",
        category: "llm",
        overall_rank: 5,
        quality_score: 63.2,
        capability_score: 72,
        adoption_score: 59.7,
        popularity_score: 58.3,
        economic_footprint_score: 50.2,
        hf_downloads: 0,
      },
      {
        id: "deepseek-v3-snapshot",
        slug: "deepseek-deepseek-chat-v3-0324",
        name: "DeepSeek V3 0324",
        provider: "DeepSeek",
        category: "llm",
        overall_rank: 4,
        quality_score: 65.7,
        capability_score: 75.8,
        adoption_score: 58.5,
        popularity_score: 55.8,
        economic_footprint_score: 48.4,
        hf_downloads: 0,
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.slug).toBe("deepseek-v3");
  });
});
