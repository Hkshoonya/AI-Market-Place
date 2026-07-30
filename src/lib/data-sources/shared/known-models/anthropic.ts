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
  // ---- Claude 5 / latest generation ----
  "claude-opus-5": {
    name: "Claude Opus 5",
    description:
      "Anthropic's current flagship Opus model for complex agentic work, enterprise workflows, advanced coding, and demanding reasoning. It is a proprietary, API-accessible model with a 1M-token context window.",
    category: "multimodal",
    context_window: 1000000,
    release_date: "2026-07-24",
    architecture: "Transformer",
    status: "active",
    is_api_available: true,
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.anthropic.com/news/claude-opus-5",
    modalities: ["text", "image"],
    capabilities: {
      vision: true,
      tool_use: true,
      adaptive_thinking: true,
      coding: true,
      reasoning: true,
      computer_use: true,
      streaming: true,
    },
  },
  "claude-sonnet-5": {
    name: "Claude Sonnet 5",
    description:
      "Anthropic's latest Sonnet model, balancing frontier agentic coding, tool use, computer use, reasoning, and knowledge work with lower cost than the Opus tier.",
    category: "multimodal",
    context_window: 1000000,
    release_date: "2026-06-30",
    architecture: "Transformer",
    status: "active",
    is_api_available: true,
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.anthropic.com/news/claude-sonnet-5",
    modalities: ["text", "image"],
    capabilities: {
      vision: true,
      tool_use: true,
      adaptive_thinking: true,
      coding: true,
      reasoning: true,
      computer_use: true,
      streaming: true,
    },
  },
  "claude-fable-5": {
    name: "Claude Fable 5",
    description:
      "Anthropic's most capable generally available model for demanding reasoning, coding, and long-horizon agentic work. It is proprietary closed-weight software and cannot run locally as an open model. Anthropic included it for up to 50% of weekly usage limits on eligible subscriptions through July 7, 2026, with continued access through usage credits unless an allowance is extended. It is also available through the API. Flagged cyber or biology requests can route to Opus 4.8, and Fable use requires 30-day safety retention.",
    category: "multimodal",
    context_window: 1000000,
    release_date: "2026-06-09",
    architecture: "Transformer",
    status: "active",
    is_api_available: true,
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.anthropic.com/claude/fable",
    modalities: ["text", "image"],
    capabilities: {
      vision: true,
      tool_use: true,
      adaptive_thinking: true,
      coding: true,
      reasoning: true,
      computer_use: true,
      streaming: true,
      safety_routing: true,
      data_retention_required: true,
    },
  },
  "claude-mythos-5": {
    name: "Claude Mythos 5",
    description:
      "Anthropic's limited-availability successor to Mythos Preview, sharing Fable 5 capabilities without its safety classifiers. Access is restricted to approved Project Glasswing organizations.",
    category: "multimodal",
    context_window: 1000000,
    release_date: "2026-06-09",
    architecture: "Transformer",
    status: "preview",
    is_api_available: true,
    is_open_weights: false,
    license: "commercial",
    license_name: null,
    website_url: "https://www.anthropic.com/news/claude-fable-5-mythos-5",
    modalities: ["text", "image"],
    capabilities: {
      vision: true,
      tool_use: true,
      adaptive_thinking: true,
      coding: true,
      reasoning: true,
      computer_use: true,
      streaming: true,
    },
  },

  // ---- Claude 4.8 series ----
  "claude-opus-4-8": {
    name: "Claude Opus 4.8",
    description:
      "Previous generally available Opus release retained for compatibility after Claude Opus 5. It remains strong for complex reasoning, long-horizon agentic coding, high-autonomy work, and computer-use workflows.",
    context_window: 1000000,
    release_date: "2026-05-28",
    architecture: "Transformer",
    status: "active",
    website_url: "https://www.anthropic.com/news/claude-opus-4-8",
    capabilities: {
      vision: true,
      tool_use: true,
      adaptive_thinking: true,
      coding: true,
      reasoning: true,
      computer_use: true,
      streaming: true,
    },
  },

  // ---- Claude 4.7 series ----
  "claude-opus-4-7": {
    name: "Claude Opus 4.7",
    description:
      "Previous generally available Opus release retained for compatibility. Still strong for advanced software engineering, long-running task reliability, self-verification, and high-resolution vision, but superseded by Claude Opus 5 for Anthropic's latest Opus-tier performance.",
    context_window: 1000000,
    release_date: "2026-04-16",
    architecture: "Transformer",
    status: "active",
    website_url: "https://www.anthropic.com/news/claude-opus-4-7",
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

  // ---- Claude 4.6 series ----
  "claude-opus-4-6": {
    name: "Claude Opus 4.6",
    description:
      "Previous flagship Claude Opus release retained for compatibility after later Claude Opus launches. Still strong for advanced reasoning, extended thinking, computer use, and coding, but superseded by Claude Opus 5 for Anthropic's latest Opus-tier performance.",
    context_window: 1000000,
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
    context_window: 1000000,
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
      "Previous Opus-tier flagship retained for compatibility after newer Claude Opus releases. Still strong on deep reasoning, extended thinking, and advanced coding, but superseded by Claude Opus 5 for Anthropic's latest Opus-tier performance.",
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
      "Previous Claude 4 flagship retained for compatibility after later Claude Opus releases. Delivers strong reasoning and multi-step problem solving, but superseded by Claude Opus 5 for Anthropic's latest Opus-tier performance.",
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
  "claude-opus-4-1": {
    name: "Claude Opus 4.1",
    description:
      "Previous Claude Opus 4.1 release retained for compatibility after later Opus upgrades. Still strong for reasoning, coding, and agentic tasks, but superseded by Claude Opus 5 for Anthropic's latest Opus-tier capability.",
    context_window: 200000,
    release_date: "2025-08-05",
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

export function canonicalizeAnthropicModelId(modelId: string): string {
  const candidates = new Set<string>([
    modelId,
    modelId.replace(/-v\d+$/, ""),
    modelId.replace(/-\d{8}(?:-v\d+)?$/, ""),
    modelId.replace(/-(202\d{5})(?:-v\d+)?$/, ""),
  ]);

  const familyAliasMatches: Array<[RegExp, string]> = [
    [/^claude-opus-latest$/, "claude-opus-5"],
    [/^claude-opus-5(?:-\d{8})?(?:-v\d+)?$/, "claude-opus-5"],
    [/^claude-5-opus(?:-\d{8})?(?:-v\d+)?$/, "claude-opus-5"],
    [/^claude-sonnet-5(?:-\d{8})?(?:-v\d+)?$/, "claude-sonnet-5"],
    [/^claude-fable-latest$/, "claude-fable-5"],
    [/^claude-fable-5(?:-\d{8})?(?:-v\d+)?$/, "claude-fable-5"],
    [/^claude-mythos-latest$/, "claude-mythos-5"],
    [/^claude-mythos-5(?:-\d{8})?(?:-v\d+)?$/, "claude-mythos-5"],
    [/^claude-opus-4-8(?:-\d{8})?(?:-v\d+)?$/, "claude-opus-4-8"],
    [/^claude-opus-48(?:-\d{8})?(?:-v\d+)?$/, "claude-opus-4-8"],
    [/^claude-4-8(?:-\d{8})?(?:-v\d+)?$/, "claude-opus-4-8"],
    [/^claude-48(?:-\d{8})?(?:-v\d+)?$/, "claude-opus-4-8"],
    [/^claude-opus-4-7(?:-\d{8})?(?:-v\d+)?$/, "claude-opus-4-7"],
    [/^claude-opus-47(?:-\d{8})?(?:-v\d+)?$/, "claude-opus-4-7"],
    [/^claude-4-7(?:-\d{8})?(?:-v\d+)?$/, "claude-opus-4-7"],
    [/^claude-47(?:-\d{8})?(?:-v\d+)?$/, "claude-opus-4-7"],
    [/^claude-opus-4-1(?:-\d{8})?(?:-v\d+)?$/, "claude-opus-4-1"],
    [/^claude-(opus|sonnet|haiku)-4-5(?:-v\d+)?$/, "claude-4-5-$1"],
    [/^claude-(opus|sonnet)-4-6(?:-v\d+)?$/, "claude-$1-4-6"],
    [/^claude-(opus|sonnet)-46(?:-v\d+)?$/, "claude-$1-4-6"],
    [/^claude-(opus|sonnet)-4(?:-0)?$/, "claude-4-$1"],
    [/^claude-(opus|sonnet|haiku)-4-5-(\d{8})(?:-v\d+)?$/, "claude-4-5-$1"],
    [/^claude-(opus|sonnet)-4-(\d{8})(?:-v\d+)?$/, "claude-4-$1"],
  ];

  for (const [pattern, replacement] of familyAliasMatches) {
    if (pattern.test(modelId)) {
      candidates.add(modelId.replace(pattern, replacement));
    }
  }

  for (const candidate of candidates) {
    if (candidate && ANTHROPIC_KNOWN_MODELS[candidate]) {
      return candidate;
    }
  }

  return modelId;
}

export function resolveAnthropicKnownModelMeta(
  modelId: string
): KnownModelMeta | undefined {
  return ANTHROPIC_KNOWN_MODELS[canonicalizeAnthropicModelId(modelId)];
}
