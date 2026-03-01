/**
 * Google AI Models Adapter
 *
 * Data sourcing strategy (highest to lowest priority):
 *   1. Live Google Generative Language API — if GOOGLE_AI_API_KEY is present in ctx.secrets
 *   2. Public HTML scrape — https://ai.google.dev/gemini-api/docs/models/gemini
 *   3. KNOWN_MODELS static map — always available, guarantees at least one sync
 *
 * No API key is required. The static map alone is sufficient to produce a
 * complete, meaningful sync of all current Google AI models.
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
  category: string;
  context_window: number | null;
  release_date: string;
  architecture: string;
  status: string;
  modalities: string[];
  capabilities: Record<string, boolean>;
  is_open_weights: boolean;
  license: string;
  license_name: string | null;
}

/**
 * Comprehensive static map of all current Google AI models.
 * This is the primary data source when no API key is available.
 */
const KNOWN_MODELS: Record<string, KnownModelMeta> = {
  // ---- Gemini 3 series ----
  "gemini-3-pro": {
    name: "Gemini 3 Pro",
    description:
      "Google's third-generation flagship multimodal model with a 1 million token context window. Delivers state-of-the-art performance across reasoning, coding, and long-context understanding.",
    category: "multimodal",
    context_window: 1000000,
    release_date: "2025-11-18",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      grounding: true,
      code_execution: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },
  "gemini-3-flash": {
    name: "Gemini 3 Flash",
    description:
      "Fast, cost-efficient third-generation Gemini model with a 1 million token context window. Optimised for high-throughput applications requiring real-time multimodal responses.",
    category: "multimodal",
    context_window: 1000000,
    release_date: "2025-11-18",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      grounding: true,
      code_execution: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },

  // ---- Gemini 2.5 series ----
  "gemini-2.5-pro": {
    name: "Gemini 2.5 Pro",
    description:
      "Google's most capable Gemini 2.5 model with a 1 million token context window and deep thinking mode. Achieves top performance on coding, math, and science benchmarks.",
    category: "multimodal",
    context_window: 1000000,
    release_date: "2025-03-25",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      grounding: true,
      code_execution: true,
      function_calling: true,
      extended_thinking: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },
  "gemini-2.5-flash": {
    name: "Gemini 2.5 Flash",
    description:
      "Efficient Gemini 2.5 model combining fast inference with a 1 million token context. Features thinking mode for improved accuracy on complex tasks at lower cost than Pro.",
    category: "multimodal",
    context_window: 1000000,
    release_date: "2025-05-20",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      grounding: true,
      code_execution: true,
      function_calling: true,
      extended_thinking: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },

  // ---- Gemini 2.0 series ----
  "gemini-2.0-flash": {
    name: "Gemini 2.0 Flash",
    description:
      "Next-generation Flash model with native tool use, multimodal live API, and a 1 million token context. Delivers Gemini 1.5 Pro quality at Flash speed and cost.",
    category: "multimodal",
    context_window: 1048576,
    release_date: "2025-02-05",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      grounding: true,
      code_execution: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },
  "gemini-2.0-flash-lite": {
    name: "Gemini 2.0 Flash Lite",
    description:
      "Ultra-lightweight variant of Gemini 2.0 Flash designed for cost-sensitive, high-volume workloads. Retains the 1 million token context window with minimal inference cost.",
    category: "multimodal",
    context_window: 1048576,
    release_date: "2025-02-05",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },

  // ---- Gemini 1.5 series ----
  "gemini-1.5-pro": {
    name: "Gemini 1.5 Pro",
    description:
      "Mid-size multimodal model with an industry-leading 2 million token context window using Mixture-of-Experts architecture. Excels at long-document analysis and complex reasoning.",
    category: "multimodal",
    context_window: 2097152,
    release_date: "2024-05-15",
    architecture: "Transformer (MoE)",
    status: "active",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      grounding: true,
      code_execution: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },
  "gemini-1.5-flash": {
    name: "Gemini 1.5 Flash",
    description:
      "Fast, versatile model with a 1 million token context window. Designed for high-frequency tasks requiring broad multimodal capability at accessible cost.",
    category: "multimodal",
    context_window: 1048576,
    release_date: "2024-05-15",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image", "audio", "video"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      grounding: true,
      code_execution: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },

  // ---- Gemma open models ----
  "gemma-3": {
    name: "Gemma 3",
    description:
      "Google's third-generation open-weights language model family. Available in multiple sizes, suitable for on-device inference, fine-tuning, and research.",
    category: "llm",
    context_window: 128000,
    release_date: "2025-03-12",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      coding: true,
      function_calling: true,
      streaming: true,
    },
    is_open_weights: true,
    license: "open_source",
    license_name: "Apache 2.0",
  },
  "gemma-2": {
    name: "Gemma 2",
    description:
      "Second-generation open-weights model from Google. Offers competitive performance in a compact form factor; available in 2B, 9B, and 27B parameter variants.",
    category: "llm",
    context_window: 8192,
    release_date: "2024-06-27",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      coding: true,
      streaming: true,
    },
    is_open_weights: true,
    license: "open_source",
    license_name: "Apache 2.0",
  },

  // ---- Image generation ----
  "imagen-3": {
    name: "Imagen 3",
    description:
      "Google's highest-quality text-to-image model. Produces photorealistic images with exceptional detail, lighting accuracy, and minimal artifacts.",
    category: "image_generation",
    context_window: null,
    release_date: "2024-08-01",
    architecture: "Diffusion",
    status: "active",
    modalities: ["text", "image"],
    capabilities: { image_generation: true, image_editing: true },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },

  // ---- Video generation ----
  "veo-2": {
    name: "Veo 2",
    description:
      "Google's advanced video generation model capable of producing high-definition video clips from text and image prompts with improved physics understanding and motion coherence.",
    category: "video",
    context_window: null,
    release_date: "2024-12-01",
    architecture: "Diffusion (Video)",
    status: "active",
    modalities: ["text", "image", "video"],
    capabilities: { video_generation: true },
    is_open_weights: false,
    license: "commercial",
    license_name: null,
  },
};

