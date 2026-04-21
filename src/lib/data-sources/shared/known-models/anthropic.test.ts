import { describe, expect, it } from "vitest";
import {
  canonicalizeAnthropicModelId,
  resolveAnthropicKnownModelMeta,
} from "./anthropic";

describe("resolveAnthropicKnownModelMeta", () => {
  it("resolves Claude Opus 4.7 canonical and generic aliases to the latest release metadata", () => {
    const canonical = resolveAnthropicKnownModelMeta("claude-opus-4-7");
    const genericAlias = resolveAnthropicKnownModelMeta("claude-4-7");
    const datedAlias = resolveAnthropicKnownModelMeta("claude-opus-4-7-20260416-v1");

    expect(canonical).toMatchObject({
      name: "Claude Opus 4.7",
      release_date: "2026-04-16",
      website_url: "https://www.anthropic.com/news/claude-opus-4-7",
      context_window: 200000,
    });
    expect(genericAlias?.release_date).toBe("2026-04-16");
    expect(datedAlias?.release_date).toBe("2026-04-16");
  });

  it("canonicalizes generic Anthropic aliases to the flagship model id", () => {
    expect(canonicalizeAnthropicModelId("claude-4-7")).toBe("claude-opus-4-7");
    expect(canonicalizeAnthropicModelId("claude-opus-4-7-20260416-v1")).toBe(
      "claude-opus-4-7"
    );
  });

  it("inherits metadata for v1 aliases", () => {
    const meta = resolveAnthropicKnownModelMeta("claude-opus-4-6-v1");
    expect(meta?.release_date).toBe("2025-12-12");
    expect(meta?.context_window).toBe(200000);
  });

  it("inherits metadata for dated 4.5 aliases", () => {
    const meta = resolveAnthropicKnownModelMeta("claude-sonnet-4-5-20250929");
    expect(meta?.release_date).toBe("2025-10-22");
    expect(meta?.context_window).toBe(200000);
  });

  it("inherits metadata for generic family aliases", () => {
    const meta = resolveAnthropicKnownModelMeta("claude-sonnet-4");
    expect(meta?.release_date).toBe("2025-05-22");
    expect(meta?.context_window).toBe(200000);
  });

  it("inherits metadata for Claude Opus 4.1 variants", () => {
    const meta = resolveAnthropicKnownModelMeta("claude-opus-4-1-20250805-v1");
    expect(meta?.release_date).toBe("2025-08-05");
    expect(meta?.context_window).toBe(200000);
  });

  it("marks older Opus-family releases as superseded by Claude Opus 4.7", () => {
    expect(resolveAnthropicKnownModelMeta("claude-4-opus")?.description).toMatch(
      /superseded by Claude Opus 4\.7/i
    );
    expect(resolveAnthropicKnownModelMeta("claude-4-5-opus")?.description).toMatch(
      /superseded by Claude Opus 4\.7/i
    );
    expect(resolveAnthropicKnownModelMeta("claude-opus-4-1")?.description).toMatch(
      /superseded by Claude Opus 4\.7/i
    );
  });
});
