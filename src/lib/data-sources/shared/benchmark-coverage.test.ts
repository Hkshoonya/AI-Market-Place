import { describe, expect, it } from "vitest";

import {
  getTrustedBenchmarkHfUrl,
  getTrustedBenchmarkWebsiteUrl,
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

  it("accepts official open-weight provider HF orgs for benchmark evidence", () => {
    expect(
      getTrustedBenchmarkHfUrl({
        slug: "meta-llama-4-maverick",
        provider: "Meta",
        category: "llm",
        hf_model_id: "meta-llama/Llama-4-Maverick",
      })
    ).toBe("https://huggingface.co/meta-llama/Llama-4-Maverick");

    expect(
      getTrustedBenchmarkHfUrl({
        slug: "deepseek-r1",
        provider: "DeepSeek",
        category: "llm",
        hf_model_id: "deepseek-ai/DeepSeek-R1",
      })
    ).toBe("https://huggingface.co/deepseek-ai/DeepSeek-R1");

    expect(
      getTrustedBenchmarkHfUrl({
        slug: "qwen3-235b",
        provider: "Qwen",
        category: "llm",
        hf_model_id: "Qwen/Qwen3-235B-A22B",
      })
    ).toBe("https://huggingface.co/Qwen/Qwen3-235B-A22B");
  });

  it("accepts trusted official provider pages when HF model cards are unavailable", () => {
    expect(
      getTrustedBenchmarkWebsiteUrl({
        slug: "x-ai-grok-4-20",
        provider: "xAI",
        category: "multimodal",
        website_url: "https://docs.x.ai/docs/models",
      })
    ).toBe("https://docs.x.ai/docs/models");

    expect(
      getTrustedBenchmarkWebsiteUrl({
        slug: "minimax-speech-2-8-hd",
        provider: "MiniMax",
        category: "speech_audio",
        website_url: "https://www.minimax.io/models/audio",
      })
    ).toBe("https://www.minimax.io/models/audio");

    expect(
      getTrustedBenchmarkWebsiteUrl({
        slug: "x-ai-grok-4-20",
        provider: "xAI",
        category: "multimodal",
        website_url: "https://example.com/grok",
      })
    ).toBeNull();
  });

  it("accepts official benchmark docs for more official providers", () => {
    expect(
      getTrustedBenchmarkWebsiteUrl({
        slug: "moonshot-kimi-k2",
        provider: "Moonshot AI",
        category: "llm",
        website_url: "https://platform.moonshot.ai/blog/posts/K2_Vendor_Verifier_Newsletter",
      })
    ).toBe("https://platform.moonshot.ai/blog/posts/K2_Vendor_Verifier_Newsletter");

    expect(
      getTrustedBenchmarkWebsiteUrl({
        slug: "mistral-large",
        provider: "Mistral AI",
        category: "llm",
        website_url: "https://mistral.ai/news/frontier-model-update",
      })
    ).toBe("https://mistral.ai/news/frontier-model-update");

    expect(
      getTrustedBenchmarkWebsiteUrl({
        slug: "deepseek-v3",
        provider: "DeepSeek",
        category: "llm",
        website_url: "https://api-docs.deepseek.com/updates",
      })
    ).toBe("https://api-docs.deepseek.com/updates");
  });
});
