/**
 * Anthropic static model data.
 * Extracted from src/lib/data-sources/adapters/anthropic-models.ts KNOWN_MODELS.
 *
 * Note: category and modalities are omitted per-model because all Claude models
 * share category="multimodal" and modalities=["text","image"] — these are
 * set via ProviderDefaults in the adapter.
 */

import type { KnownModelMeta } from "../build-record";

export const ANTHROPIC_KNOWN_MODELS: Record<string, KnownModelMeta> = {
  // ---- Claude 4.6 series (latest) ----
  "claude-opus-4-6": {
    name: "Claude Opus 4.6",
    description:
      "Anthropic's most capable model with advanced reasoning, extended thinking, computer use, and top-tier coding abilities. Sets new benchmarks on complex agentic tasks.",
    context_window: 200000,
    release_date: "2025-12-12",
    architecture: "Transformer",
    status: "active",
    capabilities: {
      vision: true,
      tool_use: true,
      extended_thinking: true,
      coding: true,
      reasoning: true,
      computer_use: true,
      streaming: true,
    },
  },
  "claude-sonnet-4-6": {
    name: "Claude Sonnet 4.6",
    description:
      "High-performance model balancing intelligence and speed. Supports extended thinking and excels at coding, analysis, and complex instruction-following.",
    context_window: 200000,
    release_date: "2025-12-12",
    architecture: "Transformer",
    status: "active",
    capabilities: {
      vision: true,
      tool_use: true,
      extended_thinking: true,
      coding: true,
      streaming: true,
    },
  },

  // ---- Claude 4.5 series ----
  "claude-4-5-sonnet": {
    name: "Claude 4.5 Sonnet",
    description:
      "Refined Sonnet-tier model with extended thinking support and strong performance on agentic tasks. A solid choice for production workloads requiring high quality.",
    context_window: 200000,
    release_date: "2025-10-22",
    architecture: "Transformer",
    status: "active",
    capabilities: {
      vision: true,
      tool_use: true,
      extended_thinking: true,
      coding: true,
      streaming: true,
    },
  },
  "claude-4-5-opus": {
    name: "Claude 4.5 Opus",
    description:
      "Frontier Opus-tier model with deep reasoning, extended thinking, and advanced coding capabilities. Designed for the most demanding enterprise and research workloads.",
    context_window: 200000,
    release_date: "2025-08-01",
    architecture: "Transformer",
    status: "active",
    capabilities: {
      vision: true,
      tool_use: true,
      extended_thinking: true,
      coding: true,
      reasoning: true,
      streaming: true,
    },
  },
  "claude-4-5-haiku": {
    name: "Claude 4.5 Haiku",
    description:
      "Compact Claude 4.5 model tuned for fast, affordable production use while retaining strong coding and tool-use capability.",
    context_window: 200000,
    release_date: "2025-10-22",
    architecture: "Transformer",
    status: "active",
    capabilities: {
      vision: true,
      tool_use: true,
      coding: true,
      streaming: true,
    },
  },

  // ---- Claude 4 series ----
  "claude-4-opus": {
    name: "Claude 4 Opus",
    description:
      "Anthropic's fourth-generation flagship model. Delivers best-in-class reasoning, extended thinking, and advanced multi-step problem solving across domains.",
    context_window: 200000,
    release_date: "2025-05-22",
    architecture: "Transformer",
    status: "active",
    capabilities: {
      vision: true,
      tool_use: true,
      extended_thinking: true,
      coding: true,
      reasoning: true,
      computer_use: true,
      streaming: true,
    },
  },
  "claude-4-sonnet": {
    name: "Claude 4 Sonnet",
    description:
      "Fourth-generation Sonnet model with extended thinking and strong agentic task performance. Optimised for workflows requiring a balance of capability and speed.",
    context_window: 200000,
    release_date: "2025-05-22",
    architecture: "Transformer",
    status: "active",
    capabilities: {
      vision: true,
      tool_use: true,
      extended_thinking: true,
      coding: true,
      streaming: true,
    },
  },

  // ---- Claude 3.5 series ----
  "claude-3-5-sonnet-v2": {
    name: "Claude 3.5 Sonnet v2",
    description:
      "Second iteration of Claude 3.5 Sonnet with computer use support and improved coding performance. Highly capable at agentic tasks and software engineering.",
    context_window: 200000,
    release_date: "2024-10-22",
    architecture: "Transformer",
    status: "active",
    capabilities: {
      vision: true,
      tool_use: true,
      coding: true,
      computer_use: true,
      streaming: true,
    },
  },
  "claude-3-5-haiku": {
    name: "Claude 3.5 Haiku",
    description:
      "Fast, affordable model with surprising capability for its class. Supports vision and tool use, making it ideal for high-throughput production applications.",
    context_window: 200000,
    release_date: "2024-10-22",
    architecture: "Transformer",
    status: "active",
    capabilities: {
      vision: true,
      tool_use: true,
      coding: true,
      streaming: true,
    },
  },

  // ---- Claude 3 series ----
  "claude-3-opus": {
    name: "Claude 3 Opus",
    description:
      "Claude 3's most powerful model. Excels at complex analysis, nuanced content generation, and multi-step reasoning with deep world knowledge.",
    context_window: 200000,
    release_date: "2024-03-04",
    architecture: "Transformer",
    status: "active",
    capabilities: {
      vision: true,
      tool_use: true,
      coding: true,
      reasoning: true,
      streaming: true,
    },
  },
  "claude-3-sonnet": {
    name: "Claude 3 Sonnet",
    description:
      "Balanced Claude 3 model combining strong performance with cost efficiency. Superseded by Claude 3.5 Sonnet; retained for compatibility.",
    context_window: 200000,
    release_date: "2024-03-04",
    architecture: "Transformer",
    status: "deprecated",
    capabilities: {
      vision: true,
      tool_use: true,
      streaming: true,
    },
  },
  "claude-3-haiku": {
    name: "Claude 3 Haiku",
    description:
      "Fastest and most compact Claude 3 model. Designed for near-instant response times in customer-facing applications and simple task automation.",
    context_window: 200000,
    release_date: "2024-03-14",
    architecture: "Transformer",
    status: "active",
    capabilities: {
      vision: true,
      tool_use: true,
      streaming: true,
    },
  },
};
