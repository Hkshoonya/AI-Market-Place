import { describe, expect, it } from "vitest";

import { buildModelAliasIndex, resolveAliasFamilyModelIds } from "./model-alias-resolver";

describe("model alias resolver", () => {
  it("returns sibling aliases and dated variants for the same benchmark family", () => {
    const index = buildModelAliasIndex([
      {
        id: "base",
        slug: "deepseek-r1",
        name: "DeepSeek R1",
        provider: "DeepSeek",
      },
      {
        id: "provider-alias",
        slug: "deepseek-ai-deepseek-r1",
        name: "DeepSeek R1",
        provider: "DeepSeek AI",
      },
      {
        id: "dated",
        slug: "deepseek-r1-2025-01-20",
        name: "DeepSeek R1 2025-01-20",
        provider: "DeepSeek",
      },
    ]);

    const modelIds = resolveAliasFamilyModelIds(index, {
      slugCandidates: ["deepseek-r1"],
      nameCandidates: ["deepseek r1", "deepseek-r1"],
    });

    expect(modelIds).toEqual(["base", "provider-alias", "dated"]);
  });
});
