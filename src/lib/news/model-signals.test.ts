import { describe, expect, it } from "vitest";

import { pickBestModelSignals } from "./model-signals";

describe("pickBestModelSignals", () => {
  it("prefers direct model-linked signals over provider-only signals", () => {
    const models = [{ id: "model-1", provider: "OpenAI" }];
    const signals = [
      {
        id: "provider-launch",
        title: "OpenAI launch event",
        source: "x-twitter",
        related_provider: "OpenAI",
        related_model_ids: null,
        published_at: "2026-03-16T10:00:00.000Z",
        metadata: { signal_type: "launch", signal_importance: "high" },
      },
      {
        id: "direct-pricing",
        title: "GPT-5 pricing update",
        source: "provider-blog",
        related_provider: "OpenAI",
        related_model_ids: ["model-1"],
        published_at: "2026-03-16T09:00:00.000Z",
        metadata: { signal_type: "pricing", signal_importance: "high" },
      },
    ];

    const picked = pickBestModelSignals(models, signals);
    expect(picked.get("model-1")).toEqual(
      expect.objectContaining({
        title: "GPT-5 pricing update",
        signalType: "pricing",
        signalLabel: "Pricing",
      })
    );
  });

  it("ignores generic signals with no direct or provider match", () => {
    const models = [{ id: "model-1", provider: "OpenAI" }];
    const signals = [
      {
        id: "paper-1",
        title: "New multimodal paper",
        source: "arxiv",
        related_provider: "Anthropic",
        related_model_ids: ["other-model"],
        published_at: "2026-03-16T09:00:00.000Z",
        metadata: { signal_type: "research", signal_importance: "low" },
      },
    ];

    const picked = pickBestModelSignals(models, signals);
    expect(picked.has("model-1")).toBe(false);
  });

  it("prefers an official provider signal over an X-only provider mention", () => {
    const models = [{ id: "model-1", provider: "OpenAI" }];
    const signals = [
      {
        id: "x-post",
        title: "OpenAI teases an update",
        source: "x-twitter",
        related_provider: "OpenAI",
        related_model_ids: null,
        published_at: "2026-03-16T10:00:00.000Z",
        metadata: { signal_type: "launch", signal_importance: "high" },
      },
      {
        id: "blog-post",
        title: "OpenAI publishes the update notes",
        source: "provider-blog",
        related_provider: "OpenAI",
        related_model_ids: null,
        published_at: "2026-03-16T09:30:00.000Z",
        metadata: { signal_type: "launch", signal_importance: "high" },
      },
    ];

    const picked = pickBestModelSignals(models, signals);
    expect(picked.get("model-1")).toEqual(
      expect.objectContaining({
        title: "OpenAI publishes the update notes",
        source: "provider-blog",
      })
    );
  });
});
