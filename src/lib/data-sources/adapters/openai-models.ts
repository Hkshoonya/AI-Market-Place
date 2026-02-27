/**
 * OpenAI Models Adapter
 *
 * Fetches model catalog from the OpenAI API (GET /v1/models),
 * enriches minimal API data with a static KNOWN_MODELS metadata map,
 * and upserts into the models table.
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

// --------------- Static Metadata ---------------

interface KnownModelMeta {
  name: string;
  description: string;
  category: string;
  parameter_count: number | null;
  context_window: number | null;
  release_date: string | null;
  architecture: string | null;
  modalities: string[];
  capabilities: Record<string, boolean>;
  status: string;
}

/**
 * The OpenAI /v1/models endpoint returns only id, object, created, and owned_by.
 * This map enriches known models with parameter counts, context windows, etc.
 */
const KNOWN_MODELS: Record<string, KnownModelMeta> = {
  "gpt-4o": {
    name: "GPT-4o",
    description:
      "Multimodal flagship model with vision and audio capabilities. High intelligence with fast response times.",
    category: "llm",
    parameter_count: null, // OpenAI has not disclosed
    context_window: 128000,
    release_date: "2024-05-13",
    architecture: "transformer",
    modalities: ["text", "image", "audio"],
    capabilities: {
      chat: true,
      function_calling: true,
      vision: true,
      json_mode: true,
      streaming: true,
    },
    status: "active",
  },
  "gpt-4o-mini": {
    name: "GPT-4o Mini",
    description:
      "Small, fast, and affordable model for lightweight tasks. Optimized for cost efficiency.",
    category: "llm",
    parameter_count: null,
    context_window: 128000,
    release_date: "2024-07-18",
    architecture: "transformer",
    modalities: ["text", "image"],
    capabilities: {
      chat: true,
      function_calling: true,
      vision: true,
      json_mode: true,
      streaming: true,
    },
    status: "active",
  },
  "gpt-4-turbo": {
    name: "GPT-4 Turbo",
    description:
      "GPT-4 Turbo with Vision. High-intelligence model with 128K context and lower cost than GPT-4.",
    category: "llm",
    parameter_count: null,
    context_window: 128000,
    release_date: "2024-04-09",
    architecture: "transformer",
    modalities: ["text", "image"],
    capabilities: {
      chat: true,
      function_calling: true,
      vision: true,
      json_mode: true,
      streaming: true,
    },
    status: "active",
  },
  "gpt-4": {
    name: "GPT-4",
    description:
      "Large multimodal model capable of solving difficult problems with broad general knowledge.",
    category: "llm",
    parameter_count: 1760000000000, // estimated ~1.76T MoE
    context_window: 8192,
    release_date: "2023-03-14",
    architecture: "transformer",
    modalities: ["text"],
    capabilities: {
      chat: true,
      function_calling: true,
      json_mode: true,
      streaming: true,
    },
    status: "active",
  },
  o1: {
    name: "o1",
    description:
      "Reasoning model designed for complex multi-step tasks. Uses chain-of-thought reasoning before responding.",
    category: "llm",
    parameter_count: null,
    context_window: 200000,
    release_date: "2024-12-17",
    architecture: "transformer",
    modalities: ["text", "image"],
    capabilities: {
      chat: true,
      reasoning: true,
      function_calling: true,
      vision: true,
      streaming: true,
    },
    status: "active",
  },
  "o1-mini": {
    name: "o1-mini",
    description:
      "Faster, more affordable reasoning model optimized for coding and STEM tasks.",
    category: "llm",
    parameter_count: null,
    context_window: 128000,
    release_date: "2024-09-12",
    architecture: "transformer",
    modalities: ["text"],
    capabilities: {
      chat: true,
      reasoning: true,
      streaming: true,
    },
    status: "active",
  },
  "o3-mini": {
    name: "o3-mini",
    description:
      "Cost-efficient reasoning model with adjustable reasoning effort for STEM and coding tasks.",
    category: "llm",
    parameter_count: null,
    context_window: 200000,
    release_date: "2025-01-31",
    architecture: "transformer",
    modalities: ["text"],
    capabilities: {
      chat: true,
      reasoning: true,
      function_calling: true,
      streaming: true,
    },
    status: "active",
  },
  "dall-e-3": {
    name: "DALL-E 3",
    description:
      "State-of-the-art image generation model with high fidelity and prompt adherence.",
    category: "image_generation",
    parameter_count: null,
    context_window: null,
    release_date: "2023-10-01",
    architecture: "diffusion",
    modalities: ["text", "image"],
    capabilities: { image_generation: true },
    status: "active",
  },
  "dall-e-2": {
    name: "DALL-E 2",
    description:
      "Image generation model capable of creating realistic images and art from text descriptions.",
    category: "image_generation",
    parameter_count: 3500000000, // ~3.5B estimated
    context_window: null,
    release_date: "2022-04-06",
    architecture: "diffusion",
    modalities: ["text", "image"],
    capabilities: { image_generation: true, image_editing: true },
    status: "active",
  },
  "whisper-1": {
    name: "Whisper",
    description:
      "General-purpose speech recognition model. Supports multilingual transcription and translation.",
    category: "speech_audio",
    parameter_count: 1550000000, // ~1.55B (large-v2)
    context_window: null,
    release_date: "2023-03-01",
    architecture: "transformer",
    modalities: ["audio", "text"],
    capabilities: { transcription: true, translation: true },
    status: "active",
  },
  "tts-1": {
    name: "TTS-1",
    description:
      "Text-to-speech model optimized for real-time use cases with low latency.",
    category: "speech_audio",
    parameter_count: null,
    context_window: null,
    release_date: "2023-11-06",
    architecture: "neural-tts",
    modalities: ["text", "audio"],
    capabilities: { text_to_speech: true, streaming: true },
    status: "active",
  },
  "tts-1-hd": {
    name: "TTS-1 HD",
    description:
      "High-definition text-to-speech model producing higher quality audio output.",
    category: "speech_audio",
    parameter_count: null,
    context_window: null,
    release_date: "2023-11-06",
    architecture: "neural-tts",
    modalities: ["text", "audio"],
    capabilities: { text_to_speech: true },
    status: "active",
  },
  "text-embedding-3-large": {
    name: "Text Embedding 3 Large",
    description:
      "Most capable embedding model for both English and multi-language tasks. 3072 output dimensions.",
    category: "embeddings",
    parameter_count: null,
    context_window: 8191,
    release_date: "2024-01-25",
    architecture: "transformer",
    modalities: ["text"],
    capabilities: { embeddings: true },
    status: "active",
  },
  "text-embedding-3-small": {
    name: "Text Embedding 3 Small",
    description:
      "Highly efficient embedding model. Offers a significant upgrade over ada-002. 1536 output dimensions.",
    category: "embeddings",
    parameter_count: null,
    context_window: 8191,
    release_date: "2024-01-25",
    architecture: "transformer",
    modalities: ["text"],
    capabilities: { embeddings: true },
    status: "active",
  },
  "text-embedding-ada-002": {
    name: "Text Embedding Ada 002",
    description:
      "Second-generation embedding model. Replaced by text-embedding-3 series.",
    category: "embeddings",
    parameter_count: null,
    context_window: 8191,
    release_date: "2022-12-15",
    architecture: "transformer",
    modalities: ["text"],
    capabilities: { embeddings: true },
    status: "active",
  },
};

