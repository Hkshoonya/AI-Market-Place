import { describe, expect, it } from "vitest";
import { resolveOpenAIKnownModelMeta } from "./openai";

describe("resolveOpenAIKnownModelMeta", () => {
  it("inherits metadata for dated GPT-4.1 variants", () => {
    const meta = resolveOpenAIKnownModelMeta("gpt-4-1-mini-2025-04-14");
    expect(meta?.release_date).toBe("2025-04-14");
    expect(meta?.context_window).toBe(1048576);
  });

  it("inherits metadata for latest chat aliases", () => {
    const meta = resolveOpenAIKnownModelMeta("gpt-5-2-chat-latest");
    expect(meta?.release_date).toBe("2025-12-01");
    expect(meta?.context_window).toBe(256000);
  });

  it("inherits metadata for audio variants", () => {
    const meta = resolveOpenAIKnownModelMeta("gpt-4o-mini-transcribe-2025-03-20");
    expect(meta?.category).toBe("speech_audio");
    expect(meta?.release_date).toBe("2025-03-20");
    expect(meta?.context_window).toBe(128000);
  });

  it("inherits metadata for legacy completion models", () => {
    const meta = resolveOpenAIKnownModelMeta("babbage-002");
    expect(meta?.release_date).toBe("2023-11-06");
    expect(meta?.context_window).toBe(16384);
  });

  it("inherits metadata for GPT-5 mini dated variants", () => {
    const meta = resolveOpenAIKnownModelMeta("gpt-5-mini-2025-08-07");
    expect(meta?.release_date).toBe("2025-08-07");
    expect(meta?.context_window).toBe(128000);
  });

  it("inherits metadata for realtime and image aliases", () => {
    expect(resolveOpenAIKnownModelMeta("gpt-realtime-1-5")?.context_window).toBe(
      128000
    );
    expect(resolveOpenAIKnownModelMeta("gpt-image")?.release_date).toBe(
      "2025-12-16"
    );
  });
});
