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
  normalizeModelRankingInputs,
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
const DEFAULT_TOP_CONTEXT_ENRICHMENT_LIMIT = 20;
const DEFAULT_METADATA_GAP_BACKFILL_LIMIT = 25;
const DEFAULT_HISTORICAL_REFRESH_LIMIT = 50;
const DEFAULT_HISTORICAL_REFRESH_AFTER_HOURS = 24 * 7;
const HF_LIST_EXPANSIONS = [
  "author",
  "createdAt",
  "disabled",
  "downloads",
  "gated",
  "lastModified",
  "library_name",
  "likes",
  "pipeline_tag",
  "private",
  "safetensors",
  "tags",
  "trendingScore",
] as const;
const PACKAGED_WEIGHT_REPOSITORY_PATTERN =
  /(?:^|[-_.:/\s])(?:4bit|4-bit|8bit|8-bit|adapter|awq|bnb|exl2|fp4|fp8|gguf|gptq|int4|int8|lora|mlx|nf4|nvfp4|quantized|quantization)(?:$|[-_.:/\s])/i;

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
    "image-text-to-text": "multimodal",
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

/** Convert HF task labels into the input/output modalities users recognize. */
function mapModalities(pipelineTag: string | null): string[] {
  const mapping: Record<string, string[]> = {
    "text-generation": ["text"],
    "text2text-generation": ["text"],
    conversational: ["text"],
    "fill-mask": ["text"],
    summarization: ["text"],
    translation: ["text"],
    "question-answering": ["text"],
    "text-to-image": ["text", "image"],
    "image-to-image": ["image"],
    "image-classification": ["image"],
    "object-detection": ["image"],
    "image-segmentation": ["image"],
    "image-to-text": ["image", "text"],
    "image-text-to-text": ["image", "text"],
    "visual-question-answering": ["image", "text"],
    "document-question-answering": ["image", "text"],
    "feature-extraction": ["text"],
    "sentence-similarity": ["text"],
    "automatic-speech-recognition": ["audio", "text"],
    "text-to-speech": ["text", "audio"],
    "audio-classification": ["audio"],
    "text-to-video": ["text", "video"],
    "video-classification": ["video"],
    "text-to-code": ["text"],
  };

  return mapping[pipelineTag ?? ""] ?? [];
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

interface HFSafetensorsMetadata {
  total?: number | null;
  parameters?: Record<string, number> | null;
}

function isPackagedWeightRepository(hfId: string, tags: string[]): boolean {
  return PACKAGED_WEIGHT_REPOSITORY_PATTERN.test(
    `${hfId} ${tags.join(" ")}`
  );
}

function extractStructuredParamCount(
  hfId: string,
  tags: string[],
  safetensors?: HFSafetensorsMetadata | null
): number | null {
  const taggedCount = extractParamCount(tags);
  if (taggedCount) return taggedCount;

  if (isPackagedWeightRepository(hfId, tags)) return null;

  const total = safetensors?.total;
  if (
    typeof total !== "number" ||
    !Number.isFinite(total) ||
    total < 1_000 ||
    total > 10_000_000_000_000
  ) {
    return null;
  }

  return Math.round(total);
}

function extractParamCountFromModelInfo(
  hfId: string,
  modelInfo: Record<string, unknown>
): number | null {
  const tags = Array.isArray(modelInfo.tags)
    ? modelInfo.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const safetensors =
    modelInfo.safetensors && typeof modelInfo.safetensors === "object"
      ? (modelInfo.safetensors as HFSafetensorsMetadata)
      : null;

  return extractStructuredParamCount(hfId, tags, safetensors);
}

// ────────────────────────────────────────────────────────────────
// HF API response shape
// ────────────────────────────────────────────────────────────────

interface HFModel {
  id: string; // e.g. "meta-llama/Llama-3-70B"
  modelId?: string;
  author?: string;
  sha?: string;
  lastModified?: string;
  private?: boolean;
  disabled?: boolean;
  gated?: boolean | string;
  pipeline_tag?: string | null;
  tags?: string[];
  downloads?: number;
  likes?: number;
  trendingScore?: number;
  library_name?: string;
  createdAt?: string;
  safetensors?: HFSafetensorsMetadata | null;
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
  hf_downloads: number | null;
  hf_likes: number | null;
  hf_trending_score: number | null;
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

interface HfExistingModelRow {
  slug: string;
  name: string;
  provider: string;
  category: string;
  status: string;
  architecture: string | null;
  parameter_count: number | null;
  context_window: number | null;
  hf_model_id: string | null;
  hf_downloads: number;
  hf_likes: number;
  hf_trending_score: number | null;
  license: string | null;
  license_name: string | null;
  is_open_weights: boolean | null;
  is_api_available: boolean;
  supported_languages: string[] | null;
  modalities: string[] | null;
  capabilities: Record<string, unknown> | null;
  website_url: string | null;
  release_date: string | null;
  data_refreshed_at: string | null;
}

const CANONICAL_MODALITIES = new Set(["text", "image", "audio", "video"]);
const HF_CHANGE_COMPARE_FIELDS = [
  "name",
  "provider",
  "category",
  "status",
  "architecture",
  "parameter_count",
  "context_window",
  "hf_model_id",
  "hf_downloads",
  "hf_likes",
  "hf_trending_score",
  "license",
  "license_name",
  "is_open_weights",
  "is_api_available",
  "supported_languages",
  "modalities",
  "capabilities",
  "website_url",
  "release_date",
] as const;

function hasCanonicalModalities(modalities: string[] | null): boolean {
  return Boolean(
    modalities?.length &&
      modalities.every((modality) => CANONICAL_MODALITIES.has(modality))
  );
}

function hasRecordValues(value: Record<string, unknown> | null): boolean {
  return Boolean(value && Object.keys(value).length > 0);
}

function isHfOwnedRow(existing: HfExistingModelRow): boolean {
  if (existing.is_api_available || !existing.hf_model_id) return false;
  return (
    !existing.website_url ||
    existing.website_url.startsWith(`${HF_RAW_BASE}/`)
  );
}

function mergeHfRecordWithExisting(
  record: HfModelRecord,
  existing: HfExistingModelRow | undefined
): HfModelRecord {
  if (!existing) return record;

  const preserveProviderMetadata = !isHfOwnedRow(existing);

  return {
    ...record,
    name: preserveProviderMetadata
      ? existing.name || record.name
      : record.name,
    provider: preserveProviderMetadata
      ? existing.provider || record.provider
      : record.provider,
    category:
      preserveProviderMetadata &&
      existing.category &&
      existing.category !== "specialized"
        ? existing.category
        : record.category,
    status:
      record.status === "archived" || !preserveProviderMetadata
        ? record.status
        : existing.status,
    architecture: preserveProviderMetadata
      ? existing.architecture ?? record.architecture
      : record.architecture ?? existing.architecture,
    parameter_count: record.parameter_count ?? existing.parameter_count,
    context_window: existing.context_window ?? record.context_window,
    hf_model_id: record.hf_model_id ?? existing.hf_model_id,
    license: preserveProviderMetadata
      ? existing.license ?? record.license
      : record.license,
    license_name: preserveProviderMetadata
      ? existing.license_name ?? record.license_name
      : record.license_name,
    is_open_weights: preserveProviderMetadata
      ? existing.is_open_weights ?? record.is_open_weights
      : record.is_open_weights,
    is_api_available: existing.is_api_available,
    supported_languages:
      existing.supported_languages?.length
        ? existing.supported_languages
        : record.supported_languages,
    modalities: hasCanonicalModalities(existing.modalities)
      ? existing.modalities ?? []
      : record.modalities,
    capabilities: hasRecordValues(existing.capabilities)
      ? existing.capabilities ?? {}
      : record.capabilities,
    website_url: existing.website_url ?? record.website_url,
    release_date: existing.release_date ?? record.release_date,
    data_refreshed_at:
      existing.data_refreshed_at ?? record.data_refreshed_at,
  };
}

function stableHfJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableHfJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableHfJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function hasMeaningfulCounterChange(
  previous: number | null | undefined,
  next: number | null | undefined,
  minimumDelta: number
): boolean {
  const previousValue = Number(previous ?? 0);
  const nextValue = Number(next ?? 0);
  const threshold = Math.max(minimumDelta, Math.abs(previousValue) * 0.01);
  return Math.abs(nextValue - previousValue) >= threshold;
}

function hfRecordChanged(
  existing: HfExistingModelRow,
  candidate: HfModelRecord
): boolean {
  return HF_CHANGE_COMPARE_FIELDS.some((field) => {
    if (field === "hf_downloads") {
      return hasMeaningfulCounterChange(
        existing.hf_downloads,
        candidate.hf_downloads,
        25
      );
    }
    if (field === "hf_likes") {
      return hasMeaningfulCounterChange(existing.hf_likes, candidate.hf_likes, 1);
    }
    if (field === "hf_trending_score") {
      return hasMeaningfulCounterChange(
        existing.hf_trending_score,
        candidate.hf_trending_score,
        0.5
      );
    }

    return (
      stableHfJson(existing[field] ?? null) !==
      stableHfJson(candidate[field] ?? null)
    );
  });
}

function normalizeHfRecordForUpsert(record: HfModelRecord): HfModelRecord {
  return normalizeModelRankingInputs(record) as HfModelRecord;
}

async function fetchExistingHfRows(
  ctx: SyncContext,
  slugs: string[]
): Promise<Map<string, HfExistingModelRow>> {
  if (slugs.length === 0) return new Map();

  const { data, error } = await ctx.supabase
    .from("models")
    .select(
      "slug, name, provider, category, status, architecture, parameter_count, context_window, hf_model_id, hf_downloads, hf_likes, hf_trending_score, license, license_name, is_open_weights, is_api_available, supported_languages, modalities, capabilities, website_url, release_date, data_refreshed_at"
    )
    .in("slug", slugs);

  if (error) {
    throw new Error(`Failed to fetch existing HF rows: ${error.message}`);
  }

  return new Map(
    ((data ?? []) as HfExistingModelRow[]).map((row) => [row.slug, row])
  );
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

function buildHfListUrl(limit: number, cursor?: string) {
  const params = new URLSearchParams({
    limit: String(limit),
    sort: "trendingScore",
    direction: "-1",
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  for (const field of HF_LIST_EXPANSIONS) {
    params.append("expand", field);
  }

  return `${HF_API_BASE}/models?${params.toString()}`;
}

function extractNextHfPageUrl(linkHeader: string | null): string | null {
  const nextMatch = linkHeader?.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
  if (!nextMatch?.[1]) return null;

  try {
    const nextUrl = new URL(nextMatch[1]);
    if (
      nextUrl.origin !== HF_RAW_BASE ||
      nextUrl.pathname !== "/api/models"
    ) {
      return null;
    }
    return nextUrl.toString();
  } catch {
    return null;
  }
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

type HfModelInfoLookup = {
  status: number;
  data: Record<string, unknown> | null;
};

async function fetchHfModelInfoLookup(
  hfId: string,
  signal?: AbortSignal,
  token?: string
): Promise<HfModelInfoLookup> {
  const res = await fetchWithRetry(
    buildHfApiModelInfoUrl(hfId),
    {
      headers: buildHfHeaders(token),
      signal,
    },
    { signal, maxRetries: 1, baseDelayMs: 400 }
  );

  if (!res.ok) {
    return {
      status: res.status,
      data: null,
    };
  }

  try {
    return {
      status: res.status,
      data: (await res.json()) as Record<string, unknown>,
    };
  } catch {
    return {
      status: res.status,
      data: null,
    };
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
): Promise<{ repositoryMissing: boolean }> {
  const hfModelId = record.hf_model_id;
  if (!hfModelId) return { repositoryMissing: false };

  if (!record.website_url) {
    record.website_url = buildHfModelPageUrl(hfModelId);
  }

  if (!shouldAttemptContextEnrichment(record, options)) {
    return { repositoryMissing: false };
  }

  const directContext = await fetchContextWindowForHfId(
    hfModelId,
    signal,
    options?.token
  );

  if (directContext) {
    record.context_window = directContext;
    return { repositoryMissing: false };
  }

  const modelInfoLookup = await fetchHfModelInfoLookup(
    hfModelId,
    signal,
    options?.token
  );

  if (modelInfoLookup.status === 404) {
    return { repositoryMissing: true };
  }

  const baseModelIds = extractBaseModelIdsFromModelInfo(modelInfoLookup.data).filter(
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
      return { repositoryMissing: false };
    }
  }

  return { repositoryMissing: false };
}

async function enrichRecordsWithOfficialContextWindow(
  records: HfModelRecord[],
  signal?: AbortSignal,
  token?: string,
  limit = DEFAULT_TOP_CONTEXT_ENRICHMENT_LIMIT
) {
  const candidates = records
    .filter((record) => shouldAttemptContextEnrichment(record))
    .slice(0, Math.max(0, limit));

  for (let index = 0; index < candidates.length; index += HF_CONTEXT_FETCH_CONCURRENCY) {
    await Promise.all(
      candidates
        .slice(index, index + HF_CONTEXT_FETCH_CONCURRENCY)
        .map((record) =>
          enrichRecordWithContextWindow(record, signal, { token })
      )
    );
  }

  return {
    attempted: candidates.length,
    enriched: candidates.filter((record) => Boolean(record.context_window)).length,
  };
}

interface HfMetadataGapRow {
  slug: string;
  provider: string;
  category: string;
  hf_model_id: string | null;
  context_window: number | null;
  website_url: string | null;
  data_refreshed_at: string | null;
}

function shouldBackfillGapRow(row: HfMetadataGapRow) {
  return (
    Boolean(row.hf_model_id) &&
    (!row.website_url ||
      (!row.context_window && CONTEXT_ELIGIBLE_CATEGORIES.has(row.category)))
  );
}

async function fetchMetadataGapRows(ctx: SyncContext, limit: number) {
  if (limit <= 0) return [];
  const rows: HfMetadataGapRow[] = [];

  for (let from = 0; ; from += GAP_FETCH_PAGE_SIZE) {
    const to = from + GAP_FETCH_PAGE_SIZE - 1;
    const { data, error } = await ctx.supabase
      .from("models")
      .select(
        "slug, provider, category, hf_model_id, context_window, website_url, data_refreshed_at"
      )
      .eq("status", "active")
      .not("hf_model_id", "is", null)
      .order("data_refreshed_at", { ascending: true, nullsFirst: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch HF metadata gap rows: ${error.message}`);
    }

    const page = ((data ?? []) as HfMetadataGapRow[]).filter(shouldBackfillGapRow);
    rows.push(...page.slice(0, limit - rows.length));

    if (
      rows.length >= limit ||
      (data ?? []).length < GAP_FETCH_PAGE_SIZE
    ) {
      break;
    }
  }

  return rows;
}

async function backfillHfMetadataGaps(
  ctx: SyncContext,
  limit = DEFAULT_METADATA_GAP_BACKFILL_LIMIT
): Promise<{
  attempted: number;
  updated: number;
  enriched: number;
  errors: SyncError[];
}> {
  const rows = await fetchMetadataGapRows(ctx, limit);
  const errors: SyncError[] = [];
  let updated = 0;
  let enriched = 0;

  for (let index = 0; index < rows.length; index += HF_CONTEXT_FETCH_CONCURRENCY) {
    if (ctx.signal?.aborted) {
      errors.push({
        message: "HF metadata gap backfill aborted by signal",
        context: `checked=${updated}`,
      });
      break;
    }

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
          const enrichment = await enrichRecordWithContextWindow(
            patch,
            ctx.signal,
            {
              allowAnyProvider: true,
              token: ctx.secrets.HUGGINGFACE_API_TOKEN ?? "",
            }
          );

          const materiallyChanged =
            patch.context_window !== row.context_window ||
            patch.website_url !== row.website_url ||
            enrichment.repositoryMissing;

          const updatePatch: Record<string, string | number | null> = {
            data_refreshed_at: patch.data_refreshed_at,
          };

          if (patch.context_window !== row.context_window) {
            updatePatch.context_window = patch.context_window ?? null;
          }
          if (patch.website_url !== row.website_url) {
            updatePatch.website_url = patch.website_url ?? null;
          }

          if (enrichment.repositoryMissing) {
            updatePatch.status = "archived";
          }

          const { error } = await ctx.supabase
            .from("models")
            .update(updatePatch)
            .eq("slug", row.slug);

          if (error) {
            errors.push({
              message: `Failed to backfill HF metadata gap: ${error.message}`,
              context: `slug=${row.slug}`,
            });
            return;
          }

          updated += 1;
          if (materiallyChanged) enriched += 1;
        } catch (error) {
          if (!ctx.signal?.aborted) {
            errors.push({
              message:
                error instanceof Error ? error.message : String(error),
              context: `slug=${row.slug}`,
            });
          }
        }
      })
    );
  }

  return { attempted: rows.length, updated, enriched, errors };
}

interface HfHistoricalRefreshRow {
  slug: string;
  hf_model_id: string | null;
  parameter_count: number | null;
  data_refreshed_at: string | null;
}

interface HfHistoricalRefreshResult {
  attempted: number;
  updated: number;
  archived: number;
  skipped: number;
  warnings: SyncError[];
  errors: SyncError[];
}

function isOlderThanHours(value: string | null, hours: number) {
  if (!value) return true;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return true;
  return timestamp < Date.now() - hours * 60 * 60 * 1000;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readReleaseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().split("T")[0] : null;
}

async function refreshHistoricalHfModels(
  ctx: SyncContext,
  options: { limit: number; refreshAfterHours: number }
): Promise<HfHistoricalRefreshResult> {
  const result: HfHistoricalRefreshResult = {
    attempted: 0,
    updated: 0,
    archived: 0,
    skipped: 0,
    warnings: [],
    errors: [],
  };

  if (options.limit <= 0) return result;

  const { data, error } = await ctx.supabase
    .from("models")
    .select("slug, hf_model_id, parameter_count, data_refreshed_at")
    .eq("status", "active")
    .not("hf_model_id", "is", null)
    .order("data_refreshed_at", { ascending: true, nullsFirst: true })
    .limit(options.limit);

  if (error) {
    throw new Error(`Failed to fetch stale HF models: ${error.message}`);
  }

  const rows = ((data ?? []) as HfHistoricalRefreshRow[]).filter((row) =>
    isOlderThanHours(row.data_refreshed_at, options.refreshAfterHours)
  );
  result.attempted = rows.length;

  for (let index = 0; index < rows.length; index += HF_CONTEXT_FETCH_CONCURRENCY) {
    await Promise.all(
      rows.slice(index, index + HF_CONTEXT_FETCH_CONCURRENCY).map(async (row) => {
        const hfModelId = row.hf_model_id;
        if (!hfModelId) {
          result.skipped += 1;
          return;
        }

        let lookup: HfModelInfoLookup;
        try {
          lookup = await fetchHfModelInfoLookup(
            hfModelId,
            ctx.signal,
            ctx.secrets.HUGGINGFACE_API_TOKEN ?? ""
          );
        } catch (error) {
          result.skipped += 1;
          result.warnings.push({
            message: error instanceof Error ? error.message : String(error),
            context: `historical-refresh:${row.slug}`,
          });
          return;
        }

        const refreshedAt = new Date().toISOString();
        if (lookup.status === 404 || lookup.status === 410) {
          const { error: updateError } = await ctx.supabase
            .from("models")
            .update({ status: "archived", data_refreshed_at: refreshedAt })
            .eq("slug", row.slug);

          if (updateError) {
            result.errors.push({
              message: `Failed to archive missing HF repository: ${updateError.message}`,
              context: `historical-refresh:${row.slug}`,
            });
            return;
          }

          result.updated += 1;
          result.archived += 1;
          return;
        }

        if (!lookup.data || lookup.status < 200 || lookup.status >= 300) {
          result.skipped += 1;
          result.warnings.push({
            message: `HF model lookup returned HTTP ${lookup.status}`,
            context: `historical-refresh:${row.slug}`,
          });
          return;
        }

        const patch: Record<string, string | number> = {
          website_url: buildHfModelPageUrl(hfModelId),
          data_refreshed_at: refreshedAt,
        };
        const downloads = readFiniteNumber(lookup.data.downloads);
        const likes = readFiniteNumber(lookup.data.likes);
        const trendingScore = readFiniteNumber(lookup.data.trendingScore);
        const releaseDate = readReleaseDate(lookup.data.createdAt);
        const parameterCount = extractParamCountFromModelInfo(
          hfModelId,
          lookup.data
        );

        if (downloads !== null) patch.hf_downloads = downloads;
        if (likes !== null) patch.hf_likes = likes;
        if (trendingScore !== null) patch.hf_trending_score = trendingScore;
        if (row.parameter_count === null && parameterCount !== null) {
          patch.parameter_count = parameterCount;
        }
        if (typeof lookup.data.library_name === "string" && lookup.data.library_name) {
          patch.architecture = lookup.data.library_name;
        }
        if (releaseDate) patch.release_date = releaseDate;
        if (lookup.data.disabled === true) patch.status = "archived";

        const { error: updateError } = await ctx.supabase
          .from("models")
          .update(patch)
          .eq("slug", row.slug);

        if (updateError) {
          result.errors.push({
            message: `Failed to refresh historical HF model: ${updateError.message}`,
            context: `historical-refresh:${row.slug}`,
          });
          return;
        }

        result.updated += 1;
        if (patch.status === "archived") result.archived += 1;
      })
    );
  }

  return result;
}

// ────────────────────────────────────────────────────────────────
// Transform a single HF model into our DB record shape
// ────────────────────────────────────────────────────────────────

function transformModel(hf: HFModel): HfModelRecord {
  const slug = makeSlug(hf.id);
  const [provider, ...nameParts] = hf.id.split("/");
  const name = nameParts.join("/") || hf.id;
  const pipelineTag = hf.pipeline_tag ?? null;
  const tags = hf.tags ?? [];
  const category = mapCategory(pipelineTag);
  const license = mapLicense(tags);
  const paramCount = extractStructuredParamCount(
    hf.id,
    tags,
    hf.safetensors
  );

  const isOpenWeights =
    license.type === "open_source" ||
    license.type === "research_only" ||
    inferOpenWeightsFromHfModel(hf.id, tags);
  const resolvedLicense =
    isOpenWeights && license.type === "commercial"
      ? { type: "open_source", name: "Open weights" }
      : license;

  return {
    slug,
    name,
    provider: getCanonicalProviderName(provider || "unknown"),
    category,
    status: hf.disabled === true ? "archived" : "active",
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
    modalities: mapModalities(pipelineTag),
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
    topContextEnrichmentLimit: DEFAULT_TOP_CONTEXT_ENRICHMENT_LIMIT,
    metadataGapBackfillLimit: DEFAULT_METADATA_GAP_BACKFILL_LIMIT,
    historicalRefreshLimit: DEFAULT_HISTORICAL_REFRESH_LIMIT,
    historicalRefreshAfterHours: DEFAULT_HISTORICAL_REFRESH_AFTER_HOURS,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxPages = (ctx.config.maxPages as number) ?? 50;
    const pageSize = (ctx.config.pageSize as number) ?? 100;
    const rateLimitDelayMs = (ctx.config.rateLimitDelayMs as number) ?? 200;
    const topContextEnrichmentLimit = Math.min(
      100,
      Math.max(
        0,
        Math.floor(
          typeof ctx.config.topContextEnrichmentLimit === "number"
            ? ctx.config.topContextEnrichmentLimit
            : DEFAULT_TOP_CONTEXT_ENRICHMENT_LIMIT
        )
      )
    );
    const metadataGapBackfillLimit = Math.min(
      100,
      Math.max(
        0,
        Math.floor(
          typeof ctx.config.metadataGapBackfillLimit === "number"
            ? ctx.config.metadataGapBackfillLimit
            : DEFAULT_METADATA_GAP_BACKFILL_LIMIT
        )
      )
    );
    const historicalRefreshLimit = Math.min(
      200,
      Math.max(
        0,
        Math.floor(
          typeof ctx.config.historicalRefreshLimit === "number"
            ? ctx.config.historicalRefreshLimit
            : DEFAULT_HISTORICAL_REFRESH_LIMIT
        )
      )
    );
    const historicalRefreshAfterHours = Math.max(
      1,
      typeof ctx.config.historicalRefreshAfterHours === "number"
        ? ctx.config.historicalRefreshAfterHours
        : DEFAULT_HISTORICAL_REFRESH_AFTER_HOURS
    );
    const token = ctx.secrets.HUGGINGFACE_API_TOKEN ?? "";

    const rateLimitedFetch = createRateLimitedFetch(rateLimitDelayMs);

    const headers = buildHfHeaders(token);

    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let topRecordsCreated = 0;
    let topRecordsUpdated = 0;
    let topRecordsUnchanged = 0;
    let pagesAttempted = 0;
    let pagesFetched = 0;
    let topContextAttempted = 0;
    let topContextEnriched = 0;
    let gapBackfillAttempted = 0;
    let gapRowsUpdated = 0;
    let gapBackfilled = 0;
    let historicalRefresh: HfHistoricalRefreshResult = {
      attempted: 0,
      updated: 0,
      archived: 0,
      skipped: 0,
      warnings: [],
      errors: [],
    };
    const errors: SyncError[] = [];
    const seenModelIds = new Set<string>();
    let nextPageUrl: string | null = buildHfListUrl(pageSize);

    for (let page = 0; page < maxPages; page++) {
      // Respect abort signal
      if (ctx.signal?.aborted) {
        errors.push({ message: "Sync aborted by signal", context: `page=${page}` });
        break;
      }

      try {
        if (!nextPageUrl) break;
        const url = nextPageUrl;
        pagesAttempted += 1;

        const res = await rateLimitedFetch(url, { headers }, ctx.signal);

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          errors.push({
            message: `HF API returned ${res.status}: ${body.slice(0, 200)}`,
            context: `page=${page}`,
          });
          // Cursor pagination cannot safely skip a failed page.
          break;
        }

        const models: HFModel[] = await res.json();
        pagesFetched += 1;
        const linkedNextPageUrl = extractNextHfPageUrl(res.headers.get("link"));

        // No more results -- we've exhausted the list
        if (models.length === 0) {
          break;
        }

        const uniqueModels = models.filter((model) => {
          if (seenModelIds.has(model.id)) return false;
          seenModelIds.add(model.id);
          return true;
        });

        if (uniqueModels.length === 0) {
          errors.push({
            message: "HF cursor returned a page with no new model IDs",
            context: `page=${page}`,
          });
          break;
        }

        // Filter out private / disabled models and transform
        const transformedRecords = uniqueModels
          .filter((m) => !m.private && !m.disabled)
          .map(transformModel);

        const existingBySlug = await fetchExistingHfRows(
          ctx,
          transformedRecords.map((record) => record.slug)
        );
        const mergedRecords = transformedRecords.map((record) =>
          mergeHfRecordWithExisting(record, existingBySlug.get(record.slug))
        );

        const contextResult = await enrichRecordsWithOfficialContextWindow(
          mergedRecords.filter(
            (record) => !existingBySlug.has(record.slug)
          ),
          ctx.signal,
          token,
          topContextEnrichmentLimit - topContextAttempted
        );
        topContextAttempted += contextResult.attempted;
        topContextEnriched += contextResult.enriched;
        const records = mergedRecords.map(normalizeHfRecordForUpsert);

        totalProcessed += uniqueModels.length;

        if (records.length > 0) {
          const changedAt = new Date().toISOString();
          const newRecords = records
            .filter((record) => !existingBySlug.has(record.slug))
            .map((record) => ({ ...record, data_refreshed_at: changedAt }));
          const updatedRecords = records
            .filter((record) => {
              const existing = existingBySlug.get(record.slug);
              return existing ? hfRecordChanged(existing, record) : false;
            })
            .map((record) => ({ ...record, data_refreshed_at: changedAt }));

          const newResult = await upsertBatch(
            ctx.supabase,
            "models",
            newRecords,
            "slug"
          );
          totalCreated += newResult.created;
          topRecordsCreated += newResult.created;
          errors.push(...newResult.errors);

          const updateResult = await upsertBatch(
            ctx.supabase,
            "models",
            updatedRecords,
            "slug"
          );
          totalUpdated += updateResult.created;
          topRecordsUpdated += updateResult.created;
          topRecordsUnchanged += Math.max(
            0,
            records.length - newRecords.length - updatedRecords.length
          );
          errors.push(...updateResult.errors);
        }

        // Progress tracked via SyncResult metadata

        nextPageUrl = linkedNextPageUrl;

        // The Link header is authoritative; a short page is also terminal.
        if (models.length < pageSize || !nextPageUrl) {
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ message: msg, context: `page=${page}` });
        // Cursor pagination cannot safely advance after a failed page.
        break;
      }
    }

    try {
      historicalRefresh = await refreshHistoricalHfModels(ctx, {
        limit: historicalRefreshLimit,
        refreshAfterHours: historicalRefreshAfterHours,
      });
      totalProcessed += historicalRefresh.attempted;
      totalUpdated += historicalRefresh.updated;
      errors.push(...historicalRefresh.errors);
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : String(error),
        context: "hf-historical-refresh",
      });
    }

    try {
      const gapBackfill = await backfillHfMetadataGaps(
        ctx,
        metadataGapBackfillLimit
      );
      gapBackfillAttempted = gapBackfill.attempted;
      gapRowsUpdated = gapBackfill.updated;
      gapBackfilled = gapBackfill.enriched;
      totalUpdated += gapRowsUpdated;
      errors.push(...gapBackfill.errors);
    } catch (error) {
      errors.push({
        message:
          error instanceof Error ? error.message : String(error),
        context: "hf-gap-backfill",
      });
    }

    const nothingProcessed = totalProcessed === 0;

    return {
      success: !nothingProcessed && errors.length === 0,
      recordsProcessed: totalProcessed,
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
      errors,
      metadata: {
        maxPages,
        pageSize,
        pagesAttempted,
        pagesFetched,
        uniqueTopModels: seenModelIds.size,
        topContextAttempted,
        topContextEnriched,
        gapBackfillAttempted,
        gapRowsUpdated,
        gapBackfilled,
        historicalRefreshAttempted: historicalRefresh.attempted,
        historicalRefreshed: historicalRefresh.updated,
        historicalArchived: historicalRefresh.archived,
        historicalSkipped: historicalRefresh.skipped,
        historicalWarnings: historicalRefresh.warnings,
        topRecordsCreated,
        topRecordsUpdated,
        topRecordsUnchanged,
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
  backfillHfMetadataGaps,
  buildHfApiModelInfoUrl,
  buildHfHeaders,
  buildHfListUrl,
  buildHfModelPageUrl,
  enrichRecordWithContextWindow,
  extractBaseModelIdsFromModelInfo,
  extractContextWindowFromConfig,
  extractContextWindowFromTokenizerConfig,
  extractNextHfPageUrl,
  extractParamCountFromModelInfo,
  extractStructuredParamCount,
  fetchExistingHfRows,
  fetchHfModelInfoLookup,
  fetchContextWindowForHfId,
  hfRecordChanged,
  mergeHfRecordWithExisting,
  normalizeHfRecordForUpsert,
  normalizeContextWindow,
  mapCategory,
  mapModalities,
  refreshHistoricalHfModels,
  shouldAttemptContextEnrichment,
  transformModel,
};