// ---------------------------------------------------------------------------
// Inference helpers (for API/scrape models not in KNOWN_MODELS)
// ---------------------------------------------------------------------------

/** Infer model category from its ID when not in KNOWN_MODELS. */
function inferCategory(modelId: string): string {
  const id = modelId.toLowerCase();
  if (id.startsWith("gemini")) return "multimodal";
  if (id.startsWith("gemma")) return "llm";
  if (id.startsWith("imagen")) return "image_generation";
  if (id.startsWith("veo")) return "video";
  if (id.includes("embedding")) return "embeddings";
  return "specialized";
}

/** Infer modalities from model ID when not in KNOWN_MODELS. */
function inferModalities(modelId: string): string[] {
  const id = modelId.toLowerCase();
  if (id.startsWith("gemini")) return ["text", "image", "audio", "video"];
  if (id.startsWith("gemma")) return ["text"];
  if (id.startsWith("imagen")) return ["text", "image"];
  if (id.startsWith("veo")) return ["text", "image", "video"];
  if (id.includes("embedding")) return ["text"];
  return ["text"];
}

// ---------------------------------------------------------------------------
// Record builder
// ---------------------------------------------------------------------------

/**
 * Build a complete model record for the `models` table.
 * KNOWN_MODELS fields take precedence over any computed defaults.
 */
