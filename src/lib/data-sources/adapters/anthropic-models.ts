/**
 * Anthropic Models Adapter (Live API)
 *
 * Fetches the model catalog from the Anthropic /v1/models API endpoint.
 * Requires ANTHROPIC_API_KEY to be configured — no static fallback.
 */

import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  SyncError,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import { fetchWithRetry, upsertBatch, makeSlug } from "../utils";

// --------------- Anthropic API Types ---------------

interface AnthropicModelEntry {
  id: string;
  type: string;
  display_name: string;
  created_at: string;
}

interface AnthropicModelsResponse {
  data: AnthropicModelEntry[];
  has_more: boolean;
  first_id: string;
  last_id: string;
}

// --------------- Helpers ---------------

const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1";

/** Build a model record from an Anthropic API model entry. */
function buildRecord(entry: AnthropicModelEntry): Record<string, unknown> {
  const slug = makeSlug(`anthropic-${entry.id}`);

  return {
    slug,
    name: entry.display_name || entry.id,
    provider: "Anthropic",
    category: "llm",
    status: "active",
    description: null,
    architecture: "transformer",
    parameter_count: null,
    context_window: null,
    release_date: entry.created_at ? entry.created_at.split("T")[0] : null,
    is_api_available: true,
    is_open_weights: false,
    license: "commercial",
    modalities: ["text", "image"],
    capabilities: {
      chat: true,
      function_calling: true,
      vision: true,
      streaming: true,
    },
    data_refreshed_at: new Date().toISOString(),
  };
}

// --------------- Adapter ---------------

const adapter: DataSourceAdapter = {
  id: "anthropic-models",
  name: "Anthropic Models",
  outputTypes: ["models"],
  defaultConfig: {},
  requiredSecrets: ["ANTHROPIC_API_KEY"],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const errors: SyncError[] = [];
    const apiKey = ctx.secrets.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "ANTHROPIC_API_KEY not configured" }],
      };
    }

    // Fetch all models with pagination
    const allModels: AnthropicModelEntry[] = [];
    let afterId: string | undefined;
    let hasMore = true;

    try {
      while (hasMore) {
        const url = new URL(`${ANTHROPIC_API_BASE}/models`);
        url.searchParams.set("limit", "100");
        if (afterId) {
          url.searchParams.set("after_id", afterId);
        }

        const res = await fetchWithRetry(
          url.toString(),
          {
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            signal: ctx.signal,
          },
          { signal: ctx.signal }
        );

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return {
            success: false,
            recordsProcessed: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            errors: [
              {
                message: `Anthropic API returned ${res.status}: ${body.slice(0, 200)}`,
              },
            ],
          };
        }

        const json: AnthropicModelsResponse = await res.json();
        const models = json.data ?? [];
        allModels.push(...models);

        hasMore = json.has_more === true;
        if (hasMore && json.last_id) {
          afterId = json.last_id;
        } else {
          hasMore = false;
        }
      }
    } catch (err) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          {
            message: `Failed to fetch Anthropic models: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }

    // Filter to only Claude models
    const claudeModels = allModels.filter((m) =>
      m.id.toLowerCase().includes("claude")
    );

    // Build records
    const records = claudeModels.map(buildRecord);

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
      recordsProcessed: claudeModels.length,
      recordsCreated: created,
      recordsUpdated: 0,
      errors,
      metadata: {
        source: "anthropic_api",
        totalFromApi: allModels.length,
        claudeModelsCount: claudeModels.length,
      },
    };
  },

  async healthCheck(
    secrets: Record<string, string>
  ): Promise<HealthCheckResult> {
    const apiKey = secrets.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        healthy: false,
        latencyMs: 0,
        message: "ANTHROPIC_API_KEY not configured",
      };
    }

    const start = Date.now();
    try {
      const res = await fetchWithRetry(
        `${ANTHROPIC_API_BASE}/models?limit=1`,
        {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
        },
        { maxRetries: 1 }
      );

      const latencyMs = Date.now() - start;

      if (res.ok) {
        return {
          healthy: true,
          latencyMs,
          message: "Anthropic /v1/models API reachable",
        };
      }

      return {
        healthy: false,
        latencyMs,
        message: `Anthropic API returned HTTP ${res.status}`,
      };
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
