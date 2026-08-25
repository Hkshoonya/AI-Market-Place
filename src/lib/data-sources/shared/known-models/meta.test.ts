import { describe, expect, it } from "vitest";

import { META_KNOWN_MODELS } from "./meta";

describe("META_KNOWN_MODELS", () => {
  it("tracks current Muse agent models with first-party locators", () => {
    expect(META_KNOWN_MODELS["muse-spark-1-2"]).toMatchObject({
      name: "Muse Spark 1.2",
      release_date: "2026-08-05",
      context_window: 1048576,
      is_open_weights: false,
      website_url:
        "https://research.meta.ai/blog/introducing-muse-code-and-muse-spark-1-2",
    });

    expect(META_KNOWN_MODELS["muse-glimmer-30b"]).toMatchObject({
      name: "Muse Glimmer 30B",
      release_date: "2026-08-10",
      parameter_count: 30000000000,
      is_open_weights: true,
      license_name: "Apache 2.0",
      hf_model_id: "meta-models/Muse-Glimmer-30B",
    });
  });
});
