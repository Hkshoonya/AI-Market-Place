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
});
