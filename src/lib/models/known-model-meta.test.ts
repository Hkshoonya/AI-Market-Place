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
        slug: "google-nano-banana-pro",
        provider: "Google",
      })
    ).toMatchObject({
      category: "image_generation",
      release_date: "2025-11-20",
      license: "commercial",
      is_open_weights: false,
    });

    expect(
      getKnownModelMeta({
        slug: "google-upscaler",
        provider: "Google",
      })
    ).toMatchObject({
      category: "specialized",
      release_date: "2026-02-12",
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
        slug: "minimax-speech-02-turbo",
        provider: "MiniMax",
      })
    ).toMatchObject({
      category: "speech_audio",
      release_date: "2025-04-02",
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

    expect(
      getKnownModelMeta({
        slug: "black-forest-labs-flux-2-flex",
        provider: "Black Forest Labs",
      })
    ).toMatchObject({
      category: "image_generation",
      license: "commercial",
      is_open_weights: false,
    });

    expect(
      getKnownModelMeta({
        slug: "black-forest-labs-flux-fill-pro",
        provider: "Black Forest Labs",
      })
    ).toMatchObject({
      category: "image_generation",
      license: "commercial",
      is_open_weights: false,
    });

    expect(
      getKnownModelMeta({
        slug: "qwen-qwen3-tts",
        provider: "Qwen",
      })
    ).toMatchObject({
      category: "speech_audio",
      license: "open_source",
      license_name: "Apache 2.0",
      is_open_weights: true,
    });

    expect(
      getKnownModelMeta({
        slug: "moonshotai-kimi-k2-6",
        provider: "Moonshot AI",
      })
    ).toMatchObject({
      category: "multimodal",
      release_date: "2026-04-20",
      license: "open_source",
      is_open_weights: true,
      website_url: "https://www.kimi.com/blog/kimi-k2-6",
    });

    expect(
      getKnownModelMeta({
        slug: "deepseek-ai-deepseek-v3-1",
        name: "deepseek-v3.1",
        provider: "DeepSeek",
      })
    ).toMatchObject({
      category: "llm",
      context_window: 128000,
      license: "open_source",
      license_name: "MIT",
    });

    expect(
      getKnownModelMeta({
        slug: "qwen-qwen3-235b-a22b-instruct-2507",
        provider: "Qwen",
      })
    ).toMatchObject({
      context_window: 262144,
      license: "open_source",
      license_name: "Apache 2.0",
    });

    expect(
      getKnownModelMeta({
        slug: "qwen-qwen-image-2-pro",
        provider: "Qwen",
      })
    ).toMatchObject({
      category: "image_generation",
      license: "commercial",
      is_open_weights: false,
    });

    expect(
      getKnownModelMeta({
        slug: "meta-llama-meta-llama-3-8b-instruct",
        provider: "meta-llama",
      })
    ).toMatchObject({
      context_window: 8192,
      license: "open_source",
      license_name: "Llama 3 Community License",
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

  it("fills missing official release and license metadata for newly cataloged provider rows", () => {
    expect(
      buildKnownModelMetaPatch({
        slug: "minimax-music-2-6",
        provider: "MiniMax",
        name: "MiniMax Music 2.6",
        category: "speech_audio",
        release_date: null,
        is_open_weights: false,
        license: "commercial",
        license_name: null,
      })
    ).toMatchObject({
      release_date: "2026-04-10",
    });

    expect(
      buildKnownModelMetaPatch({
        slug: "black-forest-labs-flux-fill-pro",
        provider: "Black Forest Labs",
        name: "flux-fill-pro",
        category: "image_generation",
        release_date: "2026-04-14",
        is_open_weights: true,
        license: null,
        license_name: null,
      })
    ).toMatchObject({
      is_open_weights: false,
      license: "commercial",
    });

    expect(
      buildKnownModelMetaPatch({
        slug: "qwen-qwen3-tts",
        provider: "Qwen",
        name: "qwen3-tts",
        category: "speech_audio",
        release_date: "2026-04-02",
        is_open_weights: true,
        license: null,
        license_name: null,
      })
    ).toMatchObject({
      license: "open_source",
      license_name: "Apache 2.0",
    });

    expect(
      buildKnownModelMetaPatch({
        slug: "qwen-qwen-image-2",
        provider: "Qwen",
        name: "qwen-image-2",
        category: "image_generation",
        release_date: "2026-03-04",
        is_open_weights: true,
        license: null,
        license_name: null,
      })
    ).toMatchObject({
      is_open_weights: false,
      license: "commercial",
    });

    expect(
      buildKnownModelMetaPatch({
        slug: "deepseek-ai-deepseek-v3-1",
        provider: "DeepSeek",
        name: "deepseek-v3.1",
        category: "specialized",
        release_date: "2026-03-03",
        is_open_weights: true,
        license: null,
        license_name: null,
        context_window: null,
      })
    ).toMatchObject({
      category: "llm",
      context_window: 128000,
      license: "open_source",
      license_name: "MIT",
    });

    expect(
      buildKnownModelMetaPatch({
        slug: "meta-llama-meta-llama-3-8b-instruct",
        provider: "meta-llama",
        name: "Meta-Llama-3-8B-Instruct",
        category: "llm",
        release_date: "2024-04-17",
        is_open_weights: false,
        license: "commercial",
        license_name: "proprietary",
        context_window: null,
      })
    ).toMatchObject({
      is_open_weights: true,
      license: "open_source",
      license_name: "Llama 3 Community License",
      context_window: 8192,
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
