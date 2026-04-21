import { describe, expect, it } from "vitest";

import {
  buildFallbackOverview,
  getModelDisplayDescription,
  getParameterDisplay,
} from "./presentation";

describe("model presentation helpers", () => {
  it("falls back to official known-model descriptions when catalog text is missing", () => {
    const result = getModelDisplayDescription({
      slug: "openai-o3",
      name: "o3",
      provider: "OpenAI",
      category: "llm",
      description: null,
      short_description: null,
      is_open_weights: false,
      context_window: 200000,
      capabilities: { reasoning: true, coding: true, vision: true },
    });

    expect(result.text).toMatch(/most powerful reasoning model/i);
    expect(result.source).toBe("official_catalog");
  });

  it("uses existing MiniMax and Z.ai official catalogs for display descriptions", () => {
    const minimax = getModelDisplayDescription({
      slug: "minimax-minimax-m2-7",
      name: "MiniMax M2.7",
      provider: "MiniMax",
      category: "llm",
      description: null,
      short_description: null,
      is_open_weights: false,
    });

    const zai = getModelDisplayDescription({
      slug: "z-ai-glm-5",
      name: "GLM-5",
      provider: "Z.ai",
      category: "llm",
      description: null,
      short_description: null,
      is_open_weights: false,
    });

    expect(minimax.source).toBe("official_catalog");
    expect(minimax.text).toMatch(/reasoning and coding model/i);
    expect(zai.source).toBe("official_catalog");
    expect(zai.text).toMatch(/flagship reasoning and coding model family/i);
  });

  it("matches dated and reordered Claude variants to the official catalog", () => {
    const result = getModelDisplayDescription({
      slug: "anthropic-claude-opus-4-5-20251101-v1",
      name: "claude-opus-4-5-20251101-v1",
      provider: "Anthropic",
      category: "multimodal",
      description: null,
      short_description: null,
      is_open_weights: false,
    });

    expect(result.source).toBe("official_catalog");
    expect(result.text).toMatch(/superseded by Claude Opus 4\.7/i);
  });

  it("matches provider variants like MiniMax highspeed builds to the base official model", () => {
    const result = getModelDisplayDescription({
      slug: "minimax-minimax-m2-5-highspeed",
      name: "minimax-m2-5-highspeed",
      provider: "MiniMax",
      category: "llm",
      description: null,
      short_description: null,
      is_open_weights: false,
    });

    expect(result.source).toBe("official_catalog");
    expect(result.text).toMatch(/reasoning/i);
  });

  it("uses the xAI official catalog for Grok display descriptions", () => {
    const result = getModelDisplayDescription({
      slug: "xai-grok-4-fast",
      name: "Grok 4 Fast",
      provider: "xAI",
      category: "llm",
      description: null,
      short_description: null,
      is_open_weights: false,
    });

    expect(result.source).toBe("official_catalog");
    expect(result.text).toMatch(/lower-latency grok 4 variant/i);
  });

  it("uses the Moonshot official catalog for Kimi display descriptions", () => {
    const result = getModelDisplayDescription({
      slug: "moonshot-kimi-k2-5",
      name: "kimi-k2.5",
      provider: "Moonshot AI",
      category: "multimodal",
      description: null,
      short_description: null,
      is_open_weights: false,
    });

    expect(result.source).toBe("official_catalog");
    expect(result.text).toMatch(/most intelligent model/i);
  });

  it("matches OpenAI chat and dated variants to nearby official family entries", () => {
    const chatVariant = getModelDisplayDescription({
      slug: "openai-gpt-5-3-chat-latest",
      name: "gpt-5-3-chat-latest",
      provider: "OpenAI",
      category: "llm",
      description: null,
      short_description: null,
      is_open_weights: false,
    });
    const datedVariant = getModelDisplayDescription({
      slug: "openai-gpt-3-5-turbo-instruct-0914",
      name: "gpt-3-5-turbo-instruct-0914",
      provider: "OpenAI",
      category: "llm",
      description: null,
      short_description: null,
      is_open_weights: false,
    });

    expect(chatVariant.source).toBe("official_catalog");
    expect(chatVariant.text).toMatch(/gpt-5 family release/i);
    expect(datedVariant.source).toBe("official_catalog");
    expect(datedVariant.text).toMatch(/gpt-3\.5|general-purpose language model/i);
  });

  it("matches Google family variants to their official catalog entries", () => {
    const gemmaVariant = getModelDisplayDescription({
      slug: "google-gemma-3n-e4b-it",
      name: "gemma-3n-e4b-it",
      provider: "Google",
      category: "llm",
      description: null,
      short_description: null,
      is_open_weights: true,
    });
    const imagenVariant = getModelDisplayDescription({
      slug: "google-imagen-4-0-fast-generate-001",
      name: "imagen-4.0-fast-generate-001",
      provider: "Google",
      category: "image_generation",
      description: null,
      short_description: null,
      is_open_weights: false,
    });

    expect(gemmaVariant.source).toBe("official_catalog");
    expect(gemmaVariant.text).toMatch(/compact multimodal gemma 3n family/i);
    expect(imagenVariant.source).toBe("official_catalog");
    expect(imagenVariant.text).toMatch(/text-to-image model/i);
  });

  it("infers parameter labels from model identity when the database field is empty", () => {
    const result = getParameterDisplay({
      slug: "google-gemma-3-27b",
      name: "Gemma 3 27B",
      provider: "Google",
      is_open_weights: true,
      parameter_count: null,
    });

    expect(result.label).toBe("27B");
    expect(result.value).toBe(27_000_000_000);
    expect(result.source).toBe("inferred");
  });

  it("shows proprietary models as undisclosed instead of blank params", () => {
    const result = getParameterDisplay({
      slug: "openai-o3",
      name: "o3",
      provider: "OpenAI",
      is_open_weights: false,
      parameter_count: null,
    });

    expect(result.label).toBe("Undisclosed");
    expect(result.value).toBeNull();
    expect(result.source).toBe("undisclosed");
  });

  it("builds a usable fallback overview when no curated model overview exists", () => {
    const result = buildFallbackOverview({
      slug: "google-gemini-2-5-pro",
      name: "Gemini 2.5 Pro",
      provider: "Google",
      category: "multimodal",
      description: null,
      short_description: null,
      is_open_weights: false,
      context_window: 1_000_000,
      capabilities: {
        reasoning: true,
        coding: true,
        vision: true,
        function_calling: true,
      },
    });

    expect(result.summary).toMatch(/Gemini 2\.5/i);
    expect(result.best_for.length).toBeGreaterThan(0);
    expect(result.generated_by).toBe("catalog_fallback");
  });

  it("cleans markdown-heavy catalog descriptions into readable summaries", () => {
    const result = getModelDisplayDescription({
      slug: "microsoft-phi-4",
      name: "Phi 4",
      provider: "Microsoft",
      category: "llm",
      description:
        "[Microsoft Research](/microsoft) Phi-4 is designed to perform well in complex reasoning tasks. For more information, please see [Phi-4 Technical Report](https://example.com/report).",
      short_description: null,
      is_open_weights: false,
    });

    expect(result.source).toBe("catalog");
    expect(result.text).toBe(
      "Microsoft Research Phi-4 is designed to perform well in complex reasoning tasks."
    );
  });

  it("falls back to a generated description when the catalog text is clearly wrong", () => {
    const result = getModelDisplayDescription({
      slug: "google-deepmind-sonnet",
      name: "sonnet",
      provider: "Google",
      category: "specialized",
      description: "TensorFlow-based neural network library",
      short_description: null,
      is_open_weights: false,
      context_window: null,
      capabilities: { reasoning: true },
    });

    expect(result.source).toBe("synthetic");
    expect(result.text).toMatch(/Google specialized model/i);
  });
});
