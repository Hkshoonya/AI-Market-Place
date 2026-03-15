import { describe, expect, it } from "vitest";

import {
  collapsePublicModelFamilies,
  dedupePublicModelFamilies,
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
});
