import { describe, expect, it } from "vitest";

import { filterProviderSignals, pickBestProviderSignals } from "./provider-signals";

describe("pickBestProviderSignals", () => {
  it("selects the strongest recent signal for each provider", () => {
    const signals = [
      {
        id: "openai-benchmark",
        title: "OpenAI benchmark surge",
        source: "artificial-analysis",
        related_provider: "OpenAI",
        published_at: "2026-03-16T09:00:00.000Z",
        metadata: { signal_type: "benchmark", signal_importance: "high" },
      },
      {
        id: "openai-launch",
        title: "OpenAI launches new reasoning tier",
        source: "provider-blog",
        related_provider: "openai",
        published_at: "2026-03-16T10:00:00.000Z",
        metadata: { signal_type: "launch", signal_importance: "high" },
      },
      {
        id: "anthropic-pricing",
        title: "Anthropic pricing refresh",
        source: "provider-blog",
        related_provider: "Anthropic",
        published_at: "2026-03-15T10:00:00.000Z",
        metadata: { signal_type: "pricing", signal_importance: "high" },
      },
    ];

    const picked = pickBestProviderSignals(["OpenAI", "Anthropic"], signals);

    expect(picked.get("OpenAI")).toEqual(
      expect.objectContaining({
        title: "OpenAI launches new reasoning tier",
        signalType: "launch",
      })
    );
    expect(picked.get("Anthropic")).toEqual(
      expect.objectContaining({
        title: "Anthropic pricing refresh",
        signalType: "pricing",
      })
    );
  });

  it("ignores general or unrelated items", () => {
    const signals = [
      {
        id: "paper",
        title: "General research roundup",
        source: "arxiv",
        related_provider: "Google",
        published_at: "2026-03-15T10:00:00.000Z",
        metadata: { signal_type: "general", signal_importance: "low" },
      },
    ];

    const picked = pickBestProviderSignals(["OpenAI"], signals);
    expect(picked.has("OpenAI")).toBe(false);
  });
});

describe("filterProviderSignals", () => {
  it("matches provider aliases canonically", () => {
    const filtered = filterProviderSignals("OpenAI", [
      { id: "1", title: "a", related_provider: "openai" },
      { id: "2", title: "b", related_provider: "Anthropic" },
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("1");
  });
});
