import { describe, expect, it } from "vitest";

import { limitProviderScopedModelIds } from "./model-matcher";

describe("limitProviderScopedModelIds", () => {
  it("deduplicates direct model matches while keeping focused links", () => {
    expect(limitProviderScopedModelIds(["m1", "m2", "m2"])).toEqual(["m1", "m2"]);
  });

  it("drops overly broad provider-scoped matches", () => {
    expect(limitProviderScopedModelIds(["m1", "m2", "m3", "m4"])).toEqual([]);
  });
});
