import { describe, expect, it } from "vitest";

import { resolveGoogleKnownModelMeta } from "./google";

describe("resolveGoogleKnownModelMeta", () => {
  it("returns exact Gemma 4 variant metadata when present", () => {
    const meta = resolveGoogleKnownModelMeta("gemma-4-31b-it");

    expect(meta).toMatchObject({
      name: "Gemma 4 31B IT",
      is_open_weights: true,
      license: "open_source",
      license_name: "Apache 2.0",
      release_date: "2026-04-02",
      category: "multimodal",
    });
  });

  it("falls back to the Gemma 4 family metadata for unknown Gemma 4 variants", () => {
    const meta = resolveGoogleKnownModelMeta("gemma-4-custom-preview");

    expect(meta).toMatchObject({
      name: "Gemma 4",
      is_open_weights: true,
      license: "open_source",
      license_name: "Apache 2.0",
      release_date: "2026-04-02",
      category: "multimodal",
    });
  });

  it("falls back to the Gemma 3n family metadata for Gemma 3n variants", () => {
    const meta = resolveGoogleKnownModelMeta("gemma-3n-e4b-it");

    expect(meta).toMatchObject({
      name: "Gemma 3n",
      is_open_weights: true,
      license: "open_source",
      license_name: "Apache 2.0",
      release_date: "2025-05-20",
      category: "multimodal",
      modalities: ["text", "image", "audio"],
    });
  });
});
