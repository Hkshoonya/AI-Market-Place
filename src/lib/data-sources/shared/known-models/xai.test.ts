import { describe, expect, it } from "vitest";

import { XAI_KNOWN_MODELS } from "./xai";

describe("XAI_KNOWN_MODELS", () => {
  it("marks Grok 3 family rows as previous-generation after the Grok 4 launch", () => {
    expect(XAI_KNOWN_MODELS["grok-3"]?.description).toMatch(
      /superseded by newer Grok 4 releases/i
    );
    expect(XAI_KNOWN_MODELS["grok-3-mini"]?.description).toMatch(
      /superseded by newer Grok 4 releases/i
    );
  });
});
