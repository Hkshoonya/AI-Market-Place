import { describe, expect, it } from "vitest";

import { lookupProviderPrice } from "./provider-pricing";

describe("lookupProviderPrice", () => {
  it("matches current provider-prefixed slugs for newly covered providers", () => {
    expect(lookupProviderPrice("minimaxai-minimax-m2-5")).toMatchObject({
      provider: "MiniMax",
      inputPricePerMillion: 0.3,
      outputPricePerMillion: 1.2,
    });

    expect(lookupProviderPrice("ai21-jamba-1-5-large")).toMatchObject({
      provider: "AI21",
      inputPricePerMillion: 2,
      outputPricePerMillion: 8,
    });

    expect(lookupProviderPrice("cohere-command-r-plus")).toMatchObject({
      provider: "Cohere",
      inputPricePerMillion: 2.5,
      outputPricePerMillion: 10,
    });
  });

  it("matches current xAI grok family slugs", () => {
    expect(lookupProviderPrice("xai-grok-4")).toMatchObject({
      provider: "xAI",
      inputPricePerMillion: 3,
      outputPricePerMillion: 15,
    });

    expect(lookupProviderPrice("xai-grok-2-1212")).toMatchObject({
      provider: "xAI",
      inputPricePerMillion: 2,
      outputPricePerMillion: 10,
    });
  });

  it("matches legacy and specialized OpenAI slugs from live catalog rows", () => {
    expect(lookupProviderPrice("openai-gpt-4-0613")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 30,
      outputPricePerMillion: 60,
    });

    expect(lookupProviderPrice("openai-gpt-3-5-turbo-instruct-0914")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 1.5,
      outputPricePerMillion: 2,
    });

    expect(lookupProviderPrice("openai-gpt-realtime-mini-2025-10-06")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 0.6,
      outputPricePerMillion: 2.4,
    });

    expect(lookupProviderPrice("openai-gpt-realtime-1-5")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 4,
      outputPricePerMillion: 16,
    });

    expect(lookupProviderPrice("openai-chatgpt-image-latest")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 5,
      outputPricePerMillion: 10,
    });

    expect(lookupProviderPrice("openai-text-embedding-3-small")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 0.02,
      outputPricePerMillion: 0,
    });

    expect(lookupProviderPrice("openai-omni-moderation-latest")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
    });

    expect(lookupProviderPrice("openai-codex-mini-latest")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 1.5,
      outputPricePerMillion: 6,
    });
  });

  it("matches TTS and image variants through the shared OpenAI keys", () => {
    expect(lookupProviderPrice("openai-tts-1-hd-1106")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 30,
      outputPricePerMillion: 0,
    });

    expect(lookupProviderPrice("openai-gpt-image-1-mini")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 2,
      outputPricePerMillion: 8,
    });

    expect(lookupProviderPrice("openai-gpt-image-1-5")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 5,
      outputPricePerMillion: 10,
    });

    expect(lookupProviderPrice("openai-dall-e-3")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: null,
      outputPricePerMillion: null,
      pricePerCall: 0.04,
    });
  });

  it("matches the remaining curated official pricing gaps across provider styles", () => {
    expect(lookupProviderPrice("amazon-nova-pro-v1")).toMatchObject({
      provider: "Amazon",
      inputPricePerMillion: 0.8,
      outputPricePerMillion: 3.2,
    });

    expect(lookupProviderPrice("google-gemini-3-1-flash-lite")).toMatchObject({
      provider: "Google",
      inputPricePerMillion: 0.25,
      outputPricePerMillion: 1.5,
    });

    expect(lookupProviderPrice("black-forest-labs-flux-1-pro")).toMatchObject({
      provider: "Black Forest Labs",
      inputPricePerMillion: null,
      outputPricePerMillion: null,
      pricePerCall: 0.05,
    });
  });
});
