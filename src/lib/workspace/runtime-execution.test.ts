import { describe, expect, it } from "vitest";

import { resolveWorkspaceRuntimeExecution } from "./runtime-execution";

describe("resolveWorkspaceRuntimeExecution", () => {
  it("maps supported OpenAI models to OpenRouter runtime routes", () => {
    expect(resolveWorkspaceRuntimeExecution("openai-gpt-4-1")).toEqual(
      expect.objectContaining({
        available: true,
        provider: "openrouter",
        model: "openai/gpt-4.1",
      })
    );
  });

  it("maps supported Anthropic models to OpenRouter runtime routes", () => {
    expect(resolveWorkspaceRuntimeExecution("anthropic-claude-opus-4-6")).toEqual(
      expect.objectContaining({
        available: true,
        provider: "openrouter",
        model: "anthropic/claude-opus-4-6",
      })
    );
  });

  it("maps supported MiniMax models to direct MiniMax runtime routes", () => {
    expect(resolveWorkspaceRuntimeExecution("minimax-minimax-m2-7")).toEqual(
      expect.objectContaining({
        available: true,
        provider: "minimax",
        model: "MiniMax-M2.7",
      })
    );
  });

  it("falls back to assistant-only when the runtime route is not deterministic", () => {
    expect(resolveWorkspaceRuntimeExecution("unknown-provider-custom-model")).toEqual(
      expect.objectContaining({
        available: false,
        mode: "assistant_only",
        provider: null,
        model: null,
      })
    );
  });
});
