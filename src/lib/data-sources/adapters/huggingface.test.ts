import { afterEach, describe, expect, it, vi } from "vitest";

import { __testables, inferOpenWeightsFromHfModel } from "./huggingface";

describe("inferOpenWeightsFromHfModel", () => {
  it("recognizes known open families that were being misclassified as proprietary", () => {
    expect(inferOpenWeightsFromHfModel("google/gemma-3n-E4B-it-litert-lm")).toBe(true);
    expect(inferOpenWeightsFromHfModel("google/embeddinggemma-300m", ["license:gemma"])).toBe(true);
    expect(inferOpenWeightsFromHfModel("google/translategemma-4b-it")).toBe(true);
    expect(inferOpenWeightsFromHfModel("facebook/sam3", ["sam3"])).toBe(true);
    expect(inferOpenWeightsFromHfModel("Lightricks/LTX-2.3", ["ltx-video"])).toBe(true);
    expect(inferOpenWeightsFromHfModel("black-forest-labs/FLUX.1-dev")).toBe(true);
    expect(inferOpenWeightsFromHfModel("black-forest-labs/FLUX.2-klein-9b-kv")).toBe(true);
    expect(
      inferOpenWeightsFromHfModel("nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4")
    ).toBe(true);
    expect(inferOpenWeightsFromHfModel("nvidia/personaplex-7b-v1", ["personaplex"])).toBe(true);
    expect(inferOpenWeightsFromHfModel("nvidia/magpie_tts_multilingual_357m", ["magpie"])).toBe(true);
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
    expect(inferOpenWeightsFromHfModel("black-forest-labs/FLUX.1-pro")).toBe(false);
  });
});

describe("huggingface metadata helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds auth headers for gated HF raw fetches when a token is present", () => {
    expect(__testables.buildHfHeaders()).toEqual({
      "User-Agent": "AI-Market-Cap-Bot/1.0",
    });

    expect(__testables.buildHfHeaders("hf_test_token")).toEqual({
      "User-Agent": "AI-Market-Cap-Bot/1.0",
      Authorization: "Bearer hf_test_token",
    });
  });

  it("keeps per-sync context enrichment limited by provider, but allows broad gap backfill", () => {
    const record = {
      provider: "LocoreMind",
      category: "llm",
      hf_model_id: "LocoreMind/LocoTrainer-4B",
      context_window: null,
    };

    expect(__testables.shouldAttemptContextEnrichment(record as never)).toBe(false);
    expect(
      __testables.shouldAttemptContextEnrichment(record as never, {
        allowAnyProvider: true,
      })
    ).toBe(true);
  });

  it("prefers tokenizer model_max_length when it is trustworthy", () => {
    expect(
      __testables.extractContextWindowFromTokenizerConfig({
        model_max_length: 131072,
      })
    ).toBe(131072);
  });

  it("ignores absurd tokenizer sentinels and falls back to config max positions", () => {
    expect(
      __testables.extractContextWindowFromTokenizerConfig({
        model_max_length: 1000000000000000019884624838656,
      })
    ).toBeNull();

    expect(
      __testables.extractContextWindowFromConfig({
        max_position_embeddings: 4096,
      })
    ).toBe(4096);
  });

  it("derives context from sliding window and rope scaling when needed", () => {
    expect(
      __testables.extractContextWindowFromConfig({
        max_position_embeddings: 32768,
        sliding_window: 131072,
      })
    ).toBe(131072);

    expect(
      __testables.extractContextWindowFromConfig({
        rope_scaling: {
          original_max_position_embeddings: 4096,
          factor: 56,
        },
      })
    ).toBe(229376);

    expect(
      __testables.extractContextWindowFromConfig({
        transformer_layer_config: {
          max_position_embeddings: 40960,
        },
      })
    ).toBe(40960);

    expect(
      __testables.extractContextWindowFromConfig({
        block_size: 4096,
      })
    ).toBe(4096);
  });

  it("adds the canonical HF page URL to transformed records", () => {
    const record = __testables.transformModel({
      id: "Qwen/Qwen2.5-7B-Instruct",
      modelId: "Qwen/Qwen2.5-7B-Instruct",
      author: "Qwen",
      sha: "abc123",
      lastModified: "2026-04-08T00:00:00.000Z",
      private: false,
      disabled: false,
      gated: false,
      pipeline_tag: "text-generation",
      tags: ["license:apache-2.0"],
      downloads: 1,
      likes: 1,
      trendingScore: 1,
      library_name: "transformers",
      createdAt: "2024-09-16T00:00:00.000Z",
    });

    expect(record.website_url).toBe(
      "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct"
    );
    expect(record.hf_model_id).toBe("Qwen/Qwen2.5-7B-Instruct");
  });

  it("extracts ordered base model ids from HF model info card data and tags", () => {
    expect(
      __testables.extractBaseModelIdsFromModelInfo({
        cardData: {
          base_model: [
            "Qwen/Qwen3.5-27B",
            "Jackrong/Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled",
          ],
        },
        tags: [
          "base_model:Qwen/Qwen3.5-27B",
          "base_model:adapter:Qwen/Qwen3.5-27B",
          "base_model:quantized:HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive",
        ],
      })
    ).toEqual([
      "Qwen/Qwen3.5-27B",
      "Jackrong/Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled",
      "HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive",
    ]);
  });

  it("falls back to the HF base model when a derivative repo omits context fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);

        if (
          url ===
          "https://huggingface.co/salakash/Minimalism/raw/main/tokenizer_config.json"
        ) {
          return new Response("{}", { status: 404 });
        }

        if (
          url ===
          "https://huggingface.co/salakash/Minimalism/raw/main/config.json"
        ) {
          return new Response(JSON.stringify({ model_type: "qwen2" }), {
            status: 200,
          });
        }

        if (
          url ===
          "https://huggingface.co/api/models/salakash/Minimalism"
        ) {
          return new Response(
            JSON.stringify({
              cardData: {
                base_model: "Qwen/Qwen2.5-Coder-0.5B-Instruct",
              },
              tags: [
                "base_model:Qwen/Qwen2.5-Coder-0.5B-Instruct",
                "base_model:adapter:Qwen/Qwen2.5-Coder-0.5B-Instruct",
              ],
            }),
            { status: 200 }
          );
        }

        if (
          url ===
          "https://huggingface.co/Qwen/Qwen2.5-Coder-0.5B-Instruct/raw/main/tokenizer_config.json"
        ) {
          return new Response(
            JSON.stringify({
              model_max_length: 32768,
            }),
            { status: 200 }
          );
        }

        throw new Error(`Unexpected fetch URL in test: ${url}`);
      })
    );

    const record = {
      slug: "salakash-minimalism",
      name: "Minimalism",
      provider: "Qwen",
      category: "llm",
      status: "active",
      architecture: "mlx-lm",
      parameter_count: null,
      hf_model_id: "salakash/Minimalism",
      hf_downloads: 0,
      hf_likes: 0,
      hf_trending_score: 0,
      license: "open_source",
      license_name: "apache-2.0",
      is_open_weights: true,
      is_api_available: false,
      supported_languages: [],
      modalities: [],
      capabilities: {},
      context_window: null,
      website_url: null,
      release_date: null,
      data_refreshed_at: new Date().toISOString(),
    };

    await __testables.enrichRecordWithContextWindow(record, undefined, {
      allowAnyProvider: true,
    });

    expect(record.context_window).toBe(32768);
    expect(record.website_url).toBe("https://huggingface.co/salakash/Minimalism");
  });
});
