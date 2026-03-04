/**
 * OpenAI static model data.
 * Extracted from src/lib/data-sources/adapters/openai-models.ts KNOWN_MODELS.
 */

import type { KnownModelMeta } from "../build-record";

export const OPENAI_KNOWN_MODELS: Record<string, KnownModelMeta> = {
  // ---- GPT-5 series ----
  "gpt-5.2": {
    name: "GPT-5.2",
    description:
      "OpenAI's most advanced reasoning model. Incorporates significant improvements over GPT-5 in complex multi-step reasoning, coding, and instruction-following.",
    category: "llm",
    parameter_count: null,
    context_window: 256000,
    release_date: "2025-12-01",
    architecture: "Transformer (reasoning)",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-5.1": {
    name: "GPT-5.1",
    description:
      "Refined version of GPT-5 with improved instruction-following, reduced hallucinations, and better performance across standard benchmarks.",
    category: "llm",
    parameter_count: null,
    context_window: 256000,
    release_date: "2025-11-12",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-5": {
    name: "GPT-5",
    description:
      "OpenAI's fifth-generation flagship language model. Delivers substantially improved intelligence and capability over GPT-4o across reasoning, coding, and creative tasks.",
    category: "llm",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-08-01",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },

  // ---- GPT-4.1 series ----
  "gpt-4.1": {
    name: "GPT-4.1",
    description:
      "High-intelligence multimodal model with a 1 million token context window. Excels at complex instruction-following and long-document analysis.",
    category: "llm",
    parameter_count: null,
    context_window: 1048576,
    release_date: "2025-04-14",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-4.1-mini": {
    name: "GPT-4.1 Mini",
    description:
      "Compact, cost-efficient version of GPT-4.1 retaining the 1 million token context window. Ideal for high-throughput, latency-sensitive applications.",
    category: "llm",
    parameter_count: null,
    context_window: 1048576,
    release_date: "2025-04-14",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-4.1-nano": {
    name: "GPT-4.1 Nano",
    description:
      "Ultra-lightweight variant of GPT-4.1 optimised for edge deployments and cost-constrained workloads, while retaining the 1 million token context.",
    category: "llm",
    parameter_count: null,
    context_window: 1048576,
    release_date: "2025-04-14",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      function_calling: true,
      streaming: true,
    },
  },

  // ---- o-series reasoning models ----
  "o4-mini": {
    name: "o4-mini",
    description:
      "Fast, cost-efficient reasoning model in the o-series. Balances strong STEM performance with lower inference cost and adjustable reasoning effort.",
    category: "llm",
    parameter_count: null,
    context_window: 200000,
    release_date: "2025-04-16",
    architecture: "Transformer (reasoning)",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  o3: {
    name: "o3",
    description:
      "OpenAI's most powerful reasoning model. Achieves state-of-the-art results on complex math, science, and code tasks through extended chain-of-thought.",
    category: "llm",
    parameter_count: null,
    context_window: 200000,
    release_date: "2025-04-16",
    architecture: "Transformer (reasoning)",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "o3-mini": {
    name: "o3-mini",
    description:
      "Cost-efficient reasoning model with adjustable reasoning effort. Optimised for STEM and coding tasks at a fraction of o3's inference cost.",
    category: "llm",
    parameter_count: null,
    context_window: 200000,
    release_date: "2025-01-31",
    architecture: "Transformer (reasoning)",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      function_calling: true,
      streaming: true,
    },
  },
  o1: {
    name: "o1",
    description:
      "First-generation full o-series reasoning model. Uses extended internal chain-of-thought before responding, excelling at PhD-level science and math problems.",
    category: "llm",
    parameter_count: null,
    context_window: 200000,
    release_date: "2024-12-17",
    architecture: "Transformer (reasoning)",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "o1-mini": {
    name: "o1-mini",
    description:
      "Smaller, faster reasoning model in the o1 series. Optimised for STEM tasks at lower cost than full o1.",
    category: "llm",
    parameter_count: null,
    context_window: 128000,
    release_date: "2024-09-12",
    architecture: "Transformer (reasoning)",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      streaming: true,
    },
  },

  // ---- GPT-4o series ----
  "gpt-4o": {
    name: "GPT-4o",
    description:
      "Multimodal flagship model with native vision and audio capabilities. Combines high intelligence with fast response times at competitive pricing.",
    category: "multimodal",
    parameter_count: null,
    context_window: 128000,
    release_date: "2024-05-13",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image", "audio"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-4o-mini": {
    name: "GPT-4o Mini",
    description:
      "Small, fast, and affordable multimodal model for lightweight tasks. Retains vision capabilities of GPT-4o at significantly reduced cost.",
    category: "multimodal",
    parameter_count: null,
    context_window: 128000,
    release_date: "2024-07-18",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },

  // ---- GPT-4 legacy ----
  "gpt-4-turbo": {
    name: "GPT-4 Turbo",
    description:
      "GPT-4 Turbo with Vision — high-intelligence model with 128K context and knowledge cutoff April 2024. Predecessor to GPT-4o.",
    category: "llm",
    parameter_count: null,
    context_window: 128000,
    release_date: "2024-04-09",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-4": {
    name: "GPT-4",
    description:
      "Original GPT-4 model with broad general knowledge and strong reasoning. 8K context window; superseded by GPT-4 Turbo and GPT-4o.",
    category: "llm",
    parameter_count: null,
    context_window: 8192,
    release_date: "2023-03-14",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      coding: true,
      function_calling: true,
      streaming: true,
    },
  },

  // ---- Image generation ----
  "gpt-image-1": {
    name: "GPT Image 1",
    description:
      "OpenAI's newest image generation model, natively integrated into the GPT-4o ecosystem. Produces photorealistic images with strong prompt adherence.",
    category: "image_generation",
    parameter_count: null,
    context_window: null,
    release_date: "2025-04-23",
    architecture: "Diffusion",
    status: "active",
    modalities: ["text", "image"],
    capabilities: { image_generation: true, image_editing: true },
  },
  "dall-e-3": {
    name: "DALL-E 3",
    description:
      "State-of-the-art image generation model with high fidelity and outstanding prompt adherence. Natively integrated into ChatGPT.",
    category: "image_generation",
    parameter_count: null,
    context_window: null,
    release_date: "2023-10-01",
    architecture: "Diffusion",
    status: "active",
    modalities: ["text", "image"],
    capabilities: { image_generation: true },
  },
  "dall-e-2": {
    name: "DALL-E 2",
    description:
      "Second-generation image generation model capable of creating realistic images and art. Supports in-painting and out-painting. Superseded by DALL-E 3.",
    category: "image_generation",
    parameter_count: null,
    context_window: null,
    release_date: "2022-04-01",
    architecture: "Diffusion",
    status: "deprecated",
    modalities: ["text", "image"],
    capabilities: { image_generation: true, image_editing: true },
  },

  // ---- Code ----
  "codex-mini-latest": {
    name: "Codex Mini",
    description:
      "Lightweight code-optimised model based on the o-series reasoning architecture. Designed for agentic coding tasks and automated software engineering.",
    category: "code",
    parameter_count: null,
    context_window: 200000,
    release_date: "2025-05-16",
    architecture: "Transformer (code)",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      function_calling: true,
      streaming: true,
    },
  },

  // ---- Specialized / Agentic ----
  "computer-use-preview": {
    name: "Computer Use Preview",
    description:
      "Specialized agentic model capable of interacting with computer interfaces — clicking, typing, and navigating GUIs autonomously.",
    category: "specialized",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-03-01",
    architecture: "Transformer (agentic)",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      vision: true,
      computer_use: true,
      function_calling: true,
    },
  },

  // ---- Audio ----
  "gpt-4o-audio-preview": {
    name: "GPT-4o Audio",
    description:
      "Audio-capable variant of GPT-4o supporting real-time speech input and output. Enables low-latency voice assistants and audio reasoning tasks.",
    category: "speech_audio",
    parameter_count: null,
    context_window: 128000,
    release_date: "2024-10-01",
    architecture: "Transformer (audio)",
    status: "active",
    modalities: ["text", "image", "audio"],
    capabilities: {
      vision: true,
      transcription: true,
      text_to_speech: true,
      streaming: true,
    },
  },
  "whisper-1": {
    name: "Whisper",
    description:
      "General-purpose speech recognition model trained on 680K hours of multilingual audio. Supports transcription and translation across 97 languages.",
    category: "speech_audio",
    parameter_count: null,
    context_window: null,
    release_date: "2023-03-01",
    architecture: "Transformer (ASR)",
    status: "active",
    modalities: ["audio", "text"],
    capabilities: { transcription: true, translation: true },
  },
  "tts-1": {
    name: "TTS-1",
    description:
      "Text-to-speech model optimised for real-time streaming with low latency. Six built-in voices available.",
    category: "speech_audio",
    parameter_count: null,
    context_window: null,
    release_date: "2023-11-01",
    architecture: "TTS",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: { text_to_speech: true, streaming: true },
  },
  "tts-1-hd": {
    name: "TTS-1 HD",
    description:
      "High-definition variant of TTS-1 producing richer, higher-quality audio output. Recommended when audio fidelity is more important than latency.",
    category: "speech_audio",
    parameter_count: null,
    context_window: null,
    release_date: "2023-11-01",
    architecture: "TTS",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: { text_to_speech: true },
  },

  // ---- Embeddings ----
  "text-embedding-3-large": {
    name: "Embedding 3 Large",
    description:
      "Most capable embedding model for English and multilingual tasks. Produces 3072-dimension vectors; supports dimension reduction for cost-performance trade-offs.",
    category: "embeddings",
    parameter_count: null,
    context_window: 8191,
    release_date: "2024-01-25",
    architecture: "Transformer (embed)",
    status: "active",
    modalities: ["text"],
    capabilities: { embeddings: true },
  },
  "text-embedding-3-small": {
    name: "Embedding 3 Small",
    description:
      "Efficient embedding model with 1536-dimension output. Significant upgrade over ada-002 at a lower cost; ideal for most retrieval and similarity tasks.",
    category: "embeddings",
    parameter_count: null,
    context_window: 8191,
    release_date: "2024-01-25",
    architecture: "Transformer (embed)",
    status: "active",
    modalities: ["text"],
    capabilities: { embeddings: true },
  },
};
