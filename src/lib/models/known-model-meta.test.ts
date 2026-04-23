import { describe, expect, it } from "vitest";

import { buildKnownModelMetaPatch, getKnownModelMeta } from "./known-model-meta";

describe("getKnownModelMeta", () => {
  it("resolves Meta open-weight rows by canonical slug", () => {
    expect(
      getKnownModelMeta({
        slug: "meta-llama-3-3-70b-instruct",
        provider: "Meta",
      })
    ).toMatchObject({
      release_date: "2024-12-06",
      context_window: 131072,
      hf_model_id: "meta-llama/Llama-3.3-70B-Instruct",
    });
  });

  it("resolves Black Forest Labs rows by short slug keys", () => {
    expect(
      getKnownModelMeta({
        slug: "black-forest-labs-flux-schnell",
        provider: "Black Forest Labs",
      })
    ).toMatchObject({
      release_date: "2024-08-01",
      hf_model_id: "black-forest-labs/FLUX.1-schnell",
    });
  });
});

describe("buildKnownModelMetaPatch", () => {
  it("fills only missing fields", () => {
    expect(
      buildKnownModelMetaPatch({
        slug: "mistralai-mixtral-8x7b-instruct-v0-1",
        provider: "Mistral AI",
        name: "Mixtral 8x7B Instruct",
        category: "llm",
        release_date: null,
        context_window: null,
        hf_model_id: null,
        website_url: null,
      })
    ).toMatchObject({
      release_date: "2023-12-11",
      context_window: 32768,
      hf_model_id: "mistralai/Mixtral-8x7B-Instruct-v0.1",
      website_url: "https://mistral.ai/news/mixtral-of-experts",
    });
  });

  it("does not overwrite existing populated fields", () => {
    expect(
      buildKnownModelMetaPatch({
        slug: "openai-gpt-image-2",
        provider: "OpenAI",
        name: "GPT Image 2",
        category: "image_generation",
        release_date: "2026-04-22",
        website_url: "https://example.com/custom",
      })
    ).toEqual({});
  });
});
