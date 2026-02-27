/**
 * Google AI Models Adapter
 *
 * Fetches model catalog from the Google Generative Language API
 * (GET /v1beta/models). Falls back to a static catalog when no
 * API key is configured.
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

// --------------- Static Fallback Catalog ---------------

interface StaticGoogleModel {
  slug: string;
  name: string;
  modelId: string;
  description: string;
  short_description: string;
  category: string;
  parameter_count: number | null;
  context_window: number;
  release_date: string;
  status: string;
  architecture: string;
  modalities: string[];
  capabilities: Record<string, boolean>;
}

const STATIC_GOOGLE_MODELS: StaticGoogleModel[] = [
  {
    slug: "google-gemini-2-5-pro",
    name: "Gemini 2.5 Pro",
    modelId: "gemini-2.5-pro",
    description:
      "Google's most capable thinking model with advanced reasoning, coding, math, and science capabilities.",
    short_description:
      "Most capable Gemini model with advanced reasoning.",
    category: "multimodal",
    parameter_count: null,
    context_window: 1048576,
    release_date: "2025-03-25",
    status: "active",
    architecture: "transformer",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      chat: true,
      reasoning: true,
      function_calling: true,
      vision: true,
      coding: true,
      streaming: true,
    },
  },
  {
    slug: "google-gemini-2-5-flash",
    name: "Gemini 2.5 Flash",
    modelId: "gemini-2.5-flash",
    description:
      "Fast, efficient thinking model with strong adaptive reasoning and cost efficiency.",
    short_description:
      "Fast thinking model with adaptive reasoning.",
    category: "multimodal",
    parameter_count: null,
    context_window: 1048576,
    release_date: "2025-04-17",
    status: "active",
    architecture: "transformer",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      chat: true,
      reasoning: true,
      function_calling: true,
      vision: true,
      coding: true,
      streaming: true,
    },
  },
  {
    slug: "google-gemini-2-0-flash",
    name: "Gemini 2.0 Flash",
    modelId: "gemini-2.0-flash",
    description:
      "Next-generation features with superior speed, native tool use, and multimodal generation.",
    short_description:
      "Fast Gemini 2.0 model with native tool use.",
    category: "multimodal",
    parameter_count: null,
    context_window: 1048576,
    release_date: "2025-02-05",
    status: "active",
    architecture: "transformer",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      chat: true,
      function_calling: true,
      vision: true,
      coding: true,
      streaming: true,
    },
  },
  {
    slug: "google-gemini-1-5-pro",
    name: "Gemini 1.5 Pro",
    modelId: "gemini-1.5-pro",
    description:
      "Mid-size multimodal model optimized for a wide range of reasoning tasks. Features a breakthrough 2M-token context window.",
    short_description:
      "Versatile model with 2M-token context window.",
    category: "multimodal",
    parameter_count: null,
    context_window: 2097152,
    release_date: "2024-02-15",
    status: "active",
    architecture: "transformer-moe",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      chat: true,
      function_calling: true,
      vision: true,
      coding: true,
      streaming: true,
    },
  },
  {
    slug: "google-gemini-1-5-flash",
    name: "Gemini 1.5 Flash",
    modelId: "gemini-1.5-flash",
    description:
      "Fast and versatile multimodal model for scaling across diverse tasks. Optimized for speed and efficiency.",
    short_description:
      "Fast multimodal model for scalable workloads.",
    category: "multimodal",
    parameter_count: null,
    context_window: 1048576,
    release_date: "2024-05-24",
    status: "active",
    architecture: "transformer-moe",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      chat: true,
      function_calling: true,
      vision: true,
      coding: true,
      streaming: true,
    },
  },
  {
    slug: "google-gemini-1-5-flash-8b",
    name: "Gemini 1.5 Flash-8B",
    modelId: "gemini-1.5-flash-8b",
    description:
      "Smallest Gemini model optimized for lower intelligence tasks. High volume and lower cost.",
    short_description:
      "Compact Gemini model for high-volume tasks.",
    category: "multimodal",
    parameter_count: 8000000000, // 8B
    context_window: 1048576,
    release_date: "2024-10-03",
    status: "active",
    architecture: "transformer",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      chat: true,
      function_calling: true,
      vision: true,
      streaming: true,
    },
  },
  {
    slug: "google-text-embedding-004",
    name: "Text Embedding 004",
    modelId: "text-embedding-004",
    description:
      "Google's text embedding model for generating high-quality vector representations of text.",
    short_description:
      "High-quality text embeddings model.",
    category: "embeddings",
    parameter_count: null,
    context_window: 2048,
    release_date: "2024-03-14",
    status: "active",
    architecture: "transformer",
    modalities: ["text"],
    capabilities: { embeddings: true },
  },
  {
    slug: "google-embedding-001",
    name: "Embedding 001",
    modelId: "embedding-001",
    description:
      "General-purpose embedding model by Google for retrieval, classification, and clustering tasks.",
    short_description:
      "General-purpose Google embedding model.",
    category: "embeddings",
    parameter_count: null,
    context_window: 2048,
    release_date: "2023-12-13",
    status: "active",
    architecture: "transformer",
    modalities: ["text"],
    capabilities: { embeddings: true },
  },
];

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

/** Build a model record from the static fallback catalog. */
function buildRecordFromStatic(
  model: StaticGoogleModel
): Record<string, unknown> {
  return {
    slug: model.slug,
    name: model.name,
    provider: "Google",
    category: model.category,
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
    data_refreshed_at: new Date().toISOString(),
  };
}

