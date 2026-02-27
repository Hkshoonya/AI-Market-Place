/**
 * Google AI Models Adapter (Live API Only)
 *
 * Fetches model catalog from the Google Generative Language API
 * (GET /v1beta/models). Requires GOOGLE_AI_API_KEY — no static fallback.
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

// --------------- Google API Types ---------------

interface GoogleModelEntry {
  name: string; // e.g. "models/gemini-1.5-flash"
  version: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: string[];
}

interface GoogleModelsResponse {
  models: GoogleModelEntry[];
}

// --------------- Helpers ---------------

const GOOGLE_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta";

/** Extract the short model ID from the API name field (e.g. "models/gemini-1.5-flash" -> "gemini-1.5-flash"). */
function extractModelId(name: string): string {
  return name.replace(/^models\//, "");
}

/** Categorize a Google model by its ID. */
function categorizeGoogleModel(modelId: string): string {
  const id = modelId.toLowerCase();
  if (id.startsWith("gemini")) return "multimodal";
  if (id.includes("embedding")) return "embeddings";
  if (id === "aqa") return "specialized";
  return "specialized";
}

/** Infer modalities from model category and supported methods. */
function inferModalities(
  category: string,
  methods: string[]
): string[] {
  if (category === "embeddings") return ["text"];
  // Gemini models support text + image + audio + video
  if (category === "multimodal") return ["text", "image", "audio", "video"];
  if (methods.includes("generateContent")) return ["text"];
  return ["text"];
}

/** Infer capabilities from supported generation methods. */
function inferCapabilities(
  methods: string[]
): Record<string, boolean> {
  const caps: Record<string, boolean> = {};
  if (methods.includes("generateContent")) {
    caps.chat = true;
    caps.streaming = true;
  }
  if (methods.includes("embedContent") || methods.includes("batchEmbedContents")) {
    caps.embeddings = true;
  }
  if (methods.includes("countTokens")) {
    caps.token_counting = true;
  }
  return caps;
}

/** Build a model record from a Google API model entry. */
function buildRecordFromApi(
  entry: GoogleModelEntry
): Record<string, unknown> {
  const modelId = extractModelId(entry.name);
  const slug = makeSlug(`google-${modelId}`);
  const category = categorizeGoogleModel(modelId);

  return {
    slug,
    name: entry.displayName || modelId,
    provider: "Google",
    category,
    status: "active",
    description: entry.description || null,
    architecture: "transformer",
    parameter_count: null,
    context_window: entry.inputTokenLimit || null,
    release_date: null,
    is_api_available: true,
    is_open_weights: false,
    license: "commercial",
    modalities: inferModalities(category, entry.supportedGenerationMethods),
    capabilities: inferCapabilities(entry.supportedGenerationMethods),
    data_refreshed_at: new Date().toISOString(),
  };
}

// --------------- Adapter ---------------

const adapter: DataSourceAdapter = {
  id: "google-models",
  name: "Google AI Models",
  outputTypes: ["models"],
  defaultConfig: {},
  requiredSecrets: ["GOOGLE_AI_API_KEY"],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const errors: SyncError[] = [];
    const apiKey = ctx.secrets.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "GOOGLE_AI_API_KEY not configured" }],
      };
    }

    let records: Record<string, unknown>[];
    let totalFromApi = 0;

    try {
      const res = await fetchWithRetry(
        `${GOOGLE_API_BASE}/models?key=${apiKey}`,
        { signal: ctx.signal },
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
              message: `Google AI API returned ${res.status}: ${body.slice(0, 200)}`,
            },
          ],
        };
      }

      const json: GoogleModelsResponse = await res.json();
      const apiModels = json.models ?? [];
      totalFromApi = apiModels.length;
      records = apiModels.map(buildRecordFromApi);
    } catch (err) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          {
            message: `Failed to fetch Google models: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }

    // Upsert into DB
    const { created, errors: upsertErrors } = await upsertBatch(
      ctx.supabase,
      "models",
      records,
      "slug"
    );
    errors.push(...upsertErrors);

    return {
      success: errors.length === 0,
      recordsProcessed: records.length,
      recordsCreated: created,
      recordsUpdated: 0,
      errors,
      metadata: {
        source: "google_api",
        totalFromApi,
        recordCount: records.length,
      },
    };
  },

  async healthCheck(
    secrets: Record<string, string>
  ): Promise<HealthCheckResult> {
    const apiKey = secrets.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      return {
        healthy: false,
        latencyMs: 0,
        message: "GOOGLE_AI_API_KEY not configured",
      };
    }

    const start = Date.now();
    try {
      const res = await fetchWithRetry(
        `${GOOGLE_API_BASE}/models?key=${apiKey}&pageSize=1`,
        {},
        { maxRetries: 1 }
      );

      const latencyMs = Date.now() - start;

      if (res.ok) {
        return {
          healthy: true,
          latencyMs,
          message: "Google Generative Language API reachable",
        };
      }

      return {
        healthy: false,
        latencyMs,
        message: `Google AI API returned HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `Google AI API unreachable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;
