import type { KnownModelMeta } from "../build-record";

export const QWEN_KNOWN_MODELS: Record<string, KnownModelMeta> = {
  "qwen3-235b-a22b-instruct-2507": {
    name: "Qwen3-235B-A22B-Instruct-2507",
    description:
      "Qwen open-weight flagship instruct model with a 262,144 token context window for advanced reasoning, coding, and long-context assistant workloads.",
    category: "llm",
    context_window: 262144,
    status: "active",
    is_open_weights: true,
    license: "open_source",
    license_name: "Apache 2.0",
    website_url: "https://huggingface.co/Qwen/Qwen3-235B-A22B-Instruct-2507",
  },
  "qwen-image-2": {
    name: "Qwen-Image 2",
    description:
      "Qwen commercial image-generation model family served through Model Studio for prompt-following image creation and editing workflows.",
    category: "image_generation",
    status: "active",
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.alibabacloud.com/help/en/model-studio/text-to-image",
  },
  "qwen-image-2-pro": {
    name: "Qwen-Image 2 Pro",
    description:
      "Higher-end Qwen commercial image-generation model in Model Studio for stronger image quality, fidelity, and editing performance.",
    category: "image_generation",
    status: "active",
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.alibabacloud.com/help/en/model-studio/text-to-image",
  },
  "qwen3-tts": {
    name: "Qwen3-TTS",
    description:
      "Qwen open-weight text-to-speech model family for voice cloning, voice design, low-latency streaming generation, and multilingual speech synthesis.",
    category: "speech_audio",
    release_date: "2026-04-02",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: {
      audio_generation: true,
      streaming: true,
    },
    is_open_weights: true,
    license: "open_source",
    license_name: "Apache 2.0",
    website_url: "https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
  },
};
