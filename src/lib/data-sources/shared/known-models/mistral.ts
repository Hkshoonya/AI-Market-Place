import type { KnownModelMeta } from "../build-record";

export const MISTRAL_KNOWN_MODELS: Record<string, KnownModelMeta> = {
  "mixtral-8x7b-instruct-v0-1": {
    name: "Mixtral 8x7B Instruct v0.1",
    description:
      "Mistral AI open-weight mixture-of-experts instruct model for broad general-purpose reasoning and coding workloads.",
    category: "llm",
    context_window: 32768,
    release_date: "2023-12-11",
    architecture: "Sparse mixture-of-experts transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      streaming: true,
    },
    is_open_weights: true,
    license: "open_source",
    license_name: "Apache 2.0",
    hf_model_id: "mistralai/Mixtral-8x7B-Instruct-v0.1",
    website_url: "https://mistral.ai/news/mixtral-of-experts",
  },
  "mistral-7b-instruct-v0-2": {
    name: "Mistral 7B Instruct v0.2",
    description:
      "Mistral AI open-weight instruct model with upgraded context and strong efficiency for production chat and coding use.",
    category: "llm",
    context_window: 32768,
    release_date: "2023-12-11",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      streaming: true,
    },
    is_open_weights: true,
    license: "open_source",
    license_name: "Apache 2.0",
    hf_model_id: "mistralai/Mistral-7B-Instruct-v0.2",
    website_url: "https://docs.mistral.ai/models/mistral-7b-0-2",
  },
};
