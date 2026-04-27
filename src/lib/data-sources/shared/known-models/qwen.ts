import type { KnownModelMeta } from "../build-record";

const QWEN_MODEL_STUDIO_TEXT_DOCS =
  "https://www.alibabacloud.com/help/en/model-studio/text-generation-model/";

export const QWEN_KNOWN_MODELS: Record<string, KnownModelMeta> = {
  "qwen3.5-plus-2026-04-20": {
    name: "Qwen3.5 Plus 2026-04-20",
    description:
      "Updated Qwen3.5 Plus commercial snapshot for agentic coding, long-context workflows, and multimodal production tasks in Alibaba Cloud Model Studio.",
    category: "multimodal",
    context_window: 1000000,
    release_date: "2026-04-23",
    architecture: "Hybrid linear attention + sparse MoE",
    status: "active",
    modalities: ["text", "image", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: QWEN_MODEL_STUDIO_TEXT_DOCS,
  },
  "qwen3.6-flash": {
    name: "Qwen3.6 Flash",
    description:
      "Qwen3.6 Flash commercial multimodal model with stronger agentic coding, math, and visual reasoning in Alibaba Cloud Model Studio.",
    category: "multimodal",
    context_window: 1000000,
    release_date: "2026-04-16",
    architecture: "Transformer (MoE)",
    status: "active",
    modalities: ["text", "image", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: QWEN_MODEL_STUDIO_TEXT_DOCS,
  },
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
