import { describe, expect, it } from "vitest";
import { resolveAnthropicKnownModelMeta } from "./anthropic";

describe("resolveAnthropicKnownModelMeta", () => {
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
});