// --------------- Adapter ---------------

const adapter: DataSourceAdapter = {
  id: "google-models",
  name: "Google AI Models",
  outputTypes: ["models"],
  defaultConfig: {},
  /**
   * API key is optional. When provided, models are fetched live.
   * When absent, the static fallback catalog is used.
   */
  requiredSecrets: ["GOOGLE_AI_API_KEY"],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const errors: SyncError[] = [];
    const apiKey = ctx.secrets.GOOGLE_AI_API_KEY;

    let records: Record<string, unknown>[];
    let source: string;
    let totalFromApi = 0;

    if (apiKey) {
      // ---- Live API path ----
      try {
        const res = await fetchWithRetry(
          `${GOOGLE_API_BASE}/models?key=${apiKey}`,
          { signal: ctx.signal },
          { signal: ctx.signal }
        );

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          // Fall back to static catalog on API failure
          errors.push({
            message: `Google AI API returned ${res.status}: ${body.slice(0, 200)}. Falling back to static catalog.`,
          });
          records = STATIC_GOOGLE_MODELS.map(buildRecordFromStatic);
          source = "static_fallback_after_api_error";
        } else {
          const json: GoogleModelsResponse = await res.json();
          const apiModels = json.models ?? [];
          totalFromApi = apiModels.length;
          records = apiModels.map(buildRecordFromApi);
          source = "google_api";
        }
      } catch (err) {
        // Network error — fall back to static catalog
        errors.push({
          message: `Failed to fetch Google models: ${err instanceof Error ? err.message : String(err)}. Falling back to static catalog.`,
        });
        records = STATIC_GOOGLE_MODELS.map(buildRecordFromStatic);
        source = "static_fallback_after_network_error";
      }
    } else {
      // ---- No API key — use static catalog ----
      records = STATIC_GOOGLE_MODELS.map(buildRecordFromStatic);
      source = "static_catalog";
    }

    // ---- Upsert into DB ----
    const { created, errors: upsertErrors } = await upsertBatch(
      ctx.supabase,
      "models",
      records,
      "slug"
    );
    errors.push(...upsertErrors);

    return {
      success: upsertErrors.length === 0,
      recordsProcessed: records.length,
      recordsCreated: created,
      recordsUpdated: 0,
      errors,
      metadata: {
        source,
        totalFromApi,
        staticCatalogSize: STATIC_GOOGLE_MODELS.length,
        recordCount: records.length,
      },
    };
  },

  async healthCheck(
    secrets: Record<string, string>
  ): Promise<HealthCheckResult> {
    const apiKey = secrets.GOOGLE_AI_API_KEY;

    // If no API key, the adapter can still sync via static catalog
    if (!apiKey) {
      return {
        healthy: true,
        latencyMs: 0,
        message:
          "No GOOGLE_AI_API_KEY configured — will use static catalog fallback",
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
