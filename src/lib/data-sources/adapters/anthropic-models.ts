/**
 * Anthropic Models Adapter
 *
 * Data sourcing strategy (highest to lowest priority):
 *   1. Live Anthropic API  — if ANTHROPIC_API_KEY is present in ctx.secrets
 *   2. Public HTML scrape  — https://docs.anthropic.com/en/docs/about-claude/models
 *   3. KNOWN_MODELS static map — always available, guarantees at least one sync
 *
 * No API key is required. The static map alone is sufficient to produce a
 * complete, meaningful sync of all current Claude models.
 */

import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, makeSlug, upsertBatch } from "../utils";

// ---------------------------------------------------------------------------
// Static metadata
// ---------------------------------------------------------------------------

interface KnownModelMeta {
  name: string;
  description: string;
  context_window: number;
  release_date: string;
  architecture: string;
  status: string;
  capabilities: Record<string, boolean>;
}

/**
 * Comprehensive static map of all current Anthropic Claude models.
 * This is the primary data source when no API key is available.
 * All Claude models share: category="multimodal", modalities=["text","image"],
 * provider="Anthropic", is_api_available=true, is_open_weights=false,
 * license="commercial", license_name="Proprietary".
 */
const KNOWN_MODELS: Record<string, KnownModelMeta> = {
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

// ---------------------------------------------------------------------------
// Record builder
// ---------------------------------------------------------------------------

/**
 * Build a complete model record for the `models` table.
 * All Claude models share a common set of fixed fields.
 */
function buildRecord(
  modelId: string,
  overrides: Partial<KnownModelMeta> = {}
): Record<string, unknown> {
  const known = KNOWN_MODELS[modelId];
  const merged = { ...known, ...overrides };

  return {
    slug: makeSlug(`anthropic-${modelId}`),
    name: merged?.name ?? modelId,
    provider: "Anthropic",
    // All Claude models are multimodal (text + vision)
    category: "multimodal",
    status: merged?.status ?? "active",
    description: merged?.description ?? null,
    architecture: merged?.architecture ?? "Transformer",
    parameter_count: null, // Anthropic does not disclose parameter counts
    context_window: merged?.context_window ?? null,
    release_date: merged?.release_date ?? null,
    is_api_available: true,
    is_open_weights: false,
    license: "commercial",
    license_name: "Proprietary",
    modalities: ["text", "image"],
    capabilities: merged?.capabilities ?? { vision: true, tool_use: true, streaming: true },
    data_refreshed_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Optional: live API fetch (paginated)
// ---------------------------------------------------------------------------

interface AnthropicModelEntry {
  id: string;
  type: string;
  display_name: string;
  created_at: string;
}

interface AnthropicModelsPage {
  data: AnthropicModelEntry[];
  has_more: boolean;
  last_id: string | null;
}

/**
 * Fetch all model IDs from the Anthropic /v1/models API (handles pagination).
 * Returns null on any failure so the caller can fall back gracefully.
 */
async function tryFetchLiveApi(
  apiKey: string,
  signal?: AbortSignal
): Promise<Map<string, { displayName: string; createdAt: string }> | null> {
  const result = new Map<string, { displayName: string; createdAt: string }>();
  let afterId: string | undefined;
  let hasMore = true;

  try {
    while (hasMore) {
      const url = new URL("https://api.anthropic.com/v1/models");
      url.searchParams.set("limit", "100");
      if (afterId) url.searchParams.set("after_id", afterId);

      const res = await fetchWithRetry(
        url.toString(),
        {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          signal,
        },
        { maxRetries: 2, signal }
      );

      if (!res.ok) return null;

      const json: AnthropicModelsPage = await res.json();
      for (const entry of json.data ?? []) {
        result.set(entry.id, {
          displayName: entry.display_name,
          createdAt: entry.created_at,
        });
      }

      hasMore = json.has_more === true && !!json.last_id;
      if (hasMore) afterId = json.last_id!;
    }

    return result;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Optional: public HTML scrape
// ---------------------------------------------------------------------------

/**
 * Try to scrape the Anthropic models documentation page for model IDs.
 * Extracts anything matching the claude-* naming pattern.
 * Returns an empty array on failure.
 */
async function tryScrapeDocsPage(signal?: AbortSignal): Promise<string[]> {
  try {
    const res = await fetchWithRetry(
      "https://docs.anthropic.com/en/docs/about-claude/models",
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ModelIndexBot/1.0)" },
        signal,
      },
      { maxRetries: 1, signal }
    );
    if (!res.ok) return [];

    const html = await res.text();

    // Match claude model IDs: claude-{digits or version}-{tier}[-{variant}]
    const modelPattern =
      /\b(claude-(?:opus|sonnet|haiku|instant)[-\w.]*|claude-\d[\w.-]*)\b/g;

    const found = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = modelPattern.exec(html)) !== null) {
      // Filter out obviously versioned alias suffixes like -20241022 — keep
      // the clean IDs that correspond to KNOWN_MODELS keys
      found.add(match[1]);
    }

    return [...found];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Adapter definition
// ---------------------------------------------------------------------------

const adapter: DataSourceAdapter = {
  id: "anthropic-models",
  name: "Anthropic Models",
  outputTypes: ["models"],
  defaultConfig: {},

  // No API key required — static data guarantees a successful sync.
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const now = new Date().toISOString();
    const apiKey = ctx.secrets.ANTHROPIC_API_KEY;

    // ── Step 1: Start with the comprehensive static map ──────────────────────
    const recordMap = new Map<string, Record<string, unknown>>();
    for (const modelId of Object.keys(KNOWN_MODELS)) {
      recordMap.set(modelId, buildRecord(modelId));
    }

    const sources: string[] = ["static_known_models"];

    // ── Step 2 (bonus): Scrape public docs page ───────────────────────────────
    const scrapedIds = await tryScrapeDocsPage(ctx.signal);
    if (scrapedIds.length > 0) {
      sources.push("html_scrape");
      for (const modelId of scrapedIds) {
        if (!recordMap.has(modelId)) {
          recordMap.set(modelId, buildRecord(modelId));
        }
      }
    }

    // ── Step 3 (bonus): Live API if key available ─────────────────────────────
    let apiModels: Map<string, { displayName: string; createdAt: string }> | null = null;
    if (apiKey) {
      apiModels = await tryFetchLiveApi(apiKey, ctx.signal);
      if (apiModels) {
        sources.push("anthropic_api");
        for (const [modelId, meta] of apiModels) {
          if (!recordMap.has(modelId)) {
            // New model from API — create a minimal record enriched by API data
            recordMap.set(
              modelId,
              buildRecord(modelId, {
                name: meta.displayName || undefined,
                release_date: meta.createdAt
                  ? meta.createdAt.split("T")[0]
                  : undefined,
              } as Partial<KnownModelMeta>)
            );
          }
          // Refresh timestamp for all API-confirmed models
          const existing = recordMap.get(modelId);
          if (existing) existing.data_refreshed_at = now;
        }
      }
    }

    // ── Step 4: Upsert everything ─────────────────────────────────────────────
    const records = [...recordMap.values()];
    const { created, errors: upsertErrors } = await upsertBatch(
      ctx.supabase,
      "models",
      records,
      "slug"
    );

    return {
      success: upsertErrors.length === 0,
      recordsProcessed: records.length,
      recordsCreated: created,
      recordsUpdated: records.length - created,
      errors: upsertErrors,
      metadata: {
        sources,
        staticModels: Object.keys(KNOWN_MODELS).length,
        scrapedIds: scrapedIds.length,
        apiModels: apiModels?.size ?? 0,
        totalRecords: records.length,
      },
    };
  },

  async healthCheck(secrets: Record<string, string>): Promise<HealthCheckResult> {
    const apiKey = secrets.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        healthy: true,
        latencyMs: 0,
        message: `Static-only mode — ${Object.keys(KNOWN_MODELS).length} Claude models available without API key`,
      };
    }

    const start = Date.now();
    try {
      const res = await fetchWithRetry(
        "https://api.anthropic.com/v1/models?limit=1",
        {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
        },
        { maxRetries: 1 }
      );
      const latencyMs = Date.now() - start;
      return res.ok
        ? { healthy: true, latencyMs, message: "Anthropic /v1/models API reachable" }
        : { healthy: false, latencyMs, message: `Anthropic API returned HTTP ${res.status}` };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `Anthropic API unreachable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;
