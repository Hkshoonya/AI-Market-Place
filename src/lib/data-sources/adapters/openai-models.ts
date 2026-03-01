/**
 * OpenAI Models Adapter
 *
 * Data sourcing strategy (highest to lowest priority):
 *   1. Live OpenAI API  — if OPENAI_API_KEY is present in ctx.secrets
 *   2. Public HTML scrape — https://platform.openai.com/docs/models
 *   3. KNOWN_MODELS static map — always available, guarantees at least one sync
 *
 * No API key is required. The static map alone is sufficient to produce a
 * complete, meaningful sync of all current OpenAI models.
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
  parameter_count: number | null;
  context_window: number | null;
  release_date: string | null;
  architecture: string | null;
  status: string;
  modalities: string[];
  capabilities: Record<string, boolean>;
}

/**
 * Comprehensive static map of all current OpenAI models.
 * This is the primary data source when no API key is available.
 * Fields are kept accurate as of the adapter's last update (2026-02).
 */
const KNOWN_MODELS: Record<string, KnownModelMeta> = {
  // ---- GPT-5 series ----
  "gpt-5.2": {
    name: "GPT-5.2",
    description:
      "OpenAI's most advanced reasoning model. Incorporates significant improvements over GPT-5 in complex multi-step reasoning, coding, and instruction-following.",
    category: "llm",
    parameter_count: null,
    context_window: 256000,
    release_date: "2025-12-01",
    architecture: "Transformer (reasoning)",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-5.1": {
    name: "GPT-5.1",
    description:
      "Refined version of GPT-5 with improved instruction-following, reduced hallucinations, and better performance across standard benchmarks.",
    category: "llm",
    parameter_count: null,
    context_window: 256000,
    release_date: "2025-11-12",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-5": {
    name: "GPT-5",
    description:
      "OpenAI's fifth-generation flagship language model. Delivers substantially improved intelligence and capability over GPT-4o across reasoning, coding, and creative tasks.",
    category: "llm",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-08-01",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },

  // ---- GPT-4.1 series ----
  "gpt-4.1": {
    name: "GPT-4.1",
    description:
      "High-intelligence multimodal model with a 1 million token context window. Excels at complex instruction-following and long-document analysis.",
    category: "llm",
    parameter_count: null,
    context_window: 1048576,
    release_date: "2025-04-14",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-4.1-mini": {
    name: "GPT-4.1 Mini",
    description:
      "Compact, cost-efficient version of GPT-4.1 retaining the 1 million token context window. Ideal for high-throughput, latency-sensitive applications.",
    category: "llm",
    parameter_count: null,
    context_window: 1048576,
    release_date: "2025-04-14",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-4.1-nano": {
    name: "GPT-4.1 Nano",
    description:
      "Ultra-lightweight variant of GPT-4.1 optimised for edge deployments and cost-constrained workloads, while retaining the 1 million token context.",
    category: "llm",
    parameter_count: null,
    context_window: 1048576,
    release_date: "2025-04-14",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      function_calling: true,
      streaming: true,
    },
  },

  // ---- o-series reasoning models ----
  "o4-mini": {
    name: "o4-mini",
    description:
      "Fast, cost-efficient reasoning model in the o-series. Balances strong STEM performance with lower inference cost and adjustable reasoning effort.",
    category: "llm",
    parameter_count: null,
    context_window: 200000,
    release_date: "2025-04-16",
    architecture: "Transformer (reasoning)",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  o3: {
    name: "o3",
    description:
      "OpenAI's most powerful reasoning model. Achieves state-of-the-art results on complex math, science, and code tasks through extended chain-of-thought.",
    category: "llm",
    parameter_count: null,
    context_window: 200000,
    release_date: "2025-04-16",
    architecture: "Transformer (reasoning)",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "o3-mini": {
    name: "o3-mini",
    description:
      "Cost-efficient reasoning model with adjustable reasoning effort. Optimised for STEM and coding tasks at a fraction of o3's inference cost.",
    category: "llm",
    parameter_count: null,
    context_window: 200000,
    release_date: "2025-01-31",
    architecture: "Transformer (reasoning)",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      function_calling: true,
      streaming: true,
    },
  },
  o1: {
    name: "o1",
    description:
      "First-generation full o-series reasoning model. Uses extended internal chain-of-thought before responding, excelling at PhD-level science and math problems.",
    category: "llm",
    parameter_count: null,
    context_window: 200000,
    release_date: "2024-12-17",
    architecture: "Transformer (reasoning)",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "o1-mini": {
    name: "o1-mini",
    description:
      "Smaller, faster reasoning model in the o1 series. Optimised for STEM tasks at lower cost than full o1.",
    category: "llm",
    parameter_count: null,
    context_window: 128000,
    release_date: "2024-09-12",
    architecture: "Transformer (reasoning)",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      streaming: true,
    },
  },

  // ---- GPT-4o series ----
  "gpt-4o": {
    name: "GPT-4o",
    description:
      "Multimodal flagship model with native vision and audio capabilities. Combines high intelligence with fast response times at competitive pricing.",
    category: "multimodal",
    parameter_count: null,
    context_window: 128000,
    release_date: "2024-05-13",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image", "audio"],
    capabilities: {
      reasoning: true,
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-4o-mini": {
    name: "GPT-4o Mini",
    description:
      "Small, fast, and affordable multimodal model for lightweight tasks. Retains vision capabilities of GPT-4o at significantly reduced cost.",
    category: "multimodal",
    parameter_count: null,
    context_window: 128000,
    release_date: "2024-07-18",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },

  // ---- GPT-4 legacy ----
  "gpt-4-turbo": {
    name: "GPT-4 Turbo",
    description:
      "GPT-4 Turbo with Vision — high-intelligence model with 128K context and knowledge cutoff April 2024. Predecessor to GPT-4o.",
    category: "llm",
    parameter_count: null,
    context_window: 128000,
    release_date: "2024-04-09",
    architecture: "Transformer",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      coding: true,
      vision: true,
      function_calling: true,
      streaming: true,
    },
  },
  "gpt-4": {
    name: "GPT-4",
    description:
      "Original GPT-4 model with broad general knowledge and strong reasoning. 8K context window; superseded by GPT-4 Turbo and GPT-4o.",
    category: "llm",
    parameter_count: null,
    context_window: 8192,
    release_date: "2023-03-14",
    architecture: "Transformer",
    status: "active",
    modalities: ["text"],
    capabilities: {
      coding: true,
      function_calling: true,
      streaming: true,
    },
  },

  // ---- Image generation ----
  "gpt-image-1": {
    name: "GPT Image 1",
    description:
      "OpenAI's newest image generation model, natively integrated into the GPT-4o ecosystem. Produces photorealistic images with strong prompt adherence.",
    category: "image_generation",
    parameter_count: null,
    context_window: null,
    release_date: "2025-04-23",
    architecture: "Diffusion",
    status: "active",
    modalities: ["text", "image"],
    capabilities: { image_generation: true, image_editing: true },
  },
  "dall-e-3": {
    name: "DALL-E 3",
    description:
      "State-of-the-art image generation model with high fidelity and outstanding prompt adherence. Natively integrated into ChatGPT.",
    category: "image_generation",
    parameter_count: null,
    context_window: null,
    release_date: "2023-10-01",
    architecture: "Diffusion",
    status: "active",
    modalities: ["text", "image"],
    capabilities: { image_generation: true },
  },
  "dall-e-2": {
    name: "DALL-E 2",
    description:
      "Second-generation image generation model capable of creating realistic images and art. Supports in-painting and out-painting. Superseded by DALL-E 3.",
    category: "image_generation",
    parameter_count: null,
    context_window: null,
    release_date: "2022-04-01",
    architecture: "Diffusion",
    status: "deprecated",
    modalities: ["text", "image"],
    capabilities: { image_generation: true, image_editing: true },
  },

  // ---- Code ----
  "codex-mini-latest": {
    name: "Codex Mini",
    description:
      "Lightweight code-optimised model based on the o-series reasoning architecture. Designed for agentic coding tasks and automated software engineering.",
    category: "code",
    parameter_count: null,
    context_window: 200000,
    release_date: "2025-05-16",
    architecture: "Transformer (code)",
    status: "active",
    modalities: ["text"],
    capabilities: {
      reasoning: true,
      coding: true,
      function_calling: true,
      streaming: true,
    },
  },

  // ---- Specialized / Agentic ----
  "computer-use-preview": {
    name: "Computer Use Preview",
    description:
      "Specialized agentic model capable of interacting with computer interfaces — clicking, typing, and navigating GUIs autonomously.",
    category: "specialized",
    parameter_count: null,
    context_window: 128000,
    release_date: "2025-03-01",
    architecture: "Transformer (agentic)",
    status: "active",
    modalities: ["text", "image"],
    capabilities: {
      vision: true,
      computer_use: true,
      function_calling: true,
    },
  },

  // ---- Audio ----
  "gpt-4o-audio-preview": {
    name: "GPT-4o Audio",
    description:
      "Audio-capable variant of GPT-4o supporting real-time speech input and output. Enables low-latency voice assistants and audio reasoning tasks.",
    category: "speech_audio",
    parameter_count: null,
    context_window: 128000,
    release_date: "2024-10-01",
    architecture: "Transformer (audio)",
    status: "active",
    modalities: ["text", "image", "audio"],
    capabilities: {
      vision: true,
      transcription: true,
      text_to_speech: true,
      streaming: true,
    },
  },
  "whisper-1": {
    name: "Whisper",
    description:
      "General-purpose speech recognition model trained on 680K hours of multilingual audio. Supports transcription and translation across 97 languages.",
    category: "speech_audio",
    parameter_count: null,
    context_window: null,
    release_date: "2023-03-01",
    architecture: "Transformer (ASR)",
    status: "active",
    modalities: ["audio", "text"],
    capabilities: { transcription: true, translation: true },
  },
  "tts-1": {
    name: "TTS-1",
    description:
      "Text-to-speech model optimised for real-time streaming with low latency. Six built-in voices available.",
    category: "speech_audio",
    parameter_count: null,
    context_window: null,
    release_date: "2023-11-01",
    architecture: "TTS",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: { text_to_speech: true, streaming: true },
  },
  "tts-1-hd": {
    name: "TTS-1 HD",
    description:
      "High-definition variant of TTS-1 producing richer, higher-quality audio output. Recommended when audio fidelity is more important than latency.",
    category: "speech_audio",
    parameter_count: null,
    context_window: null,
    release_date: "2023-11-01",
    architecture: "TTS",
    status: "active",
    modalities: ["text", "audio"],
    capabilities: { text_to_speech: true },
  },

  // ---- Embeddings ----
  "text-embedding-3-large": {
    name: "Embedding 3 Large",
    description:
      "Most capable embedding model for English and multilingual tasks. Produces 3072-dimension vectors; supports dimension reduction for cost-performance trade-offs.",
    category: "embeddings",
    parameter_count: null,
    context_window: 8191,
    release_date: "2024-01-25",
    architecture: "Transformer (embed)",
    status: "active",
    modalities: ["text"],
    capabilities: { embeddings: true },
  },
  "text-embedding-3-small": {
    name: "Embedding 3 Small",
    description:
      "Efficient embedding model with 1536-dimension output. Significant upgrade over ada-002 at a lower cost; ideal for most retrieval and similarity tasks.",
    category: "embeddings",
    parameter_count: null,
    context_window: 8191,
    release_date: "2024-01-25",
    architecture: "Transformer (embed)",
    status: "active",
    modalities: ["text"],
    capabilities: { embeddings: true },
  },
};

// ---------------------------------------------------------------------------
// Inference helpers (for API/scrape models not in KNOWN_MODELS)
// ---------------------------------------------------------------------------

/** Infer model category from its ID when not in KNOWN_MODELS. */
function inferCategory(modelId: string): string {
  const id = modelId.toLowerCase();
  if (id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4")) return "llm";
  if (id.startsWith("gpt-")) return "llm";
  if (id.startsWith("dall-e") || id.includes("image")) return "image_generation";
  if (id.startsWith("whisper")) return "speech_audio";
  if (id.startsWith("tts-")) return "speech_audio";
  if (id.startsWith("text-embedding")) return "embeddings";
  if (id.startsWith("codex")) return "code";
  return "specialized";
}

/** Infer modalities from model ID when not in KNOWN_MODELS. */
function inferModalities(modelId: string): string[] {
  const id = modelId.toLowerCase();
  if (id.startsWith("dall-e") || id.includes("image")) return ["text", "image"];
  if (id.startsWith("whisper")) return ["audio", "text"];
  if (id.startsWith("tts-")) return ["text", "audio"];
  if (id.startsWith("text-embedding")) return ["text"];
  if (id.startsWith("gpt-4o")) return ["text", "image", "audio"];
  return ["text"];
}

// ---------------------------------------------------------------------------
// Record builder
// ---------------------------------------------------------------------------

/**
 * Build a complete model record for the `models` table.
 * `known` fields take precedence; fallbacks are computed from the model ID.
 */
function buildRecord(
  modelId: string,
  overrides: Partial<KnownModelMeta> = {}
): Record<string, unknown> {
  const known = KNOWN_MODELS[modelId];
  const merged = { ...known, ...overrides };

  return {
    slug: makeSlug(`openai-${modelId}`),
    name: merged?.name ?? modelId,
    provider: "OpenAI",
    category: merged?.category ?? inferCategory(modelId),
    status: merged?.status ?? "active",
    description: merged?.description ?? null,
    architecture: merged?.architecture ?? null,
    parameter_count: merged?.parameter_count ?? null,
    context_window: merged?.context_window ?? null,
    release_date: merged?.release_date ?? null,
    is_api_available: true,
    is_open_weights: false,
    license: "commercial",
    license_name: "Proprietary",
    modalities: merged?.modalities ?? inferModalities(modelId),
    capabilities: merged?.capabilities ?? {},
    data_refreshed_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Optional: live API fetch
// ---------------------------------------------------------------------------

interface OpenAIModelEntry {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface OpenAIModelsResponse {
  data: OpenAIModelEntry[];
}

const ALLOWED_OWNERS = new Set(["openai", "system"]);

/**
 * Attempt to fetch the live model list from the OpenAI API.
 * Returns null on any failure so the caller can fall back gracefully.
 */
async function tryFetchLiveApi(
  apiKey: string,
  signal?: AbortSignal
): Promise<string[] | null> {
  try {
    const res = await fetchWithRetry(
      "https://api.openai.com/v1/models",
      { headers: { Authorization: `Bearer ${apiKey}` }, signal },
      { maxRetries: 2, signal }
    );
    if (!res.ok) return null;

    const json: OpenAIModelsResponse = await res.json();
    return (json.data ?? [])
      .filter((m) => ALLOWED_OWNERS.has(m.owned_by))
      .map((m) => m.id);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Optional: public HTML scrape
// ---------------------------------------------------------------------------

/**
 * Try to scrape the OpenAI models docs page for model IDs.
 * The page lists model IDs in code blocks — we extract anything resembling
 * a known pattern. Returns an empty array on failure.
 */
async function tryScrapeDocsPage(signal?: AbortSignal): Promise<string[]> {
  try {
    const res = await fetchWithRetry(
      "https://platform.openai.com/docs/models",
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ModelIndexBot/1.0)" },
        signal,
      },
      { maxRetries: 1, signal }
    );
    if (!res.ok) return [];

    const html = await res.text();

    // Extract anything that looks like a model ID from code/pre tags and
    // data attributes. Pattern: word chars, hyphens, dots; at least one dash.
    const modelPattern =
      /\b(gpt-[\w.]+|o[134](?:-[\w.]+)?|dall-e-\d|codex-[\w-]+|whisper-\d|tts-[\w-]+|text-embedding-[\w-]+|computer-use-[\w-]+|gpt-image-[\w-]+)\b/g;

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
  id: "openai-models",
  name: "OpenAI Models",
  outputTypes: ["models"],
  defaultConfig: {},

  // No API key required — static data guarantees a successful sync.
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const now = new Date().toISOString();
    const apiKey = ctx.secrets.OPENAI_API_KEY;

    // ── Step 1: Start with the comprehensive static map ──────────────────────
    // The slug-keyed map ensures we always have accurate, up-to-date records
    // for every model we know about.
    const recordMap = new Map<string, Record<string, unknown>>();
    for (const modelId of Object.keys(KNOWN_MODELS)) {
      recordMap.set(modelId, buildRecord(modelId));
    }

    // Track data source coverage for metadata
    const sources: string[] = ["static_known_models"];

    // ── Step 2 (bonus): Scrape public docs page ───────────────────────────────
    // Adds any model IDs mentioned on the docs page that aren't in our static
    // map, so newly announced models get at least a minimal record.
    const scrapedIds = await tryScrapeDocsPage(ctx.signal);
    if (scrapedIds.length > 0) {
      sources.push("html_scrape");
      for (const modelId of scrapedIds) {
        if (!recordMap.has(modelId)) {
          // Unknown model — create a minimal record; static data wins for knowns
          recordMap.set(modelId, buildRecord(modelId));
        }
      }
    }

    // ── Step 3 (bonus): Live API if key available ─────────────────────────────
    // The API returns real-time model availability, creation timestamps,
    // and may include newly released models we haven't hard-coded yet.
    let apiModelIds: string[] | null = null;
    if (apiKey) {
      apiModelIds = await tryFetchLiveApi(apiKey, ctx.signal);
      if (apiModelIds) {
        sources.push("openai_api");
        for (const modelId of apiModelIds) {
          if (!recordMap.has(modelId)) {
            // New model from API — add a minimal record
            recordMap.set(modelId, buildRecord(modelId));
          }
          // Stamp models confirmed live by the API
          const existing = recordMap.get(modelId);
          if (existing) {
            existing.data_refreshed_at = now;
          }
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
        apiModels: apiModelIds?.length ?? 0,
        totalRecords: records.length,
      },
    };
  },

  async healthCheck(secrets: Record<string, string>): Promise<HealthCheckResult> {
    // Health check: if an API key exists, verify it; otherwise confirm static
    // data is available (always healthy with no key).
    const apiKey = secrets.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        healthy: true,
        latencyMs: 0,
        message: `Static-only mode — ${Object.keys(KNOWN_MODELS).length} models available without API key`,
      };
    }

    const start = Date.now();
    try {
      const res = await fetchWithRetry(
        "https://api.openai.com/v1/models",
        { headers: { Authorization: `Bearer ${apiKey}` } },
        { maxRetries: 1 }
      );
      const latencyMs = Date.now() - start;
      return res.ok
        ? { healthy: true, latencyMs, message: "OpenAI API reachable" }
        : { healthy: false, latencyMs, message: `OpenAI API returned HTTP ${res.status}` };
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
