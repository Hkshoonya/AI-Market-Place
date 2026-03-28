import type { KnownModelMeta } from "../build-record";

export const MINIMAX_KNOWN_MODELS: Record<string, KnownModelMeta> = {
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
  },
  "MiniMax-M1": {
    name: "MiniMax M1",
    description:
      "MiniMax general reasoning model for high-quality text generation and coding assistance.",
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
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },
  "MiniMax-M1-80k": {
    name: "MiniMax M1 80K",
    description:
      "Lower-context MiniMax M1 variant optimized for shorter production interactions.",
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
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },
};
