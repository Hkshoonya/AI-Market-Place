/**
 * Anthropic Models Adapter (Static Catalog)
 *
 * Anthropic does not expose a public model-listing API, so this adapter
 * maintains a hardcoded catalog of known Claude models and upserts them
 * into the models table on each sync.
 */

import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  SyncError,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { upsertBatch } from "../utils";

// --------------- Static Catalog ---------------

interface ClaudeModelEntry {
  slug: string;
  name: string;
  description: string;
  short_description: string;
  parameter_count: number | null;
  context_window: number;
  release_date: string;
  status: string;
  architecture: string;
  modalities: string[];
  capabilities: Record<string, boolean>;
}

const CLAUDE_MODELS: ClaudeModelEntry[] = [
  {
    slug: "anthropic-claude-4-opus",
    name: "Claude 4 Opus",
    description:
      "Anthropic's most powerful model with exceptional reasoning, analysis, and creative capabilities. Excels at complex, multi-step tasks requiring deep understanding.",
    short_description:
      "Most powerful Claude model for complex reasoning tasks.",
    parameter_count: 2000000000000, // ~2T estimated
    context_window: 200000,
    release_date: "2025-03-01",
    status: "active",
    architecture: "transformer",
    modalities: ["text", "image"],
    capabilities: {
      chat: true,
      reasoning: true,
      function_calling: true,
      vision: true,
      coding: true,
      analysis: true,
      streaming: true,
    },
  },
  {
    slug: "anthropic-claude-4-sonnet",
    name: "Claude 4 Sonnet",
    description:
      "Balanced model offering strong performance with faster response times and lower cost than Opus. Ideal for most production workloads.",
    short_description:
      "Balanced Claude model for everyday production use.",
    parameter_count: 70000000000, // ~70B estimated
    context_window: 200000,
    release_date: "2025-05-01",
    status: "active",
    architecture: "transformer",
    modalities: ["text", "image"],
    capabilities: {
      chat: true,
      reasoning: true,
      function_calling: true,
      vision: true,
      coding: true,
      analysis: true,
      streaming: true,
    },
  },
  {
    slug: "anthropic-claude-3-5-haiku",
    name: "Claude 3.5 Haiku",
    description:
      "Fast, compact model optimized for near-instant responsiveness. Best for high-throughput tasks and simple queries.",
    short_description:
      "Fastest Claude model for high-throughput tasks.",
    parameter_count: 20000000000, // ~20B estimated
    context_window: 200000,
    release_date: "2024-10-01",
    status: "active",
    architecture: "transformer",
    modalities: ["text", "image"],
    capabilities: {
      chat: true,
      function_calling: true,
      vision: true,
      coding: true,
      streaming: true,
    },
  },
  {
    slug: "anthropic-claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    description:
      "Enhanced mid-tier model with significantly improved coding, reasoning, and vision capabilities over Claude 3 Sonnet.",
    short_description:
      "Upgraded Sonnet with strong coding and reasoning.",
    parameter_count: 70000000000, // ~70B estimated
    context_window: 200000,
    release_date: "2024-06-20",
    status: "active",
    architecture: "transformer",
    modalities: ["text", "image"],
    capabilities: {
      chat: true,
      reasoning: true,
      function_calling: true,
      vision: true,
      coding: true,
      analysis: true,
      streaming: true,
    },
  },
  {
    slug: "anthropic-claude-3-opus",
    name: "Claude 3 Opus",
    description:
      "Previous generation flagship with top-tier intelligence for complex tasks requiring deep analysis and nuanced understanding.",
    short_description:
      "Previous-gen flagship for complex analysis.",
    parameter_count: 137000000000, // ~137B estimated
    context_window: 200000,
    release_date: "2024-03-04",
    status: "active",
    architecture: "transformer",
    modalities: ["text", "image"],
    capabilities: {
      chat: true,
      reasoning: true,
      function_calling: true,
      vision: true,
      coding: true,
      analysis: true,
      streaming: true,
    },
  },
  {
    slug: "anthropic-claude-3-sonnet",
    name: "Claude 3 Sonnet",
    description:
      "Balanced performance and speed for enterprise workloads. Strong at analysis, forecasting, and content generation.",
    short_description:
      "Balanced enterprise model for varied workloads.",
    parameter_count: 70000000000, // ~70B estimated
    context_window: 200000,
    release_date: "2024-03-04",
    status: "active",
    architecture: "transformer",
    modalities: ["text", "image"],
    capabilities: {
      chat: true,
      function_calling: true,
      vision: true,
      coding: true,
      streaming: true,
    },
  },
  {
    slug: "anthropic-claude-3-haiku",
    name: "Claude 3 Haiku",
    description:
      "Fastest and most compact model in the Claude 3 family. Designed for quick, lightweight interactions at scale.",
    short_description:
      "Fastest Claude 3 model for lightweight tasks.",
    parameter_count: 20000000000, // ~20B estimated
    context_window: 200000,
    release_date: "2024-03-14",
    status: "active",
    architecture: "transformer",
    modalities: ["text", "image"],
    capabilities: {
      chat: true,
      function_calling: true,
      vision: true,
      streaming: true,
    },
  },
];

// --------------- Adapter ---------------

const adapter: DataSourceAdapter = {
  id: "anthropic-models",
  name: "Anthropic Models",
  outputTypes: ["models"],
  defaultConfig: {},
  /** No API key needed — this is a static catalog. */
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const errors: SyncError[] = [];
    const now = new Date().toISOString();

    // Build records from the static catalog
    const records: Record<string, unknown>[] = CLAUDE_MODELS.map((model) => ({
      slug: model.slug,
      name: model.name,
      provider: "Anthropic",
      category: "llm",
      status: model.status,
      description: model.description,
      short_description: model.short_description,
      architecture: model.architecture,
      parameter_count: model.parameter_count,
      context_window: model.context_window,
      release_date: model.release_date,
      is_api_available: true,
      is_open_weights: false,
      license: "commercial",
      modalities: model.modalities,
      capabilities: model.capabilities,
      data_refreshed_at: now,
    }));

    // Upsert into the models table
    const { created, errors: upsertErrors } = await upsertBatch(
      ctx.supabase,
      "models",
      records,
      "slug"
    );
    errors.push(...upsertErrors);

    return {
      success: errors.length === 0,
      recordsProcessed: CLAUDE_MODELS.length,
      recordsCreated: created,
      recordsUpdated: 0,
      errors,
      metadata: {
        catalogSize: CLAUDE_MODELS.length,
        source: "static_catalog",
      },
    };
  },

  async healthCheck(): Promise<HealthCheckResult> {
    // Static catalog is always healthy — no external dependency.
    return {
      healthy: true,
      latencyMs: 0,
      message: "Static catalog adapter — always healthy",
    };
  },
};

registerAdapter(adapter);
export default adapter;
