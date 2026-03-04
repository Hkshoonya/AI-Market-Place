/**
 * Google AI static model data.
 * Extracted from src/lib/data-sources/adapters/google-models.ts KNOWN_MODELS.
 */

import type { KnownModelMeta } from "../build-record";

export const GOOGLE_KNOWN_MODELS: Record<string, KnownModelMeta> = {
  // ---- Gemini 3 series ----
  "gemini-3-pro": {
    name: "Gemini 3 Pro",
    description:
      "Google's third-generation flagship multimodal model with a 1 million token context window. Delivers state-of-the-art performance across reasoning, coding, and long-context understanding.",
    category: "multimodal",
    context_window: 1000000,
    release_date: "2025-11-18",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      grounding: true,
      code_execution: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },
  "gemini-3-flash": {
    name: "Gemini 3 Flash",
    description:
      "Fast, cost-efficient third-generation Gemini model with a 1 million token context window. Optimised for high-throughput applications requiring real-time multimodal responses.",
    category: "multimodal",
    context_window: 1000000,
    release_date: "2025-11-18",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      grounding: true,
      code_execution: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },

  // ---- Gemini 2.5 series ----
  "gemini-2.5-pro": {
    name: "Gemini 2.5 Pro",
    description:
      "Google's most capable Gemini 2.5 model with a 1 million token context window and deep thinking mode. Achieves top performance on coding, math, and science benchmarks.",
    category: "multimodal",
    context_window: 1000000,
    release_date: "2025-03-25",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      grounding: true,
      code_execution: true,
      function_calling: true,
      extended_thinking: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },
  "gemini-2.5-flash": {
    name: "Gemini 2.5 Flash",
    description:
      "Efficient Gemini 2.5 model combining fast inference with a 1 million token context. Features thinking mode for improved accuracy on complex tasks at lower cost than Pro.",
    category: "multimodal",
    context_window: 1000000,
    release_date: "2025-05-20",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      grounding: true,
      code_execution: true,
      function_calling: true,
      extended_thinking: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },

  // ---- Gemini 2.0 series ----
  "gemini-2.0-flash": {
    name: "Gemini 2.0 Flash",
    description:
      "Next-generation Flash model with native tool use, multimodal live API, and a 1 million token context. Delivers Gemini 1.5 Pro quality at Flash speed and cost.",
    category: "multimodal",
    context_window: 1048576,
    release_date: "2025-02-05",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      grounding: true,
      code_execution: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },
  "gemini-2.0-flash-lite": {
    name: "Gemini 2.0 Flash Lite",
    description:
      "Ultra-lightweight variant of Gemini 2.0 Flash designed for cost-sensitive, high-volume workloads. Retains the 1 million token context window with minimal inference cost.",
    category: "multimodal",
    context_window: 1048576,
    release_date: "2025-02-05",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },

  // ---- Gemini 1.5 series ----
  "gemini-1.5-pro": {
    name: "Gemini 1.5 Pro",
    description:
      "Mid-size multimodal model with an industry-leading 2 million token context window using Mixture-of-Experts architecture. Excels at long-document analysis and complex reasoning.",
    category: "multimodal",
    context_window: 2097152,
    release_date: "2024-05-15",
    architecture: "Transformer (MoE)",
    status: "active",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      grounding: true,
      code_execution: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },
  "gemini-1.5-flash": {
    name: "Gemini 1.5 Flash",
    description:
      "Fast, versatile model with a 1 million token context window. Designed for high-frequency tasks requiring broad multimodal capability at accessible cost.",
    category: "multimodal",
    context_window: 1048576,
    release_date: "2024-05-15",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      grounding: true,
      code_execution: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },

  // ---- Gemma open models ----
  "gemma-3": {
    name: "Gemma 3",
    description:
      "Google's third-generation open-weights language model family. Available in multiple sizes, suitable for on-device inference, fine-tuning, and research.",
    category: "llm",
    context_window: 128000,
    release_date: "2025-03-12",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      coding: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: true,
    license: "open_source",
    license_name: "Apache 2.0",
  },
  "gemma-2": {
    name: "Gemma 2",
    description:
      "Second-generation open-weights model from Google. Offers competitive performance in a compact form factor; available in 2B, 9B, and 27B parameter variants.",
    category: "llm",
    context_window: 8192,
    release_date: "2024-06-27",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      coding: true,
      streaming: true,
    },
    is_open_weights: true,
    license: "open_source",
    license_name: "Apache 2.0",
  },

  // ---- Image generation ----
  "imagen-3": {
    name: "Imagen 3",
    description:
      "Google's highest-quality text-to-image model. Produces photorealistic images with exceptional detail, lighting accuracy, and minimal artifacts.",
    category: "image_generation",
    context_window: null,
    release_date: "2024-08-01",
    architecture: "Diffusion",
    status: "active",
    modalities: ["text", "image"],
    capabilities: { image_generation: true, image_editing: true },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },

  // ---- Video generation ----
  "veo-2": {
    name: "Veo 2",
    description:
      "Google's advanced video generation model capable of producing high-definition video clips from text and image prompts with improved physics understanding and motion coherence.",
    category: "video",
    context_window: null,
    release_date: "2024-12-01",
    architecture: "Diffusion (Video)",
    status: "active",
    modalities: ["text", "image", "video"],
    capabilities: { video_generation: true },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },
};