// --------------- Helpers ---------------

const OPENAI_API_BASE = "https://api.openai.com/v1";

interface OpenAIModelEntry {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface OpenAIModelsResponse {
  data: OpenAIModelEntry[];
}

/** Owner prefixes we keep. Skip user fine-tuned models (owned_by starts with "user-" or org). */
const ALLOWED_OWNERS = new Set(["openai", "system"]);

/** Determine model category from the model ID prefix. */
function inferCategory(modelId: string): string {
  const id = modelId.toLowerCase();
  if (id.startsWith("gpt-") || id.startsWith("chatgpt-")) return "llm";
  if (id.startsWith("o1") || id.startsWith("o3")) return "llm";
  if (id.startsWith("dall-e")) return "image_generation";
  if (id.startsWith("whisper")) return "speech_audio";
  if (id.startsWith("tts-")) return "speech_audio";
  if (id.startsWith("text-embedding")) return "embeddings";
  // Fallback
  return "specialized";
}

/** Build a model record suitable for upserting into the models table. */
function buildModelRecord(
  entry: OpenAIModelEntry
): Record<string, unknown> {
  const known = KNOWN_MODELS[entry.id];
  const slug = makeSlug(`openai-${entry.id}`);

  return {
    slug,
    name: known?.name ?? entry.id,
    provider: "OpenAI",
    category: known?.category ?? inferCategory(entry.id),
    status: known?.status ?? "active",
    description: known?.description ?? null,
    architecture: known?.architecture ?? null,
    parameter_count: known?.parameter_count ?? null,
    context_window: known?.context_window ?? null,
    release_date: known?.release_date ?? timestampToDate(entry.created),
    is_api_available: true,
    is_open_weights: false,
    license: "commercial",
    modalities: known?.modalities ?? inferModalities(entry.id),
    capabilities: known?.capabilities ?? {},
    data_refreshed_at: new Date().toISOString(),
  };
}

/** Convert a UNIX timestamp to YYYY-MM-DD date string. */
function timestampToDate(ts: number): string {
  return new Date(ts * 1000).toISOString().split("T")[0];
}

/** Infer basic modalities from model ID if no known metadata. */
function inferModalities(modelId: string): string[] {
  const id = modelId.toLowerCase();
  if (id.startsWith("dall-e")) return ["text", "image"];
  if (id.startsWith("whisper")) return ["audio", "text"];
  if (id.startsWith("tts-")) return ["text", "audio"];
  if (id.startsWith("text-embedding")) return ["text"];
  return ["text"];
}

// --------------- Adapter ---------------

const adapter: DataSourceAdapter = {
  id: "openai-models",
  name: "OpenAI Models",
  outputTypes: ["models"],
  defaultConfig: {},
  requiredSecrets: ["OPENAI_API_KEY"],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const errors: SyncError[] = [];
    const apiKey = ctx.secrets.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "OPENAI_API_KEY is not set" }],
      };
    }

    // ---- Fetch models from OpenAI API ----
    let models: OpenAIModelEntry[];
    try {
      const res = await fetchWithRetry(
        `${OPENAI_API_BASE}/models`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
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
              message: `OpenAI API returned ${res.status}: ${body.slice(0, 200)}`,
            },
          ],
        };
      }

      const json: OpenAIModelsResponse = await res.json();
      models = json.data ?? [];
    } catch (err) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [
          {
            message: `Failed to fetch OpenAI models: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }

    // ---- Filter to official OpenAI / system models ----
    const filtered = models.filter((m) => ALLOWED_OWNERS.has(m.owned_by));

    // ---- Build upsert records ----
    const records = filtered.map(buildModelRecord);

    // ---- Upsert into DB ----
    const { created, errors: upsertErrors } = await upsertBatch(
      ctx.supabase,
      "models",
      records,
      "slug"
    );
    errors.push(...upsertErrors);

    return {
      success: errors.length === 0,
      recordsProcessed: filtered.length,
      recordsCreated: created,
      recordsUpdated: 0,
      errors,
      metadata: {
        totalFromApi: models.length,
        filteredCount: filtered.length,
        knownModelsMatched: filtered.filter((m) => m.id in KNOWN_MODELS)
          .length,
      },
    };
  },

  async healthCheck(
    secrets: Record<string, string>
  ): Promise<HealthCheckResult> {
    const apiKey = secrets.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        healthy: false,
        latencyMs: 0,
        message: "OPENAI_API_KEY is not configured",
      };
    }

    const start = Date.now();
    try {
      const res = await fetchWithRetry(
        `${OPENAI_API_BASE}/models`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
        { maxRetries: 1 }
      );

      const latencyMs = Date.now() - start;

      if (res.ok) {
        return { healthy: true, latencyMs, message: "OpenAI API reachable" };
      }

      return {
        healthy: false,
        latencyMs,
        message: `OpenAI API returned HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `OpenAI API unreachable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;
