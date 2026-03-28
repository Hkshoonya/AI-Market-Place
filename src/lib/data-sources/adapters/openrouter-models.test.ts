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
});
