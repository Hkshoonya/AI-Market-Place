import { describe, expect, it } from "vitest";

import {
  getPublicSourceTrustTier,
  isLowTrustPublicSourceTier,
} from "./public-source-trust";

describe("public source trust", () => {
  it("marks canonical provider families as official", () => {
    expect(
      getPublicSourceTrustTier({
        provider: "zai-org",
        slug: "zai-org-glm-5-1",
      })
    ).toBe("official");
  });

  it("marks packaging and wrapper slugs as wrapper trust", () => {
    expect(
      getPublicSourceTrustTier({
        provider: "Community",
        slug: "unsloth-qwen3-5-122b-a10b-gguf",
      })
    ).toBe("wrapper");

    expect(
      getPublicSourceTrustTier({
        provider: "Community",
        slug: "google-gemini-flash-latest",
      })
    ).toBe("wrapper");
  });

  it("marks non-official rows with trusted locators as trusted catalog", () => {
    expect(
      getPublicSourceTrustTier({
        provider: "Community Hub",
        slug: "community-hub-model",
        hf_model_id: "community/model",
      })
    ).toBe("trusted_catalog");
  });

  it("marks rows without trust signals as community", () => {
    const tier = getPublicSourceTrustTier({
      provider: "Community Hub",
      slug: "community-wrapper-row",
    });

    expect(tier).toBe("community");
    expect(isLowTrustPublicSourceTier(tier)).toBe(true);
  });
});
