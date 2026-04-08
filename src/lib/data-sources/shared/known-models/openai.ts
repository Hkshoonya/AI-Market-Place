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
  "gpt-5.4": {
    name: "GPT-5.4",
    description:
      "OpenAI's latest GPT-5 generation model with stronger reasoning, coding, and instruction-following than prior GPT-5 releases.",
    category: "llm",
    parameter_count: null,
    context_window: 256000,
    release_date: "2026-03-05",
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
  "gpt-5.4-mini": {
    name: "GPT-5.4 Mini",
    description:
      "Compact GPT-5.4 variant that keeps modern reasoning and coding performance at lower latency and cost.",
    category: "llm",
    parameter_count: null,
    context_window: 256000,
    release_date: "2026-03-05",
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
  "gpt-5.4-nano": {
    name: "GPT-5.4 Nano",
    description:
      "Smallest GPT-5.4 variant for cost-sensitive automation, classification, and lightweight assistant workloads.",
    category: "llm",
    parameter_count: null,
    context_window: 256000,
    release_date: "2026-03-05",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-5.3": {
    name: "GPT-5.3",
    description:
      "Refined GPT-5 family release focused on chat quality, coding reliability, and better instruction-following in production use.",
    category: "llm",
    parameter_count: null,
    context_window: 256000,
    release_date: "2026-02-10",
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
  "gpt-5-mini": {
    name: "GPT-5 Mini",
    description:
      "Smaller GPT-5 family model tuned for lower-latency chat, coding, and multimodal assistant workloads.",
    category: "llm",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-08-07",
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
  "gpt-5-nano": {
    name: "GPT-5 Nano",
    description:
      "Smallest GPT-5 family model for cost-sensitive classification, lightweight assistants, and high-throughput automation.",
    category: "llm",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-08-07",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-5-search-api": {
    name: "GPT-5 Search API",
    description:
      "Search-oriented GPT-5 variant for retrieval-augmented answers, web search experiences, and citation-heavy response flows.",
    category: "llm",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-10-14",
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
  "gpt-image-1.5": {
    name: "GPT Image 1.5",
    description:
      "Updated GPT Image model generation family with stronger instruction following, editing, and visual quality than GPT Image 1.",
    category: "image_generation",
    parameter_count: null,
    context_window: null,
    release_date: "2025-12-16",
    architecture: "Diffusion",
    status: "active",
    modalities: ["text", "image"],
    capabilities: { image_generation: true, image_editing: true },
  },
  "gpt-image-1-mini": {
    name: "GPT Image 1 Mini",
    description:
      "Compact GPT Image family model for lower-cost generation and editing workloads.",
    category: "image_generation",
    parameter_count: null,
    context_window: null,
    release_date: "2025-12-16",
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
  "gpt-5.1-codex": {
    name: "GPT-5.1 Codex",
    description:
      "Codex-oriented GPT-5.1 variant for agentic software engineering, repository edits, and tool-augmented coding tasks.",
    category: "code",
    parameter_count: null,
    context_window: 200000,
    release_date: "2025-11-12",
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
  "o3-deep-research": {
    name: "o3 Deep Research",
    description:
      "Research-oriented o3 variant tuned for extended multi-step analysis, synthesis, and citation-heavy investigative workflows.",
    category: "llm",
    parameter_count: null,
    context_window: 200000,
    release_date: "2025-06-26",
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
  "o1-pro": {
    name: "o1 Pro",
    description:
      "Higher-capacity o1 reasoning model intended for more demanding scientific, mathematical, and coding workloads.",
    category: "llm",
    parameter_count: null,
    context_window: 200000,
    release_date: "2025-03-19",
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
  "gpt-audio": {
    name: "GPT Audio",
    description:
      "General-purpose OpenAI audio model for speech input, spoken responses, and low-latency voice interactions.",
    category: "speech_audio",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-08-28",
    architecture: "Transformer (audio)",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: {
      transcription: true,
      text_to_speech: true,
      streaming: true,
    },
  },
  "gpt-realtime": {
    name: "GPT Realtime",
    description:
      "General-purpose realtime OpenAI model for streaming voice, multimodal assistants, and low-latency interactive applications.",
    category: "speech_audio",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-08-28",
    architecture: "Transformer (realtime)",
    status: "active",
    modalities: ["text", "audio", "image"],
    capabilities: {
      vision: true,
      transcription: true,
      text_to_speech: true,
      streaming: true,
    },
  },
  "gpt-audio-mini": {
    name: "GPT Audio Mini",
    description:
      "Compact OpenAI audio model optimized for affordable speech-driven experiences and responsive voice agents.",
    category: "speech_audio",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-10-06",
    architecture: "Transformer (audio)",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: {
      transcription: true,
      text_to_speech: true,
      streaming: true,
    },
  },
  "gpt-4o-transcribe": {
    name: "GPT-4o Transcribe",
    description:
      "Speech-to-text model in the GPT-4o family for high-quality transcription and audio understanding workflows.",
    category: "speech_audio",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-03-20",
    architecture: "Transformer (audio)",
    status: "active",
    modalities: ["audio", "text"],
    capabilities: {
      transcription: true,
      streaming: true,
    },
  },
  "gpt-4o-transcribe-diarize": {
    name: "GPT-4o Transcribe Diarize",
    description:
      "Diarization-capable GPT-4o transcription model for speaker-aware speech-to-text workflows.",
    category: "speech_audio",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-03-20",
    architecture: "Transformer (audio)",
    status: "active",
    modalities: ["audio", "text"],
    capabilities: {
      transcription: true,
      streaming: true,
    },
  },
  "gpt-4o-mini-transcribe": {
    name: "GPT-4o Mini Transcribe",
    description:
      "Compact GPT-4o-family transcription model tuned for affordable speech-to-text and voice-assistant pipelines.",
    category: "speech_audio",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-03-20",
    architecture: "Transformer (audio)",
    status: "active",
    modalities: ["audio", "text"],
    capabilities: {
      transcription: true,
      streaming: true,
    },
  },
  "gpt-4o-mini-tts": {
    name: "GPT-4o Mini TTS",
    description:
      "Compact text-to-speech model in the GPT-4o family for low-cost voice output and streaming assistants.",
    category: "speech_audio",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-03-20",
    architecture: "Transformer (audio)",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: {
      text_to_speech: true,
      streaming: true,
    },
  },
  "gpt-realtime-mini": {
    name: "GPT Realtime Mini",
    description:
      "Low-latency realtime OpenAI model for streaming voice and multimodal assistant interactions.",
    category: "speech_audio",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-10-06",
    architecture: "Transformer (realtime)",
    status: "active",
    modalities: ["text", "audio", "image"],
    capabilities: {
      vision: true,
      transcription: true,
      text_to_speech: true,
      streaming: true,
    },
  },
  "chatgpt-image": {
    name: "ChatGPT Image",
    description:
      "OpenAI's latest general-purpose image-generation model with improved instruction following, precise editing, and stronger text rendering.",
    category: "image_generation",
    parameter_count: null,
    context_window: null,
    release_date: "2025-12-16",
    architecture: "Diffusion Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      image_generation: true,
      image_editing: true,
    },
  },
  "omni-moderation-latest": {
    name: "Omni Moderation",
    description:
      "OpenAI moderation model for text and image safety classification in production applications.",
    category: "specialized",
    parameter_count: null,
    context_window: null,
    release_date: "2024-09-26",
    architecture: "Transformer (moderation)",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      classification: true,
      vision: true,
    },
  },
  "omni-moderation-2024-09-26": {
    name: "Omni Moderation 2024-09-26",
    description:
      "Versioned OpenAI moderation model for text and image safety classification.",
    category: "specialized",
    parameter_count: null,
    context_window: null,
    release_date: "2024-09-26",
    architecture: "Transformer (moderation)",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      classification: true,
      vision: true,
    },
  },
  "sora-2": {
    name: "Sora 2",
    description:
      "OpenAI's flagship video and audio generation model with stronger realism, controllability, and synchronized dialogue and sound effects.",
    category: "video_generation",
    parameter_count: null,
    context_window: null,
    release_date: "2025-09-30",
    architecture: "Diffusion Transformer",
    status: "active",
    modalities: ["text", "image", "video", "audio"],
    capabilities: {
      video_generation: true,
      image_to_video: true,
      text_to_speech: true,
    },
  },
  "sora-2-pro": {
    name: "Sora 2 Pro",
    description:
      "Higher-quality experimental Sora 2 variant for premium video generation and more demanding cinematic workloads.",
    category: "video_generation",
    parameter_count: null,
    context_window: null,
    release_date: "2025-09-30",
    architecture: "Diffusion Transformer",
    status: "active",
    modalities: ["text", "image", "video", "audio"],
    capabilities: {
      video_generation: true,
      image_to_video: true,
      text_to_speech: true,
    },
  },
  "gpt-3.5-turbo": {
    name: "GPT-3.5 Turbo",
    description:
      "High-throughput general-purpose language model from OpenAI, retained for compatibility and cost-sensitive text workflows.",
    category: "llm",
    parameter_count: null,
    context_window: 16385,
    release_date: "2023-11-06",
    architecture: "Transformer",
    status: "deprecated",
    modalities: ["text"],
    capabilities: {
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-3.5-turbo-instruct": {
    name: "GPT-3.5 Turbo Instruct",
    description:
      "Instruction-following GPT-3.5 variant preserved for legacy completions-style workloads and lightweight automation.",
    category: "llm",
    parameter_count: null,
    context_window: 4096,
    release_date: "2023-09-14",
    architecture: "Transformer",
    status: "deprecated",
    modalities: ["text"],
    capabilities: {
      streaming: true,
    },
  },
  "babbage-002": {
    name: "babbage-002",
    description:
      "Legacy OpenAI base model retained for older completions-style and fine-tuning-compatible workflows.",
    category: "llm",
    parameter_count: null,
    context_window: 16384,
    release_date: "2023-11-06",
    architecture: "Transformer",
    status: "deprecated",
    modalities: ["text"],
    capabilities: {
      streaming: true,
    },
  },
  "davinci-002": {
    name: "davinci-002",
    description:
      "Legacy OpenAI base model retained for older completions-style and fine-tuning-compatible workflows with stronger general capability than babbage-002.",
    category: "llm",
    parameter_count: null,
    context_window: 16384,
    release_date: "2023-11-06",
    architecture: "Transformer",
    status: "deprecated",
    modalities: ["text"],
    capabilities: {
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

function normalizeOpenAiFamilyId(modelId: string) {
  return modelId
    .replace(/^gpt-(\d)-(\d)(?=-|$)/, "gpt-$1.$2")
    .replace(/^gpt-image$/, "gpt-image-1.5")
    .replace(/^gpt-image-1-5$/, "gpt-image-1.5")
    .replace(/^gpt-audio-1-5$/, "gpt-audio")
    .replace(/^gpt-realtime-1-5$/, "gpt-realtime");
}

export function resolveOpenAIKnownModelMeta(
  modelId: string
): KnownModelMeta | undefined {
  const direct = OPENAI_KNOWN_MODELS[modelId];
  if (direct) return direct;

  const normalized = normalizeOpenAiFamilyId(modelId);
  const candidates = new Set<string>([normalized]);

  const withoutLatest = normalized.replace(/-latest$/, "");
  candidates.add(withoutLatest);
  candidates.add(withoutLatest.replace(/-(chat|codex|pro|structured|instant)$/, ""));
  candidates.add(withoutLatest.replace(/-(mini|nano|search-api)$/, ""));
  candidates.add(withoutLatest.replace(/-\d{4}-\d{2}-\d{2}$/, ""));
  candidates.add(
    withoutLatest
      .replace(/-\d{4}-\d{2}-\d{2}$/, "")
      .replace(/-(chat|codex|pro|structured|instant)$/, "")
  );
  candidates.add(
    withoutLatest
      .replace(/-\d{4}-\d{2}-\d{2}$/, "")
      .replace(/-(mini|nano|search-api)$/, "")
  );
  candidates.add(normalized.replace(/-\d{8}$/, ""));
  candidates.add(normalized.replace(/-\d{4}$/, ""));
  candidates.add(normalized.replace(/-\d{4}$/, "").replace(/-instruct$/, "-instruct"));
  candidates.add(normalized.replace(/-\d{4}$/, "").replace(/-(chat|codex|pro|structured|instant)$/, ""));
  candidates.add(normalized.replace(/-\d{4}$/, "").replace(/-(mini|nano|search-api)$/, ""));

  for (const candidate of candidates) {
    if (candidate && OPENAI_KNOWN_MODELS[candidate]) {
      return OPENAI_KNOWN_MODELS[candidate];
    }
  }

  return undefined;
}