function buildRecord(
  modelId: string,
  overrides: Partial<KnownModelMeta> = {}
): Record<string, unknown> {
  const known = KNOWN_MODELS[modelId];
  const merged = { ...known, ...overrides };

  return {
    slug: makeSlug(`google-${modelId}`),
    name: merged?.name ?? modelId,
    provider: "Google",
    category: merged?.category ?? inferCategory(modelId),
    status: merged?.status ?? "active",
    description: merged?.description ?? null,
    architecture: merged?.architecture ?? "Transformer",
    parameter_count: null, // Google does not publicly disclose parameter counts
    context_window: merged?.context_window ?? null,
    release_date: merged?.release_date ?? null,
    is_api_available: true,
    is_open_weights: merged?.is_open_weights ?? false,
    license: merged?.license ?? "commercial",
    license_name: merged?.license_name ?? null,
    modalities: merged?.modalities ?? inferModalities(modelId),
    capabilities: merged?.capabilities ?? {},
    data_refreshed_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Optional: live API fetch
// ---------------------------------------------------------------------------

interface GoogleModelEntry {
  name: string;           // e.g. "models/gemini-2.0-flash"
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: string[];
}

interface GoogleModelsResponse {
  models: GoogleModelEntry[];
  nextPageToken?: string;
}

const GOOGLE_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Extract the short model ID from "models/gemini-2.0-flash" -> "gemini-2.0-flash". */
function extractModelId(name: string): string {
  return name.replace(/^models\//, "");
}

/**
 * Attempt to fetch the live model list from the Google Generative Language API.
 * Returns null on any failure so the caller can fall back gracefully.
 */
async function tryFetchLiveApi(
  apiKey: string,
  signal?: AbortSignal
): Promise<Map<string, { displayName: string; description: string; contextWindow: number | null }> | null> {
  const result = new Map<string, { displayName: string; description: string; contextWindow: number | null }>();
  let pageToken: string | undefined;

  try {
    do {
      const url = new URL(`${GOOGLE_API_BASE}/models`);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("pageSize", "50");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetchWithRetry(
        url.toString(),
        { signal },
        { maxRetries: 2, signal }
      );

      if (!res.ok) return null;

      const json: GoogleModelsResponse = await res.json();
      for (const entry of json.models ?? []) {
        const modelId = extractModelId(entry.name);
        result.set(modelId, {
          displayName: entry.displayName,
          description: entry.description,
          contextWindow: entry.inputTokenLimit || null,
        });
      }

      pageToken = json.nextPageToken;
    } while (pageToken);

    return result;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Optional: public HTML scrape
// ---------------------------------------------------------------------------

/**
 * Try to scrape the Google Gemini API docs page for model IDs.
 * Returns an empty array on failure.
 */
async function tryScrapeDocsPage(signal?: AbortSignal): Promise<string[]> {
  try {
    const res = await fetchWithRetry(
      "https://ai.google.dev/gemini-api/docs/models/gemini",
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ModelIndexBot/1.0)" },
        signal,
      },
      { maxRetries: 1, signal }
    );
    if (!res.ok) return [];

    const html = await res.text();

    // Match Gemini/Gemma/Imagen/Veo model IDs
    const modelPattern =
      /\b(gemini-[\d.]+(?:-(?:pro|flash|ultra|nano|lite|exp|preview)(?:-[\w.]+)?)?|gemma-\d[\w.-]*|imagen-\d[\w.-]*|veo-\d[\w.-]*)\b/g;

    const found = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = modelPattern.exec(html)) !== null) {
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
  id: "google-models",
  name: "Google AI Models",
  outputTypes: ["models"],
  defaultConfig: {},

  // No API key required — static data guarantees a successful sync.
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const now = new Date().toISOString();
    const apiKey = ctx.secrets.GOOGLE_AI_API_KEY;

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
    let apiModels: Map<string, { displayName: string; description: string; contextWindow: number | null }> | null = null;
    if (apiKey) {
      apiModels = await tryFetchLiveApi(apiKey, ctx.signal);
      if (apiModels) {
        sources.push("google_api");
        for (const [modelId, meta] of apiModels) {
          if (!recordMap.has(modelId)) {
            // New model from API — create a minimal record enriched by API data
            recordMap.set(
              modelId,
              buildRecord(modelId, {
                name: meta.displayName || undefined,
                description: meta.description || undefined,
                context_window: meta.contextWindow ?? undefined,
              } as Partial<KnownModelMeta>)
            );
          } else {
            // For known models, the API may provide a fresher context window value
            const existing = recordMap.get(modelId);
            if (existing && meta.contextWindow && !existing.context_window) {
              existing.context_window = meta.contextWindow;
            }
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
    const apiKey = secrets.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      return {
        healthy: true,
        latencyMs: 0,
        message: `Static-only mode — ${Object.keys(KNOWN_MODELS).length} Google AI models available without API key`,
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
      return res.ok
        ? { healthy: true, latencyMs, message: "Google Generative Language API reachable" }
        : { healthy: false, latencyMs, message: `Google AI API returned HTTP ${res.status}` };
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
