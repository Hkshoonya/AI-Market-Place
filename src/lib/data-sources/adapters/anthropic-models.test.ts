import { describe, expect, it } from "vitest";
import { normalizeScrapedAnthropicModelId } from "./anthropic-models";

describe("normalizeScrapedAnthropicModelId", () => {
  it("canonicalizes real aliases and dated model identifiers", () => {
    expect(normalizeScrapedAnthropicModelId("claude-opus-latest")).toBe(
      "claude-opus-5"
    );
    expect(
      normalizeScrapedAnthropicModelId("claude-sonnet-5-20260630")
    ).toBe("claude-sonnet-5");
    expect(
      normalizeScrapedAnthropicModelId("claude-3-5-sonnet-20241022")
    ).toBe("claude-3-5-sonnet-v2");
  });

  it("rejects documentation and migration slugs", () => {
    expect(
      normalizeScrapedAnthropicModelId("claude-opus-5-system-card")
    ).toBeNull();
    expect(
      normalizeScrapedAnthropicModelId("claude-sonnet-5-introductory-pricing")
    ).toBeNull();
    expect(
      normalizeScrapedAnthropicModelId("claude-opus-4-8-to-claude-opus-5")
    ).toBeNull();
    expect(normalizeScrapedAnthropicModelId("claude-sonnet-latest")).toBeNull();
  });

  it("retains plausible future provider IDs without inventing metadata", () => {
    expect(normalizeScrapedAnthropicModelId("claude-haiku-5-1-20261012")).toBe(
      "claude-haiku-5-1-20261012"
    );
  });
});
