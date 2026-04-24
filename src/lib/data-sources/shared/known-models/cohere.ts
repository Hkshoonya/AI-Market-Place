import type { KnownModelMeta } from "../build-record";

export const COHERE_KNOWN_MODELS: Record<string, KnownModelMeta> = {
  "tiny-aya-global": {
    name: "tiny-aya-global",
    description:
      "CohereLabs' compact multilingual Aya model for global text generation and understanding, published on Hugging Face with an 8K context window.",
    category: "llm",
    context_window: 8192,
    release_date: "2026-02-13",
    status: "active",
    modalities: ["text"],
    capabilities: {
      streaming: true,
    },
    is_open_weights: true,
    license: "research_only",
    license_name: "CC-BY-NC-4.0",
    hf_model_id: "CohereLabs/tiny-aya-global",
    website_url: "https://huggingface.co/CohereLabs/tiny-aya-global",
  },
};
