import { describe, expect, it } from "vitest";

import { resolveZAIKnownModelMeta } from "./zai";

describe("resolveZAIKnownModelMeta", () => {
  it("keeps GLM-5.3 distinct from the older GLM-5 release", () => {
    expect(resolveZAIKnownModelMeta("glm-5-3")).toMatchObject({
      name: "GLM-5.3",
      release_date: "2026-08-14",
      parameter_count: 744_000_000_000,
      context_window: 1_000_000,
      is_open_weights: false,
      website_url: "https://z.ai/blog/glm-5.3",
    });
  });

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
