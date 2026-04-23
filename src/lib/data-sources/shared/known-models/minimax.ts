import type { KnownModelMeta } from "../build-record";

export const MINIMAX_KNOWN_MODELS: Record<string, KnownModelMeta> = {
  "MiniMax-M2": {
    name: "MiniMax M2",
    description:
      "MiniMax open-weight reasoning and coding model built for agentic software workflows and production tool use.",
    category: "llm",
    context_window: 204800,
    release_date: "2025-10-27",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: true,
    license: "open_source",
    license_name: "Open weights",
    website_url: "https://www.minimax.io/news/minimax-m2",
  },
  "MiniMax-M2.7": {
    name: "MiniMax M2.7",
    description:
      "Latest MiniMax reasoning and coding model optimized for agentic software workflows.",
    category: "llm",
    context_window: 1000000,
    release_date: "2026-03-27",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.minimax.io/models/text",
  },
  "MiniMax-M2.5": {
    name: "MiniMax M2.5",
    description:
      "MiniMax reasoning and coding model family tuned for agentic software workflows and long-context production runs, with open weights for private cluster deployment.",
    category: "llm",
    context_window: 1000000,
    release_date: "2026-03-12",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: true,
    license: "open_source",
    license_name: "Open weights",
    website_url: "https://www.minimax.io/models/text",
  },
  "MiniMax-M2.1": {
    name: "MiniMax M2.1",
    description:
      "MiniMax coding and reasoning model optimized for real-world programming, workplace tasks, and agentic software workflows.",
    category: "llm",
    context_window: 1000000,
    release_date: "2025-12-23",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.minimax.io/models/text",
  },
  "MiniMax-M2-her": {
    name: "MiniMax M2-her",
    description:
      "MiniMax reasoning model variant for structured long-context workflows and production agent tasks.",
    category: "llm",
    context_window: 1000000,
    release_date: "2026-01-23",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.minimax.io/models/text",
  },
  "MiniMax-M1": {
    name: "MiniMax M1",
    description:
      "MiniMax general reasoning model for high-quality text generation and coding assistance, released with open weights for self-hosted deployment.",
    category: "llm",
    context_window: 1000000,
    release_date: "2026-03-01",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: true,
    license: "open_source",
    license_name: "Open weights",
    website_url: "https://www.minimax.io/models/text",
  },
  "MiniMax-M1-80k": {
    name: "MiniMax M1 80K",
    description:
      "Lower-context MiniMax M1 variant optimized for shorter production interactions and compatible with self-hosted open-weight deployment.",
    category: "llm",
    context_window: 80000,
    release_date: "2026-03-01",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: true,
    license: "open_source",
    license_name: "Open weights",
    website_url: "https://www.minimax.io/models/text",
  },
  "speech-2.8-turbo": {
    name: "MiniMax Speech 2.8 Turbo",
    description:
      "Fast MiniMax speech generation model for turning text into natural speech with multilingual support, emotion control, and voice cloning features.",
    category: "speech_audio",
    release_date: "2026-02-05",
    architecture: "Speech generation",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: {
      audio_generation: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.minimax.io/models/audio",
  },
  "speech-2.8-hd": {
    name: "MiniMax Speech 2.8 HD",
    description:
      "High-fidelity MiniMax speech generation model focused on studio-grade output, multilingual speech synthesis, emotion control, and voice cloning.",
    category: "speech_audio",
    release_date: "2026-02-05",
    architecture: "Speech generation",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: {
      audio_generation: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.minimax.io/models/audio",
  },
  "music-2.5": {
    name: "MiniMax Music 2.5",
    description:
      "MiniMax music generation model for creating full-length songs with vocals, lyrics, and rich instrumentation from text prompts.",
    category: "speech_audio",
    release_date: "2026-03-03",
    architecture: "Music generation",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: {
      audio_generation: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.minimax.io/models/audio",
  },
  "speech-2.6-turbo": {
    name: "MiniMax Speech 2.6 Turbo",
    description:
      "Low-latency MiniMax speech model for real-time multilingual text-to-speech with expressive voices and fast response.",
    category: "speech_audio",
    architecture: "Speech generation",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: {
      audio_generation: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.minimax.io/models/speech",
  },
  "speech-2.6-hd": {
    name: "MiniMax Speech 2.6 HD",
    description:
      "High-fidelity MiniMax speech model for premium voiceovers, audiobooks, and studio-grade multilingual text-to-speech.",
    category: "speech_audio",
    architecture: "Speech generation",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: {
      audio_generation: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.minimax.io/models/speech",
  },
  "speech-02-hd": {
    name: "MiniMax Speech 02 HD",
    description:
      "High-definition MiniMax text-to-audio model focused on natural voice synthesis, emotional delivery, and multilingual output.",
    release_date: "2025-04-02",
    category: "speech_audio",
    architecture: "Speech generation",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: {
      audio_generation: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.minimax.io/models/speech",
  },
  "speech-02-turbo": {
    name: "MiniMax Speech 02 Turbo",
    description:
      "Low-latency MiniMax speech model tuned for real-time text-to-audio, voice cloning, and interactive conversational audio use cases.",
    release_date: "2025-04-02",
    category: "speech_audio",
    architecture: "Speech generation",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: {
      audio_generation: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.minimax.io/news/speech-02-series",
  },
  "music-2.6": {
    name: "MiniMax Music 2.6",
    description:
      "MiniMax music generation model for full-length songs, richer bass, stronger arrangement control, and higher-quality vocals.",
    release_date: "2026-04-10",
    category: "speech_audio",
    architecture: "Music generation",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: {
      audio_generation: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.minimax.io/models/speech",
  },
  "music-cover": {
    name: "MiniMax Music Cover",
    description:
      "MiniMax cover-generation model for style transfer, vocal replacement, and one-step cover creation from reference audio.",
    release_date: "2026-04-10",
    category: "speech_audio",
    architecture: "Music generation",
    status: "active",
    modalities: ["audio"],
    capabilities: {
      audio_generation: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.minimax.io/models/speech",
  },
};

const MINIMAX_KNOWN_MODEL_FAMILY_PREFIXES = [
  "MiniMax-M2.5-",
  "MiniMax-M2.1-",
  "MiniMax-M2-her-",
  "MiniMax-M1-",
  "MiniMax-M2.7-",
] as const;

export function resolveMiniMaxKnownModelMeta(modelId: string): KnownModelMeta | undefined {
  const exact = MINIMAX_KNOWN_MODELS[modelId];
  if (exact) return exact;

  const familyPrefix = MINIMAX_KNOWN_MODEL_FAMILY_PREFIXES.find((prefix) =>
    modelId.startsWith(prefix)
  );
  if (!familyPrefix) return undefined;

  const familyKey = familyPrefix.slice(0, -1);
  return MINIMAX_KNOWN_MODELS[familyKey];
}
