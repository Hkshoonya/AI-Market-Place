/**
 * Hugging Face Hub Adapter
 *
 * Fetches model metadata from the HF Hub API sorted by trending score,
 * transforms each model into the internal schema, and upserts into Supabase.
 *
 * Ported from supabase/functions/sync-huggingface/index.ts.
 */

import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  SyncError,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import {
  fetchWithRetry,
  createRateLimitedFetch,
  upsertBatch,
  makeSlug,
} from "../utils";
import { getCanonicalProviderName } from "@/lib/constants/providers";

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const HF_API_BASE = "https://huggingface.co/api";
const HF_RAW_BASE = "https://huggingface.co";
const HF_CONTEXT_FETCH_CONCURRENCY = 4;
const MAX_REASONABLE_CONTEXT_WINDOW = 10_000_000;
const CONTEXT_ELIGIBLE_CATEGORIES = new Set(["llm", "multimodal"]);
const CONTEXT_ENRICHMENT_PROVIDERS = new Set([
  "DeepSeek",
  "Google",
  "Meta",
  "Microsoft",
  "MiniMax",
  "NVIDIA",
  "Qwen",
  "xAI",
  "Z.ai",
]);
const GAP_FETCH_PAGE_SIZE = 1000;

// ────────────────────────────────────────────────────────────────
// Mapping helpers (kept from the original Edge Function)
// ────────────────────────────────────────────────────────────────

/** Map HF pipeline_tag to our internal category. */
function mapCategory(pipelineTag: string | null): string {
  const mapping: Record<string, string> = {
    "text-generation": "llm",
    "text2text-generation": "llm",
    conversational: "llm",
    "fill-mask": "llm",
    summarization: "llm",
    translation: "llm",
    "question-answering": "llm",
    "text-to-image": "image_generation",
    "image-to-image": "image_generation",
    "image-classification": "vision",
    "object-detection": "vision",
    "image-segmentation": "vision",
    "image-to-text": "vision",
    "visual-question-answering": "multimodal",
    "document-question-answering": "multimodal",
    "feature-extraction": "embeddings",
    "sentence-similarity": "embeddings",
    "automatic-speech-recognition": "speech_audio",
    "text-to-speech": "speech_audio",
    "audio-classification": "speech_audio",
    "text-to-video": "video",
    "video-classification": "video",
    "text-to-code": "code",
  };
  return mapping[pipelineTag ?? ""] ?? "specialized";
}

/** Map HF license tags to our license type + name. */
function mapLicense(tags: string[]): { type: string; name: string } {
  const licenseTags = tags.filter(
    (t) =>
      t.startsWith("license:") ||
      t === "mit" ||
      t === "apache-2.0" ||
      t === "openrail"
  );

  for (const tag of licenseTags) {
    const license = tag.replace("license:", "");
    if (
      [
        "mit",
        "apache-2.0",
        "bsd-3-clause",
        "cc-by-4.0",
        "cc0-1.0",
        "openrail",
      ].includes(license)
    ) {
      return { type: "open_source", name: license };
    }
    if (
      ["cc-by-nc-4.0", "cc-by-nc-sa-4.0", "openrail++"].includes(license)
    ) {
      return { type: "research_only", name: license };
    }
  }
  return { type: "commercial", name: "proprietary" };
}

