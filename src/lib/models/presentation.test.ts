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
});
