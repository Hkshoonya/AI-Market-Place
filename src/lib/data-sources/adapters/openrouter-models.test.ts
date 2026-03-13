import { describe, expect, it } from "vitest";

import { __testables } from "./openrouter-models";

describe("openrouter model record mapping", () => {
  it("maps open-weight models to enum-safe license fields", () => {
    const record = __testables.buildModelRecord({
      id: "meta-llama/llama-4-maverick",
      name: "Meta: Llama 4 Maverick",
      description: "Open weight model with Apache style release",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    });

    expect(record.license).toBe("open_source");
    expect(record.license_name).toBe("Open weights");
    expect(record.is_open_weights).toBe(true);
  });
});
