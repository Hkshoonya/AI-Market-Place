import { describe, expect, it } from "vitest";

import { inferOpenWeightsFromHfModel } from "./huggingface";

describe("inferOpenWeightsFromHfModel", () => {
  it("recognizes known open families that were being misclassified as proprietary", () => {
    expect(inferOpenWeightsFromHfModel("google/gemma-3n-E4B-it-litert-lm")).toBe(true);
    expect(inferOpenWeightsFromHfModel("google/translategemma-4b-it")).toBe(true);
    expect(
      inferOpenWeightsFromHfModel("nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4")
    ).toBe(true);
    expect(inferOpenWeightsFromHfModel("LiquidAI/LFM2.5-VL-1.6B")).toBe(true);
    expect(
      inferOpenWeightsFromHfModel("unsloth/NVIDIA-Nemotron-3-Super-120B-A12B-GGUF")
    ).toBe(true);
  });

  it("treats explicit gguf/open_access signals as open weights", () => {
    expect(inferOpenWeightsFromHfModel("some-org/custom-model", ["gguf"])).toBe(true);
    expect(inferOpenWeightsFromHfModel("some-org/custom-model", ["open_access"])).toBe(true);
  });

  it("does not blindly mark unrelated closed models as open", () => {
    expect(inferOpenWeightsFromHfModel("01-ai/Yi-Lightning")).toBe(false);
    expect(inferOpenWeightsFromHfModel("openai/gpt-4o")).toBe(false);
  });
});
