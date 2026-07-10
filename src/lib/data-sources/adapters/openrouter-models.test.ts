import { describe, expect, it } from "vitest";

import { __testables } from "./openrouter-models";

describe("openrouter model record mapping", () => {
  it("maps open-weight models to enum-safe license fields", () => {
    const record = __testables.buildModelRecord({
      id: "meta-llama/llama-4-maverick",
      name: "Meta: Llama 4 Maverick",
      description: "Open weight model with Apache style release",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.license).toBe("open_source");
    expect(record.license_name).toBe("Llama Community License");
    expect(record.is_open_weights).toBe(true);
  });

  it("uses the complete curated catalog for Meta release metadata", () => {
    const record = __testables.buildModelRecord({
      id: "meta-llama/llama-3.1-405b-instruct",
      name: "Meta: Llama 3.1 405B Instruct",
      created: 1772496000,
      description: "Generic router metadata",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record).toMatchObject({
      name: "Llama 3.1 405B Instruct",
      release_date: "2024-07-23",
      context_window: 131072,
      hf_model_id: "meta-llama/Llama-3.1-405B-Instruct",
      is_open_weights: true,
    });
  });

  it("canonicalizes provider names for known router prefixes", () => {
    const record = __testables.buildModelRecord({
      id: "openai/gpt-4o",
      name: "OpenAI: GPT-4o",
      description: "Frontier model",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.provider).toBe("OpenAI");
  });

  it("uses curated OpenAI metadata for dated GPT-5.4 releases", () => {
    const record = __testables.buildModelRecord({
      id: "openai/gpt-5.4-2026-03-05",
      name: "OpenAI: GPT-5.4",
      description: "Generic router description",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.name).toBe("GPT-5.4");
    expect(record.category).toBe("llm");
    expect(record.release_date).toBe("2026-03-05");
    expect(record.description).toContain("latest GPT-5 generation");
  });

  it("keeps proprietary OpenAI models marked as closed-weight", () => {
    const record = __testables.buildModelRecord({
      id: "openai/gpt-4.1",
      name: "OpenAI: GPT-4.1",
      description: "Frontier proprietary model",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.is_open_weights).toBe(false);
    expect(record.license).toBe("commercial");
    expect(record.license_name).toBeNull();
  });

  it("allows explicit gpt-oss exceptions to stay open-weight", () => {
    const record = __testables.buildModelRecord({
      id: "openai/gpt-oss-20b",
      name: "OpenAI: gpt-oss-20b",
      description:
        "gpt-oss-20b is an open-weight 21B parameter model released by OpenAI under the Apache 2.0 license.",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.is_open_weights).toBe(true);
    expect(record.license).toBe("open_source");
    expect(record.license_name).toBe("Apache 2.0");
  });

  it("recognizes Cohere Command A as open-weight", () => {
    const record = __testables.buildModelRecord({
      id: "cohere/command-a",
      name: "Cohere: Command A",
      description: "Command A is an open-weights 111B parameter model with a 256k context window.",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.is_open_weights).toBe(true);
    expect(record.license).toBe("open_source");
    expect(record.license_name).toBe("Open weights");
  });

  it("recognizes Cohere Command R+ as open-weight with its non-commercial license", () => {
    const record = __testables.buildModelRecord({
      id: "cohere/command-r-plus",
      name: "Cohere: Command R+",
      description: "Enterprise-grade model optimized for RAG, tool use, and multilingual tasks.",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.is_open_weights).toBe(true);
    expect(record.license).toBe("open_source");
    expect(record.license_name).toBe("CC-BY-NC-4.0");
  });

  it("keeps proprietary Google models marked as closed-weight", () => {
    const record = __testables.buildModelRecord({
      id: "google/gemini-2.5-pro",
      name: "Google: Gemini 2.5 Pro",
      description: "Google's frontier proprietary multimodal model.",
      architecture: {
        input_modalities: ["text", "image"],
        output_modalities: ["text"],
      },
    });

    expect(record.is_open_weights).toBe(false);
    expect(record.license).toBe("commercial");
    expect(record.license_name).toBeNull();
  });

  it("uses Anthropic provider defaults and curated metadata for Claude 4.8", () => {
    const record = __testables.buildModelRecord({
      id: "anthropic/claude-opus-4-8",
      name: "Anthropic: claude-opus-4.8",
      description: "Generic router description for Claude 4.8",
      architecture: {},
    });

    expect(record.name).toBe("Claude Opus 4.8");
    expect(record.category).toBe("multimodal");
    expect(record.modalities).toEqual(["text", "image"]);
    expect(record.release_date).toBe("2026-05-28");
    expect(record.description).toContain("Builds on Opus 4.7");
    expect(record.website_url).toBe("https://www.anthropic.com/news/claude-opus-4-8");
  });

  it("keeps restored Claude Fable models proprietary and non-local", () => {
    const fable5 = __testables.buildModelRecord({
      id: "anthropic/claude-fable-5",
      name: "Anthropic: Claude Fable 5",
      description:
        "Misleading upstream text saying open weights and local machine support.",
      pricing: {
        prompt: "0.00001",
        completion: "0.00005",
      },
      architecture: {
        input_modalities: ["text", "image"],
        output_modalities: ["text"],
      },
    });
    const latestAlias = __testables.buildModelRecord({
      id: "anthropic/claude-fable-latest",
      name: "Anthropic: Claude Fable Latest",
      description: "Router alias for Fable.",
      architecture: {},
    });

    expect(fable5).toMatchObject({
      slug: "anthropic-claude-fable-5",
      name: "Claude Fable 5",
      category: "multimodal",
      status: "active",
      is_api_available: true,
      is_open_weights: false,
      license: "commercial",
      license_name: null,
      release_date: "2026-06-09",
      capabilities: expect.objectContaining({
        safety_routing: true,
        data_retention_required: true,
      }),
    });
    expect(latestAlias).toMatchObject({
      slug: "anthropic-claude-fable-5",
      name: "Claude Fable 5",
      status: "active",
      is_api_available: true,
      is_open_weights: false,
    });
  });

  it("keeps GPT-5.6 pro reasoning modes distinct from base model names", () => {
    const record = __testables.buildModelRecord({
      id: "openai/gpt-5.6-sol-pro",
      name: "OpenAI: GPT-5.6 Sol Pro",
      description:
        "The same underlying GPT-5.6 Sol model served with reasoning.mode set to pro.",
      context_length: 1050000,
      architecture: {
        input_modalities: ["text", "image"],
        output_modalities: ["text"],
      },
    });

    expect(record).toMatchObject({
      slug: "openai-gpt-5-6-sol-pro",
      name: "GPT-5.6 Sol Pro",
      status: "preview",
      is_api_available: true,
      is_open_weights: false,
      license: "commercial",
    });
    expect(record.description).toContain("reasoning.mode set to pro");
  });

  it("canonicalizes Z.ai router prefixes", () => {
    const record = __testables.buildModelRecord({
      id: "z-ai/glm-5",
      name: "Z.ai: GLM-5",
      description: "Frontier reasoning model",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.provider).toBe("Z.ai");
  });

  it("uses curated Z.ai metadata for newer GLM families", () => {
    const record = __testables.buildModelRecord({
      id: "z-ai/glm-5.1",
      name: "Z.ai: GLM-5.1",
      description: "Updated GLM reasoning model",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.name).toBe("GLM-5.1");
    expect(record.context_window).toBe(202752);
    expect(record.release_date).toBe("2026-04-03");
  });

  it("falls back to top_provider context length when model context is missing", () => {
    const record = __testables.buildModelRecord({
      id: "nvidia/nemotron-terminal-32b",
      name: "NVIDIA: Nemotron-Terminal-32B",
      description: "Agent model with long-context support",
      context_length: undefined,
      top_provider: {
        context_length: 262144,
      },
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.context_window).toBe(262144);
  });

  it("treats xai-prefixed router models as proprietary", () => {
    const record = __testables.buildModelRecord({
      id: "xai/grok-4",
      name: "xAI: Grok 4",
      description: "xAI's flagship reasoning model.",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.provider).toBe("xAI");
    expect(record.is_open_weights).toBe(false);
    expect(record.license).toBe("commercial");
    expect(record.license_name).toBeNull();
    expect(record.category).toBe("llm");
    expect(record.modalities).toEqual(["text", "image"]);
  });

  it("uses curated Google family metadata for Gemma 3n variants", () => {
    const record = __testables.buildModelRecord({
      id: "google/gemma-3n-e4b-it",
      name: "Google: Gemma 3n E4B IT",
      description: "Multimodal on-device Gemma family model.",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.category).toBe("multimodal");
    expect(record.modalities).toEqual(["text", "image", "audio"]);
    expect(record.is_open_weights).toBe(true);
    expect(record.license_name).toBe("Apache 2.0");
  });

  it("uses curated xAI media metadata for Grok Imagine image models", () => {
    const record = __testables.buildModelRecord({
      id: "xai/grok-imagine-image",
      name: "xAI: Grok Imagine Image",
      description: "SOTA image model from xAI",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["image"],
      },
    });

    expect(record.category).toBe("image_generation");
    expect(record.modalities).toEqual(["text", "image"]);
    expect(record.is_open_weights).toBe(false);
  });

  it("uses curated xAI media metadata for Grok Imagine video models", () => {
    const record = __testables.buildModelRecord({
      id: "xai/grok-imagine-video",
      name: "xAI: Grok Imagine Video",
      description: "Generate videos using xAI's Grok Imagine Video model",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["video"],
      },
    });

    expect(record.category).toBe("video");
    expect(record.modalities).toEqual(["text", "image", "video", "audio"]);
    expect(record.is_open_weights).toBe(false);
  });

  it("uses curated MiniMax family metadata for highspeed text variants", () => {
    const record = __testables.buildModelRecord({
      id: "minimax/MiniMax-M2.1-highspeed",
      name: "MiniMax: MiniMax-M2.1-highspeed",
      description: "High-speed production variant of MiniMax M2.1.",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.category).toBe("llm");
    expect(record.modalities).toEqual(["text"]);
    expect(record.is_open_weights).toBe(false);
    expect(record.license).toBe("commercial");
  });

  it("uses curated Moonshot metadata for Kimi models", () => {
    const record = __testables.buildModelRecord({
      id: "moonshotai/kimi-k2-thinking",
      name: "Moonshot AI: Kimi K2 Thinking",
      description: "Reasoning model from Moonshot AI.",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.provider).toBe("Moonshot AI");
    expect(record.name).toBe("Kimi K2 Thinking");
    expect(record.category).toBe("llm");
    expect(record.context_window).toBe(256000);
    expect(record.release_date).toBe("2025-11-06");
    expect(record.is_open_weights).toBe(false);
  });
});