export function inferOpenWeightsFromHfModel(hfId: string, tags: string[] = []): boolean {
  const normalizedId = hfId.toLowerCase();
  const normalizedTags = tags.map((tag) => tag.toLowerCase());

  if (normalizedTags.includes("open_access")) return true;
  if (normalizedTags.includes("license:gemma")) return true;
  if (normalizedTags.some((tag) => tag.includes("gguf"))) return true;
  if (normalizedTags.some((tag) => tag === "sam3" || tag.startsWith("ltx-") || tag === "ltx-video" || tag === "ltxv")) {
    return true;
  }
  if (normalizedTags.some((tag) => tag === "personaplex" || tag.startsWith("magpie"))) {
    return true;
  }
  if (normalizedId.includes("gguf")) return true;

  return (
    normalizedId.startsWith("google/gemma") ||
    normalizedId.startsWith("google/embeddinggemma") ||
    normalizedId.startsWith("google/translategemma") ||
    normalizedId.startsWith("facebook/sam3") ||
    normalizedId.startsWith("lightricks/ltx") ||
    normalizedId.startsWith("black-forest-labs/flux.1-dev") ||
    normalizedId.startsWith("black-forest-labs/flux.2-klein") ||
    normalizedId.startsWith("nvidia/nvidia-nemotron") ||
    normalizedId.startsWith("nvidia/personaplex") ||
    normalizedId.startsWith("nvidia/magpie") ||
    normalizedId.startsWith("liquidai/lfm") ||
    normalizedId.startsWith("unsloth/") ||
    normalizedId.startsWith("aessedai/") ||
    normalizedId.startsWith("sehyo/")
  );
}

