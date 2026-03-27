import { describe, expect, it } from "vitest";

import {
  buildModelAliasIndex,
  resolveAliasFamilyModelIds,
  resolveMatchedAliasFamilyModelIds,
} from "./model-alias-resolver";

describe("model alias resolver", () => {
  it("returns sibling aliases and dated variants for the same benchmark family", () => {
    const index = buildModelAliasIndex([
      {
        id: "base",
        slug: "deepseek-r1",
        name: "DeepSeek R1",
        provider: "DeepSeek",
      },
      {
        id: "provider-alias",
        slug: "deepseek-ai-deepseek-r1",
        name: "DeepSeek R1",
        provider: "DeepSeek AI",
      },
      {
        id: "dated",
        slug: "deepseek-r1-2025-01-20",
        name: "DeepSeek R1 2025-01-20",
        provider: "DeepSeek",
      },
    ]);

    const modelIds = resolveAliasFamilyModelIds(index, {
      slugCandidates: ["deepseek-r1"],
      nameCandidates: ["deepseek r1", "deepseek-r1"],
    });

    expect(modelIds).toEqual(["base", "provider-alias", "dated"]);
  });

  it("expands fuzzy alias matches into provider-prefixed sibling model rows", () => {
    const models = [
      {
        id: "deepseek-base",
        slug: "deepseek-deepseek-v3-2",
        name: "DeepSeek-V3.2",
        provider: "DeepSeek",
      },
      {
        id: "deepseek-provider",
        slug: "deepseek-ai-deepseek-v3-2",
        name: "DeepSeek-V3.2",
        provider: "DeepSeek AI",
      },
      {
        id: "glm-base",
        slug: "z-ai-glm-5",
        name: "GLM-5",
        provider: "Z.ai",
      },
      {
        id: "glm-provider",
        slug: "zai-org-glm-5",
        name: "GLM-5",
        provider: "Z.ai Org",
      },
      {
        id: "qwen-hyphenated",
        slug: "qwen-qwen2-5-7b-instruct",
        name: "Qwen2.5-7B-Instruct",
        provider: "Qwen",
      },
      {
        id: "qwen-spaced",
        slug: "qwen-qwen-2-5-7b-instruct",
        name: "Qwen2.5 7B Instruct",
        provider: "Alibaba / Qwen",
      },
      {
        id: "qwen-coder",
        slug: "qwen-qwen-2-5-coder-32b-instruct",
        name: "qwen-2.5-coder-32b-instruct",
        provider: "Qwen",
      },
      {
        id: "yi-lightning",
        slug: "01ai-yi-lightning",
        name: "Yi-Lightning",
        provider: "01.AI",
      },
    ];

    const index = buildModelAliasIndex(models);

    expect(
      resolveMatchedAliasFamilyModelIds(index, models, ["DeepSeek-V3.2"])
    ).toEqual(["deepseek-base", "deepseek-provider"]);

    expect(resolveMatchedAliasFamilyModelIds(index, models, ["GLM-5"])).toEqual([
      "glm-base",
      "glm-provider",
    ]);

    expect(
      resolveMatchedAliasFamilyModelIds(index, models, ["Qwen/Qwen2.5-7B-Instruct"])
    ).toEqual(["qwen-hyphenated", "qwen-spaced"]);

    expect(
      resolveMatchedAliasFamilyModelIds(index, models, ["Qwen2.5-Coder-32B-Instruct"])
    ).toEqual(["qwen-coder"]);

    expect(
      resolveMatchedAliasFamilyModelIds(index, models, ["yi-lightning"])
    ).toEqual(["yi-lightning"]);

    expect(
      resolveMatchedAliasFamilyModelIds(index, models, ["Qwen2-VL-7B-Instruct"])
    ).toEqual([]);
  });

  it("normalizes punctuation variants and safe qualifier variants into the same family", () => {
    const models = [
      {
        id: "grok-spaced",
        slug: "x-ai-grok-3",
        name: "Grok 3",
        provider: "x.ai",
      },
      {
        id: "grok-hyphenated",
        slug: "xai-grok-3",
        name: "Grok-3",
        provider: "xAI",
      },
      {
        id: "gpt-4o",
        slug: "openai-gpt-4o",
        name: "GPT-4o",
        provider: "OpenAI",
      },
      {
        id: "gpt-4o-extended",
        slug: "openai-gpt-4o-extended",
        name: "GPT-4o (extended)",
        provider: "OpenAI",
      },
      {
        id: "claude-base",
        slug: "anthropic-claude-3-7-sonnet",
        name: "Claude 3.7 Sonnet",
        provider: "Anthropic",
      },
      {
        id: "claude-thinking",
        slug: "anthropic-claude-3-7-sonnet-thinking",
        name: "Claude 3.7 Sonnet (thinking)",
        provider: "Anthropic",
      },
    ];

    const index = buildModelAliasIndex(models);

    expect(resolveMatchedAliasFamilyModelIds(index, models, ["Grok 3"])).toEqual([
      "grok-spaced",
      "grok-hyphenated",
    ]);

    expect(resolveMatchedAliasFamilyModelIds(index, models, ["GPT-4o"])).toEqual([
      "gpt-4o",
      "gpt-4o-extended",
    ]);

    expect(
      resolveMatchedAliasFamilyModelIds(index, models, ["Claude 3.7 Sonnet"])
    ).toEqual(["claude-base"]);
  });
});
