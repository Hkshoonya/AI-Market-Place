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

  it("resolves Google speech rows by provider catalog fallback", () => {
    expect(
      getKnownModelMeta({
        slug: "google-gemini-3-1-flash-tts",
        provider: "Google",
      })
    ).toMatchObject({
      category: "speech_audio",
      release_date: "2026-04-15",
      website_url:
        "https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-tts/",
    });
  });

  it("resolves newly cataloged official specialist rows by provider fallback", () => {
    expect(
      getKnownModelMeta({
        slug: "google-nano-banana-2",
        provider: "Google",
      })
    ).toMatchObject({
      category: "image_generation",
      release_date: "2026-02-26",
      license: "commercial",
      is_open_weights: false,
    });

    expect(
      getKnownModelMeta({
        slug: "minimax-speech-2-6-turbo",
        provider: "MiniMax",
      })
    ).toMatchObject({
      category: "speech_audio",
      license: "commercial",
      is_open_weights: false,
    });

    expect(
      getKnownModelMeta({
        slug: "black-forest-labs-flux-2-pro",
        provider: "Black Forest Labs",
      })
    ).toMatchObject({
      category: "image_generation",
      license: "commercial",
      is_open_weights: false,
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

  it("overrides generic multimodal categorization for specialist rows", () => {
    expect(
      buildKnownModelMetaPatch({
        slug: "google-gemini-3-1-flash-tts",
        provider: "Google",
        name: "Gemini 3.1 Flash TTS",
        category: "multimodal",
        release_date: null,
        license: null,
      })
    ).toMatchObject({
      category: "speech_audio",
      release_date: "2026-04-15",
      license: "commercial",
    });
  });

  it("overrides generic specialist categorization and wrong open-weight flags for known commercial rows", () => {
    expect(
      buildKnownModelMetaPatch({
        slug: "minimax-music-2-6",
        provider: "MiniMax",
        name: "music-2.6",
        category: "specialized",
        release_date: "2026-04-09",
        is_open_weights: true,
        license: null,
        license_name: null,
      })
    ).toMatchObject({
      category: "speech_audio",
      is_open_weights: false,
      license: "commercial",
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
