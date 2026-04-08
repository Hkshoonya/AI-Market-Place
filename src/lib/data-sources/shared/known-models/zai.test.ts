import { describe, expect, it } from "vitest";

import { resolveZAIKnownModelMeta } from "./zai";

describe("resolveZAIKnownModelMeta", () => {
  it("returns exact metadata for newly tracked Z.ai families", () => {
    expect(resolveZAIKnownModelMeta("autoglm-phone-multilingual")).toMatchObject({
      name: "AutoGLM Phone Multilingual",
      category: "agentic_browser",
      release_date: "2025-12-11",
    });

    expect(resolveZAIKnownModelMeta("cogview-4")).toMatchObject({
      name: "CogView-4",
      category: "image_generation",
      is_open_weights: true,
      release_date: "2025-03-04",
    });

    expect(resolveZAIKnownModelMeta("glm-5v-turbo")).toMatchObject({
      name: "GLM-5V-Turbo",
      category: "multimodal",
      context_window: 202752,
      release_date: "2026-04-02",
    });
  });

  it("falls back from provider alias rows to canonical GLM family metadata", () => {
    expect(resolveZAIKnownModelMeta("zai-org-glm-5")).toMatchObject({
      name: "GLM-5",
      context_window: 128000,
      release_date: "2026-02-12",
    });

    expect(resolveZAIKnownModelMeta("zai-org-glm-5-1")).toMatchObject({
      name: "GLM-5.1",
      context_window: 202752,
      release_date: "2026-04-03",
    });
  });
});
