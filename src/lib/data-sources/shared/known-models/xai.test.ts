import { describe, expect, it } from "vitest";

import { XAI_KNOWN_MODELS } from "./xai";

describe("XAI_KNOWN_MODELS", () => {
  it("tracks current Grok releases with official metadata and closed licenses", () => {
    expect(XAI_KNOWN_MODELS["grok-4-5"]).toMatchObject({
      name: "Grok 4.5",
      category: "multimodal",
      release_date: "2026-07-08",
      context_window: 500000,
      is_open_weights: false,
      website_url: "https://x.ai/news/grok-4-5",
    });
    expect(XAI_KNOWN_MODELS["grok-build-0-1"]).toMatchObject({
      name: "Grok Build 0.1",
      category: "code",
      release_date: "2026-05-19",
      context_window: 256000,
      is_open_weights: false,
      website_url: "https://docs.x.ai/developers/models/grok-build-0.1",
    });
  });

  it("marks Grok 3 family rows as previous-generation after the Grok 4 launch", () => {
    expect(XAI_KNOWN_MODELS["grok-3"]?.description).toMatch(
      /superseded by newer Grok 4 releases/i
    );
    expect(XAI_KNOWN_MODELS["grok-3-mini"]?.description).toMatch(
      /superseded by newer Grok 4 releases/i
    );
  });
});