/** Extract parameter count from model tags (e.g. "7b", "1.5b", "130m"). */
function extractParamCount(tags: string[]): number | null {
  for (const tag of tags) {
    const match = tag.match(/^(\d+\.?\d*)(b|m|k)$/i);
    if (match) {
      const num = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === "b") return Math.round(num * 1_000_000_000);
      if (unit === "m") return Math.round(num * 1_000_000);
      if (unit === "k") return Math.round(num * 1_000);
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────────
// HF API response shape
// ────────────────────────────────────────────────────────────────

interface HFModel {
  id: string; // e.g. "meta-llama/Llama-3-70B"
  modelId: string;
  author: string;
  sha: string;
  lastModified: string;
  private: boolean;
  disabled: boolean;
  gated: boolean | string;
  pipeline_tag: string | null;
  tags: string[];
  downloads: number;
  likes: number;
  trendingScore: number;
  library_name: string;
  createdAt: string;
}

interface HfModelRecord extends Record<string, unknown> {
  slug: string;
  name: string;
  provider: string;
  category: string;
  status: string;
  architecture: string | null;
  parameter_count: number | null;
  hf_model_id: string | null;
  hf_downloads: number;
  hf_likes: number;
  hf_trending_score: number;
  license: string;
  license_name: string;
  is_open_weights: boolean;
  is_api_available: boolean;
  supported_languages: string[];
  modalities: string[];
  capabilities: Record<string, unknown>;
  context_window?: number | null;
  website_url?: string | null;
  release_date: string | null;
  data_refreshed_at: string;
}

function normalizeContextWindow(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0 || value > MAX_REASONABLE_CONTEXT_WINDOW) return null;
  return Math.round(value);
}

function deriveRopeScaledContext(config: Record<string, unknown>): number | null {
  const ropeScaling =
    config.rope_scaling && typeof config.rope_scaling === "object"
      ? (config.rope_scaling as Record<string, unknown>)
      : null;
  const originalMax = normalizeContextWindow(
    ropeScaling?.original_max_position_embeddings
  );
  const factor =
    typeof ropeScaling?.factor === "number" && Number.isFinite(ropeScaling.factor)
      ? ropeScaling.factor
      : null;

  if (!originalMax || !factor || factor <= 0) return null;
  return normalizeContextWindow(originalMax * factor);
}

function extractContextWindowFromTokenizerConfig(
  tokenizerConfig: Record<string, unknown> | null | undefined
): number | null {
  if (!tokenizerConfig) return null;

  const candidates = [
    tokenizerConfig.model_max_length,
    tokenizerConfig.max_model_input_sizes,
    tokenizerConfig.max_sequence_length,
    tokenizerConfig.max_seq_len,
  ]
    .flatMap((candidate) =>
      typeof candidate === "object" && candidate !== null
        ? Object.values(candidate)
        : [candidate]
    )
    .map(normalizeContextWindow)
    .filter((candidate): candidate is number => candidate !== null);

  return candidates.length > 0 ? Math.max(...candidates) : null;
}

function extractContextWindowFromConfig(
  config: Record<string, unknown> | null | undefined
): number | null {
  if (!config) return null;

  const textConfig =
    config.text_config && typeof config.text_config === "object"
      ? (config.text_config as Record<string, unknown>)
      : null;
  const transformerLayerConfig =
    config.transformer_layer_config &&
    typeof config.transformer_layer_config === "object"
      ? (config.transformer_layer_config as Record<string, unknown>)
      : null;

  const candidates = [
    config.max_position_embeddings,
    config.sliding_window,
    config.max_sequence_length,
    config.max_seq_len,
    config.seq_length,
    config.model_max_length,
    config.block_size,
    config.n_positions,
    deriveRopeScaledContext(config),
    textConfig?.max_position_embeddings,
    textConfig?.sliding_window,
    textConfig?.max_sequence_length,
    textConfig?.max_seq_len,
    textConfig?.seq_length,
    textConfig?.model_max_length,
    textConfig?.block_size,
    textConfig?.n_positions,
    textConfig ? deriveRopeScaledContext(textConfig) : null,
    transformerLayerConfig?.max_position_embeddings,
    transformerLayerConfig?.sliding_window,
    transformerLayerConfig?.max_sequence_length,
    transformerLayerConfig?.max_seq_len,
    transformerLayerConfig?.seq_length,
    transformerLayerConfig?.model_max_length,
    transformerLayerConfig?.block_size,
    transformerLayerConfig?.n_positions,
    transformerLayerConfig
      ? deriveRopeScaledContext(transformerLayerConfig)
      : null,
  ]
    .map(normalizeContextWindow)
    .filter((candidate): candidate is number => candidate !== null);

  return candidates.length > 0 ? Math.max(...candidates) : null;
}

function buildHfModelPageUrl(hfId: string) {
  return `${HF_RAW_BASE}/${hfId
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function buildHfApiModelInfoUrl(hfId: string) {
  return `${HF_API_BASE}/models/${hfId
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function buildHfHeaders(token?: string) {
  const headers: Record<string, string> = {
    "User-Agent": "AI-Market-Cap-Bot/1.0",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function fetchHfRawJson(
  hfId: string,
  filename: string,
  signal?: AbortSignal,
  token?: string
): Promise<Record<string, unknown> | null> {
  const url = `${buildHfModelPageUrl(hfId)}/raw/main/${filename}`;
  const res = await fetchWithRetry(
    url,
    {
      headers: buildHfHeaders(token),
      signal,
    },
    { signal, maxRetries: 1, baseDelayMs: 400 }
  );

  if (!res.ok) return null;

  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchHfModelInfo(
  hfId: string,
  signal?: AbortSignal,
  token?: string
): Promise<Record<string, unknown> | null> {
  const res = await fetchWithRetry(
    buildHfApiModelInfoUrl(hfId),
    {
      headers: buildHfHeaders(token),
      signal,
    },
    { signal, maxRetries: 1, baseDelayMs: 400 }
  );

  if (!res.ok) return null;

  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractBaseModelIdsFromModelInfo(
  modelInfo: Record<string, unknown> | null | undefined
): string[] {
  if (!modelInfo) return [];

  const cardData =
    modelInfo.cardData && typeof modelInfo.cardData === "object"
      ? (modelInfo.cardData as Record<string, unknown>)
      : null;

  const baseModelCandidates = [
    ...(typeof cardData?.base_model === "string" ? [cardData.base_model] : []),
    ...(Array.isArray(cardData?.base_model)
      ? cardData.base_model.filter((value): value is string => typeof value === "string")
      : []),
    ...(Array.isArray(modelInfo.tags)
      ? modelInfo.tags
          .filter((value): value is string => typeof value === "string")
          .filter((tag) => tag.startsWith("base_model:"))
          .map((tag) => tag.split(":").pop() ?? "")
      : []),
  ];

  return Array.from(
    new Set(
      baseModelCandidates
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value) => value.includes("/"))
    )
  );
}

async function fetchContextWindowForHfId(
  hfId: string,
  signal?: AbortSignal,
  token?: string
): Promise<number | null> {
  const tokenizerConfig = await fetchHfRawJson(
    hfId,
    "tokenizer_config.json",
    signal,
    token
  );
  const tokenizerContext =
    extractContextWindowFromTokenizerConfig(tokenizerConfig);

  if (tokenizerContext) {
    return tokenizerContext;
  }

  const config = await fetchHfRawJson(hfId, "config.json", signal, token);
  return extractContextWindowFromConfig(config);
}

function shouldAttemptContextEnrichment(
  record: HfModelRecord,
  options?: { allowAnyProvider?: boolean }
) {
  return (
    Boolean(record.hf_model_id) &&
    !record.context_window &&
    CONTEXT_ELIGIBLE_CATEGORIES.has(record.category) &&
    (options?.allowAnyProvider === true ||
      CONTEXT_ENRICHMENT_PROVIDERS.has(record.provider))
  );
}

async function enrichRecordWithContextWindow(
  record: HfModelRecord,
  signal?: AbortSignal,
  options?: { allowAnyProvider?: boolean; token?: string }
) {
  const hfModelId = record.hf_model_id;
  if (!hfModelId) return;

  if (!record.website_url) {
    record.website_url = buildHfModelPageUrl(hfModelId);
  }

  if (!shouldAttemptContextEnrichment(record, options)) return;

  const directContext = await fetchContextWindowForHfId(
    hfModelId,
    signal,
    options?.token
  );

  if (directContext) {
    record.context_window = directContext;
    return;
  }

  const modelInfo = await fetchHfModelInfo(hfModelId, signal, options?.token);
  const baseModelIds = extractBaseModelIdsFromModelInfo(modelInfo).filter(
    (baseModelId) => baseModelId !== hfModelId
  );

  for (const baseModelId of baseModelIds) {
    const baseContext = await fetchContextWindowForHfId(
      baseModelId,
      signal,
      options?.token
    );
    if (baseContext) {
      record.context_window = baseContext;
      return;
    }
  }
}

async function enrichRecordsWithOfficialContextWindow(
  records: HfModelRecord[],
  signal?: AbortSignal,
  token?: string
) {
  const candidates = records.filter((record) =>
    shouldAttemptContextEnrichment(record)
  );

  for (let index = 0; index < candidates.length; index += HF_CONTEXT_FETCH_CONCURRENCY) {
    await Promise.all(
      candidates
        .slice(index, index + HF_CONTEXT_FETCH_CONCURRENCY)
        .map((record) =>
          enrichRecordWithContextWindow(record, signal, { token })
        )
    );
  }
}

interface HfMetadataGapRow {
  slug: string;
  provider: string;
  category: string;
  hf_model_id: string | null;
  context_window: number | null;
  website_url: string | null;
}

function shouldBackfillGapRow(row: HfMetadataGapRow) {
  return (
    Boolean(row.hf_model_id) &&
    (!row.website_url ||
      (!row.context_window && CONTEXT_ELIGIBLE_CATEGORIES.has(row.category)))
  );
}

async function fetchMetadataGapRows(ctx: SyncContext) {
  const rows: HfMetadataGapRow[] = [];

  for (let from = 0; ; from += GAP_FETCH_PAGE_SIZE) {
    const to = from + GAP_FETCH_PAGE_SIZE - 1;
    const { data, error } = await ctx.supabase
      .from("models")
      .select("slug, provider, category, hf_model_id, context_window, website_url")
      .eq("status", "active")
      .not("hf_model_id", "is", null)
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch HF metadata gap rows: ${error.message}`);
    }

    const page = ((data ?? []) as HfMetadataGapRow[]).filter(shouldBackfillGapRow);
    rows.push(...page);

    if ((data ?? []).length < GAP_FETCH_PAGE_SIZE) break;
  }

  return rows;
}

async function backfillHfMetadataGaps(
  ctx: SyncContext
): Promise<{ updated: number; errors: SyncError[] }> {
  const rows = await fetchMetadataGapRows(ctx);
  const errors: SyncError[] = [];
  let updated = 0;

  for (let index = 0; index < rows.length; index += HF_CONTEXT_FETCH_CONCURRENCY) {
    const slice = rows.slice(index, index + HF_CONTEXT_FETCH_CONCURRENCY);

    await Promise.all(
      slice.map(async (row) => {
        const patch: HfModelRecord = {
          slug: row.slug,
          provider: row.provider,
          category: row.category,
          status: "active",
          name: row.slug,
          architecture: null,
          parameter_count: null,
          hf_model_id: row.hf_model_id,
          hf_downloads: 0,
          hf_likes: 0,
          hf_trending_score: 0,
          license: "commercial",
          license_name: "proprietary",
          is_open_weights: false,
          is_api_available: false,
          supported_languages: [],
          modalities: [],
          capabilities: {},
          context_window: row.context_window,
          website_url: row.website_url,
          release_date: null,
          data_refreshed_at: new Date().toISOString(),
        };

        try {
          await enrichRecordWithContextWindow(patch, ctx.signal, {
            allowAnyProvider: true,
            token: ctx.secrets.HUGGINGFACE_API_TOKEN ?? "",
          });

          const changed =
            patch.context_window !== row.context_window ||
            patch.website_url !== row.website_url;
          if (!changed) return;

          const { error } = await ctx.supabase
            .from("models")
            .update({
              context_window: patch.context_window,
              website_url: patch.website_url,
              data_refreshed_at: patch.data_refreshed_at,
            })
            .eq("slug", row.slug);

          if (error) {
            errors.push({
              message: `Failed to backfill HF metadata gap: ${error.message}`,
              context: `slug=${row.slug}`,
            });
            return;
          }

          updated += 1;
        } catch (error) {
          errors.push({
            message:
              error instanceof Error ? error.message : String(error),
            context: `slug=${row.slug}`,
          });
        }
      })
    );
  }

  return { updated, errors };
}

// ────────────────────────────────────────────────────────────────
// Transform a single HF model into our DB record shape
// ────────────────────────────────────────────────────────────────

function transformModel(hf: HFModel): HfModelRecord {
  const slug = makeSlug(hf.id);
  const [provider, ...nameParts] = hf.id.split("/");
  const name = nameParts.join("/") || hf.id;
  const category = mapCategory(hf.pipeline_tag);
  const license = mapLicense(hf.tags);
  const paramCount = extractParamCount(hf.tags);

  const isOpenWeights =
    license.type === "open_source" ||
    license.type === "research_only" ||
    inferOpenWeightsFromHfModel(hf.id, hf.tags);
  const resolvedLicense =
    isOpenWeights && license.type === "commercial"
      ? { type: "open_source", name: "Open weights" }
      : license;

  return {
    slug,
    name,
    provider: getCanonicalProviderName(provider || "unknown"),
    category,
    status: hf.disabled ? "archived" : "active",
    architecture: hf.library_name || null,
    parameter_count: paramCount,
    hf_model_id: hf.id,
    hf_downloads: hf.downloads || 0,
    hf_likes: hf.likes || 0,
    hf_trending_score: hf.trendingScore || 0,
    license: resolvedLicense.type,
    license_name: resolvedLicense.name,
    is_open_weights: isOpenWeights,
    is_api_available: false,
    context_window: null,
    supported_languages: [],
    modalities: hf.pipeline_tag ? [hf.pipeline_tag] : [],
    capabilities: {},
    website_url: buildHfModelPageUrl(hf.id),
    release_date: hf.createdAt ? hf.createdAt.split("T")[0] : null,
    data_refreshed_at: new Date().toISOString(),
  };
}

// ────────────────────────────────────────────────────────────────
// Adapter implementation
// ────────────────────────────────────────────────────────────────

const adapter: DataSourceAdapter = {
  id: "huggingface",
  name: "Hugging Face Hub",
  outputTypes: ["models"],
  defaultConfig: {
    maxPages: 50,
    pageSize: 100,
    rateLimitDelayMs: 200,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxPages = (ctx.config.maxPages as number) ?? 50;
    const pageSize = (ctx.config.pageSize as number) ?? 100;
    const rateLimitDelayMs = (ctx.config.rateLimitDelayMs as number) ?? 200;
    const token = ctx.secrets.HUGGINGFACE_API_TOKEN ?? "";

    const rateLimitedFetch = createRateLimitedFetch(rateLimitDelayMs);

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    const errors: SyncError[] = [];

    for (let page = 0; page < maxPages; page++) {
      // Respect abort signal
      if (ctx.signal?.aborted) {
        errors.push({ message: "Sync aborted by signal", context: `page=${page}` });
        break;
      }

      try {
        const url = `${HF_API_BASE}/models?limit=${pageSize}&offset=${page * pageSize}&sort=trendingScore&direction=-1&full=true`;

        const res = await rateLimitedFetch(url, { headers }, ctx.signal);

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          errors.push({
            message: `HF API returned ${res.status}: ${body.slice(0, 200)}`,
            context: `page=${page}`,
          });
          // Stop fetching on auth / not-found errors
          if (res.status === 401 || res.status === 403 || res.status === 404) {
            break;
          }
          continue;
        }

        const models: HFModel[] = await res.json();

        // No more results -- we've exhausted the list
        if (models.length === 0) {
          break;
        }

        // Filter out private / disabled models and transform
        const records = models
          .filter((m) => !m.private && !m.disabled)
          .map(transformModel);

        await enrichRecordsWithOfficialContextWindow(
          records,
          ctx.signal,
          token
        );

        totalProcessed += models.length;

        if (records.length > 0) {
          const { created, errors: upsertErrors } = await upsertBatch(
            ctx.supabase,
            "models",
            records,
            "slug"
          );
          totalCreated += created;
          errors.push(...upsertErrors);
        }

        // Progress tracked via SyncResult metadata

        // If we got fewer models than the page size, there are no more pages
        if (models.length < pageSize) {
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ message: msg, context: `page=${page}` });
        // Continue with next page rather than failing the whole sync
      }
    }

    try {
      const gapBackfill = await backfillHfMetadataGaps(ctx);
      totalUpdated += gapBackfill.updated;
      errors.push(...gapBackfill.errors);
    } catch (error) {
      errors.push({
        message:
          error instanceof Error ? error.message : String(error),
        context: "hf-gap-backfill",
      });
    }

    // A sync with only upsert warnings is still considered partial success
    const hasErrors = errors.length > 0;
    const nothingProcessed = totalProcessed === 0;

    return {
      success: !nothingProcessed,
      recordsProcessed: totalProcessed,
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
      errors,
      metadata: {
        maxPages,
        pageSize,
        pagesAttempted: Math.min(
          maxPages,
          Math.ceil(totalProcessed / pageSize) + (hasErrors ? 1 : 0)
        ),
        gapBackfilled: totalUpdated,
      },
    };
  },

  async healthCheck(secrets: Record<string, string>): Promise<HealthCheckResult> {
    const token = secrets.HUGGINGFACE_API_TOKEN ?? "";
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const start = Date.now();
    try {
      const res = await fetchWithRetry(
        `${HF_API_BASE}/models?limit=1`,
        { headers },
        { maxRetries: 1 }
      );
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          healthy: false,
          latencyMs,
          message: `HF API returned ${res.status}`,
        };
      }

      return { healthy: true, latencyMs };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;

export const __testables = {
  buildHfApiModelInfoUrl,
  buildHfHeaders,
  buildHfModelPageUrl,
  enrichRecordWithContextWindow,
  extractBaseModelIdsFromModelInfo,
  extractContextWindowFromConfig,
  extractContextWindowFromTokenizerConfig,
  fetchContextWindowForHfId,
  normalizeContextWindow,
  shouldAttemptContextEnrichment,
  transformModel,
};
