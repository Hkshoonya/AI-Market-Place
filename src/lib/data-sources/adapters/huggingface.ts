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

// ────────────────────────────────────────────────────────────────
// Transform a single HF model into our DB record shape
// ────────────────────────────────────────────────────────────────

function transformModel(hf: HFModel): Record<string, unknown> {
  const slug = makeSlug(hf.id);
  const [provider, ...nameParts] = hf.id.split("/");
  const name = nameParts.join("/") || hf.id;
  const category = mapCategory(hf.pipeline_tag);
  const license = mapLicense(hf.tags);
  const paramCount = extractParamCount(hf.tags);

  const isOpenWeights =
    license.type === "open_source" ||
    license.type === "research_only" ||
    hf.tags.includes("open_access");

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
    license: license.type,
    license_name: license.name,
    is_open_weights: isOpenWeights,
    is_api_available: false,
    supported_languages: [],
    modalities: hf.pipeline_tag ? [hf.pipeline_tag] : [],
    capabilities: {},
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
    const totalUpdated = 0;
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
