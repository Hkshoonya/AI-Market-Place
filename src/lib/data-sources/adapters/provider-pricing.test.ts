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
  });
});
