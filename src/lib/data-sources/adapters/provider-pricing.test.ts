import { describe, expect, it } from "vitest";

import {
  lookupProviderPrice,
  preferNewerOfficialProviderPrice,
} from "./provider-pricing";

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

  it("uses the refreshed official OpenAI pricing source for current flagship models", () => {
    expect(lookupProviderPrice("openai-gpt-5-6-sol")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 5,
      outputPricePerMillion: 30,
      cachedInputPricePerMillion: 0.5,
      source: "https://developers.openai.com/api/docs/models/gpt-5.6-sol",
    });
    expect(lookupProviderPrice("openai-gpt-5-6")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 5,
      outputPricePerMillion: 30,
    });
    expect(lookupProviderPrice("openai-gpt-5-6-terra")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 2,
      outputPricePerMillion: 12,
      cachedInputPricePerMillion: 0.2,
    });
    expect(lookupProviderPrice("openai-gpt-5-6-luna")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 0.2,
      outputPricePerMillion: 1.2,
      cachedInputPricePerMillion: 0.02,
    });

    expect(lookupProviderPrice("openai-gpt-5-5")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 5,
      outputPricePerMillion: 30,
      source: "platform.openai.com/docs/pricing",
    });

    expect(lookupProviderPrice("openai-gpt-5-5-pro")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 30,
      outputPricePerMillion: 180,
      source: "platform.openai.com/docs/pricing",
    });

    expect(lookupProviderPrice("openai-gpt-4-1")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 2,
      outputPricePerMillion: 8,
      source: "platform.openai.com/docs/pricing",
    });

    expect(lookupProviderPrice("openai-o3")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 2,
      outputPricePerMillion: 8,
      source: "platform.openai.com/docs/pricing",
    });

    expect(lookupProviderPrice("openai-o4-mini")).toMatchObject({
      provider: "OpenAI",
      inputPricePerMillion: 1.1,
      outputPricePerMillion: 4.4,
      source: "platform.openai.com/docs/pricing",
    });
  });

  it("does not attach direct-provider prices to derivatives or unknown modes", () => {
    expect(
      lookupProviderPrice(
        "empero-ai-qwable-9b-claude-fable-5",
        "empero-ai"
      )
    ).toBeNull();
    expect(
      lookupProviderPrice("sao10k-l3-1-euryale-70b", "Sao10k")
    ).toBeNull();
    expect(
      lookupProviderPrice("openai-gpt-5-6-sol-pro", "OpenAI")
    ).toBeNull();
    expect(
      lookupProviderPrice("anthropic-claude-fable-5", "Anthropic")
    ).toMatchObject({ provider: "Anthropic" });
  });

  it("uses current first-party prices for Claude 5 production models", () => {
    expect(
      lookupProviderPrice("anthropic-claude-opus-5", "Anthropic")
    ).toMatchObject({
      inputPricePerMillion: 5,
      outputPricePerMillion: 25,
    });
    expect(
      lookupProviderPrice("anthropic-claude-sonnet-5", "Anthropic")
    ).toMatchObject({
      inputPricePerMillion: 2,
      outputPricePerMillion: 10,
    });
  });

  it("prefers a newer observed price only from the matching official origin", () => {
    const fallback = lookupProviderPrice(
      "openai-gpt-5-6-luna",
      "OpenAI"
    )!;
    const observed = {
      provider_name: "OpenAI",
      input_price_per_million: 0.15,
      output_price_per_million: 0.9,
      cached_input_price_per_million: 0.015,
      effective_date: "2026-08-01",
      source:
        "https://developers.openai.com/api/docs/models/gpt-5.6-luna",
    };

    expect(
      preferNewerOfficialProviderPrice(fallback, observed, "OpenAI")
    ).toMatchObject({
      inputPricePerMillion: 0.15,
      outputPricePerMillion: 0.9,
      cachedInputPricePerMillion: 0.015,
      lastUpdated: "2026-08-01",
    });
    expect(
      preferNewerOfficialProviderPrice(
        fallback,
        {
          ...observed,
          source:
            "https://developers.openai.com.attacker.example/api/docs/models/gpt-5.6-luna",
        },
        "OpenAI"
      )
    ).toBe(fallback);
    expect(
      preferNewerOfficialProviderPrice(
        fallback,
        { ...observed, effective_date: "2026-07-01" },
        "OpenAI"
      )
    ).toBe(fallback);
    expect(
      preferNewerOfficialProviderPrice(
        fallback,
        { ...observed, provider_name: "OpenRouter" },
        "OpenAI"
      )
    ).toBe(fallback);
  });
});
