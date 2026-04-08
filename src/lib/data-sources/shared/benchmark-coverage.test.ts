import { describe, expect, it } from "vitest";

import {
  getTrustedBenchmarkHfUrl,
  isBenchmarkExpectedModel,
} from "./benchmark-coverage";

describe("benchmark coverage helpers", () => {
  it("marks llm and multimodal models as benchmark-expected", () => {
    expect(
      isBenchmarkExpectedModel({
        slug: "google-gemma-4-31b-it",
        provider: "Google",
        category: "multimodal",
      })
    ).toBe(true);

    expect(
      isBenchmarkExpectedModel({
        slug: "openai-gpt-5-4",
        provider: "OpenAI",
        category: "llm",
      })
    ).toBe(true);
  });

  it("keeps image-only rows out of benchmark-expected coverage", () => {
    expect(
      isBenchmarkExpectedModel({
        slug: "google-imagen-4-fast",
        provider: "Google",
        category: "image_generation",
      })
    ).toBe(false);
  });

  it("derives trusted HF benchmark URLs only for approved provider orgs", () => {
    expect(
      getTrustedBenchmarkHfUrl({
        slug: "google-gemma-4-31b-it",
        provider: "Google",
        category: "multimodal",
        hf_model_id: "google/gemma-4-31B-it",
      })
    ).toBe("https://huggingface.co/google/gemma-4-31B-it");

    expect(
      getTrustedBenchmarkHfUrl({
        slug: "nvidia-qwen3-5-397b-a17b-nvfp4",
        provider: "NVIDIA",
        category: "llm",
        hf_model_id: "other-org/Qwen3.5-397B-A17B-NVFP4",
      })
    ).toBeNull();
  });
});
