import type { KnownModelMeta } from "../build-record";

export const DEEPSEEK_KNOWN_MODELS: Record<string, KnownModelMeta> = {
  "deepseek-v3-1": {
    name: "DeepSeek-V3.1",
    description:
      "DeepSeek open-weight reasoning and coding model released under the MIT License with a 128K token context window.",
    category: "llm",
    context_window: 128000,
    status: "active",
    is_open_weights: true,
    license: "open_source",
    license_name: "MIT",
    website_url: "https://huggingface.co/deepseek-ai/DeepSeek-V3.1",
  },
};
