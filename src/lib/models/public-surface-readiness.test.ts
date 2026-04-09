import { describe, expect, it } from "vitest";

import {
  getDefaultPublicSurfaceReadinessBlockers,
  hasCompletePublicMetadata,
  isDefaultPublicSurfaceReady,
} from "./public-surface-readiness";

describe("public surface readiness", () => {
  it("accepts a complete official frontier model", () => {
    expect(
      isDefaultPublicSurfaceReady({
        slug: "google-gemma-4-31b-it",
        provider: "Google",
        name: "Gemma 4 31B IT",
        category: "multimodal",
        release_date: "2026-04-02",
        is_open_weights: true,
        license: "open_source",
        license_name: "Apache 2.0",
        context_window: 128000,
      })
    ).toBe(true);
  });

  it("rejects packaging variants for default public discovery", () => {
    expect(
      isDefaultPublicSurfaceReady({
        slug: "unsloth-qwen3-5-122b-a10b-gguf",
        provider: "Unsloth",
        name: "Qwen3.5 122B A10B GGUF",
        category: "llm",
        release_date: "2026-03-25",
        context_window: 131072,
        quality_score: 62,
      })
    ).toBe(false);
  });

  it("rejects incomplete open-weight rows", () => {
    expect(
      hasCompletePublicMetadata({
        slug: "open-row",
        provider: "Community",
        name: "Open Row",
        category: "llm",
        release_date: "2026-04-01",
        is_open_weights: true,
        license: null,
        license_name: null,
        context_window: 32768,
      })
    ).toBe(false);
  });

  it("rejects weak community rows without meaningful public signals", () => {
    expect(
      isDefaultPublicSurfaceReady({
        slug: "community-wrapper-row",
        provider: "Community Hub",
        name: "Community Wrapper Row",
        category: "llm",
        release_date: "2026-04-01",
        context_window: 32768,
      })
    ).toBe(false);
  });

  it("explains why a row is not discovery-ready", () => {
    expect(
      getDefaultPublicSurfaceReadinessBlockers({
        slug: "community-latest",
        provider: "Community Hub",
        name: "Community Latest",
        category: "llm",
        release_date: null,
        context_window: null,
      })
    ).toEqual([
      "missing_context_window",
      "wrapper_variant",
    ]);
  });
});
