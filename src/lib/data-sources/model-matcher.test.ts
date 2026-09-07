import { describe, expect, it } from "vitest";

import {
  generateAliases,
  limitProviderScopedModelIds,
  matchModelsInText,
  type ModelLookupEntry,
} from "./model-matcher";

function entry(id: string, name: string): ModelLookupEntry {
  return { id, name, slug: id, provider: "OpenAI", aliases: generateAliases(name) };
}

describe("matchModelsInText", () => {
  const canonical = entry("astra", "GPT-6 Astra");
  const batch = entry("astra-batch", "GPT-6 Astra (batch)");

  it.each([[batch, canonical], [canonical, batch]])(
    "links an unqualified announcement to the canonical model regardless of lookup order",
    (...lookup) => {
      expect(matchModelsInText("Introducing GPT-6 Astra today", lookup)).toEqual(["astra"]);
    }
  );

  it("preserves an explicitly named pricing variant", () => {
    expect(matchModelsInText("GPT-6 Astra (batch) pricing", [canonical, batch]))
      .toEqual(["astra-batch"]);
  });

  it("resolves separate canonical and qualified mentions independently", () => {
    expect(matchModelsInText("GPT-6 Astra (batch) costs less than GPT-6 Astra", [batch, canonical]).sort())
      .toEqual(["astra", "astra-batch"]);
  });

  it("prefers complete normalized names over shortened qualifier aliases", () => {
    expect(matchModelsInText("Introducing gpt-6-astra", [batch, canonical]))
      .toEqual(["astra"]);
  });

  it("matches the actual longest alias, not the entry with the longest name", () => {
    const lookup = [entry("old-mode", "Claude Fable 5 (extended thinking)"),
      entry("fable51", "Claude Fable 5.1"), entry("fable5", "Claude Fable 5")];
    expect(matchModelsInText("Claude Fable 5.1 is now available", lookup)).toEqual(["fable51"]);
  });

  it("keeps word boundaries and distinct capability tiers", () => {
    const lookup = [entry("gpt4", "GPT-4"), canonical, entry("astra-pro", "GPT-6 Astra Pro")];
    expect(matchModelsInText("GPT-4o and GPT-6 Astra Pro", lookup)).toEqual(["astra-pro"]);
  });
});

describe("limitProviderScopedModelIds", () => {
  it("deduplicates direct model matches while keeping focused links", () => {
    expect(limitProviderScopedModelIds(["m1", "m2", "m2"])).toEqual(["m1", "m2"]);
  });

  it("drops overly broad provider-scoped matches", () => {
    expect(limitProviderScopedModelIds(["m1", "m2", "m3", "m4"])).toEqual([]);
  });
});
