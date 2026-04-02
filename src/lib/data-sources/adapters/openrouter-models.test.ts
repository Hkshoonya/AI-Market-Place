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
    expect(record.license_name).toBe("Open weights");
    expect(record.is_open_weights).toBe(true);
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
  });
});
