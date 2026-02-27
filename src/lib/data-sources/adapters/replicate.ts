/**
 * Replicate Adapter
 *
 * Fetches models from the Replicate API using cursor-based pagination,
 * infers categories from descriptions, and upserts into Supabase.
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

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

// ────────────────────────────────────────────────────────────────
// Replicate API response shapes
// ────────────────────────────────────────────────────────────────

interface ReplicateModel {
  url: string;
  owner: string;
  name: string;
  description: string | null;
  visibility: string;
  run_count: number;
  cover_image_url: string | null;
  latest_version: {
    id: string;
    created_at: string;
    cog_version: string;
    openapi_schema: unknown;
  } | null;
}

interface ReplicateListResponse {
  results: ReplicateModel[];
  next: string | null; // full cursor URL for next page
  previous: string | null;
}

// ────────────────────────────────────────────────────────────────
// Category inference from description keywords
// ────────────────────────────────────────────────────────────────

/** Infer our internal category from a Replicate model's description. */
function inferCategory(description: string | null): string {
  if (!description) return "specialized";

  const desc = description.toLowerCase();

  // Order matters -- more specific checks first
  if (
    desc.includes("text-to-video") ||
    desc.includes("video generation") ||
    desc.includes("video synthesis") ||
    desc.includes("animate")
  ) {
    return "video";
  }

  if (
    desc.includes("text-to-image") ||
    desc.includes("image generation") ||
    desc.includes("stable diffusion") ||
    desc.includes("diffusion model") ||
    desc.includes("generate image") ||
    desc.includes("img2img") ||
    desc.includes("image-to-image") ||
    desc.includes("inpainting")
  ) {
    return "image_generation";
  }

  if (
    desc.includes("object detection") ||
    desc.includes("image classification") ||
    desc.includes("image segmentation") ||
    desc.includes("image recognition") ||
    desc.includes("visual")
  ) {
    return "vision";
  }

  if (
    desc.includes("text-to-speech") ||
    desc.includes("speech-to-text") ||
    desc.includes("speech recognition") ||
    desc.includes("audio generation") ||
    desc.includes("music generation") ||
    desc.includes("voice clone") ||
    desc.includes("tts") ||
    desc.includes("asr")
  ) {
    return "speech_audio";
  }

  if (
    desc.includes("embedding") ||
    desc.includes("sentence similarity") ||
    desc.includes("vector")
  ) {
    return "embeddings";
  }

  if (
    desc.includes("multimodal") ||
    desc.includes("vision language") ||
    desc.includes("image and text")
  ) {
    return "multimodal";
  }

  if (
    desc.includes("code generation") ||
    desc.includes("code completion") ||
    desc.includes("programming")
  ) {
    return "code";
  }

  if (
    desc.includes("language model") ||
    desc.includes("llm") ||
    desc.includes("text generation") ||
    desc.includes("chat") ||
    desc.includes("conversational") ||
    desc.includes("instruction") ||
    desc.includes("gpt") ||
    desc.includes("llama") ||
    desc.includes("mistral")
  ) {
    return "llm";
  }

  return "specialized";
}

// ────────────────────────────────────────────────────────────────
// Transform a single Replicate model into our DB record shape
// ────────────────────────────────────────────────────────────────

function transformModel(model: ReplicateModel): Record<string, unknown> {
  const fullName = `${model.owner}/${model.name}`;
  const slug = makeSlug(fullName);
  const category = inferCategory(model.description);

  return {
    slug,
    name: model.name,
    provider: model.owner,
    category,
    description: model.description || null,
    status: "active",
    hf_downloads: model.run_count || 0, // store run_count as popularity metric
    is_api_available: true, // Replicate hosts runnable models
    is_open_weights: model.visibility === "public",
    cover_image_url: model.cover_image_url || null,
    release_date: model.latest_version?.created_at
      ? model.latest_version.created_at.split("T")[0]
      : null,
    data_refreshed_at: new Date().toISOString(),
    modalities: JSON.stringify([]),
    capabilities: JSON.stringify({}),
    supported_languages: JSON.stringify([]),
  };
}

// ────────────────────────────────────────────────────────────────
// Adapter implementation
// ────────────────────────────────────────────────────────────────

const adapter: DataSourceAdapter = {
  id: "replicate",
  name: "Replicate",
  outputTypes: ["models"],
  defaultConfig: {
    maxPages: 10,
    rateLimitDelayMs: 250,
  },
  requiredSecrets: ["REPLICATE_API_TOKEN"],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxPages = (ctx.config.maxPages as number) ?? 10;
    const rateLimitDelayMs = (ctx.config.rateLimitDelayMs as number) ?? 250;
    const token = ctx.secrets.REPLICATE_API_TOKEN;

    if (!token) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: [{ message: "REPLICATE_API_TOKEN is required but was not provided" }],
      };
    }

    const rateLimitedFetch = createRateLimitedFetch(rateLimitDelayMs);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    const errors: SyncError[] = [];

    // First page URL; subsequent pages use the cursor URL from `next`
    let nextUrl: string | null = `${REPLICATE_API_BASE}/models`;
    let page = 0;

    while (nextUrl && page < maxPages) {
      // Respect abort signal
      if (ctx.signal?.aborted) {
        errors.push({ message: "Sync aborted by signal", context: `page=${page}` });
        break;
      }

      try {
        const res = await rateLimitedFetch(nextUrl, { headers }, ctx.signal);

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          errors.push({
            message: `Replicate API returned ${res.status}: ${body.slice(0, 200)}`,
            context: `page=${page}, url=${nextUrl}`,
          });
          // Stop on auth errors
          if (res.status === 401 || res.status === 403) {
            break;
          }
          // Attempt next page if cursor is available from a previous iteration
          // Since we can't get `next` from a failed response, we must stop
          break;
        }

        const data: ReplicateListResponse = await res.json();
        const models = data.results ?? [];

        if (models.length === 0) {
          break;
        }

        // Filter to public models only and transform
        const records = models
          .filter((m) => m.visibility === "public")
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

        console.log(
          `[replicate] Page ${page + 1}/${maxPages}: fetched ${models.length}, upserted ${records.length} (total processed: ${totalProcessed})`
        );

        // Advance to next cursor page
        nextUrl = data.next ?? null;
        page++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ message: msg, context: `page=${page}` });
        // On a network error we can't reliably continue because we don't
        // know the next cursor, so stop here.
        break;
      }
    }

    const nothingProcessed = totalProcessed === 0;

    return {
      success: !nothingProcessed,
      recordsProcessed: totalProcessed,
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
      errors,
      cursor: nextUrl ?? undefined,
      metadata: {
        maxPages,
        pagesFetched: page,
      },
    };
  },

  async healthCheck(secrets: Record<string, string>): Promise<HealthCheckResult> {
    const token = secrets.REPLICATE_API_TOKEN;
    if (!token) {
      return {
        healthy: false,
        latencyMs: 0,
        message: "REPLICATE_API_TOKEN not provided",
      };
    }

    const start = Date.now();
    try {
      const res = await fetchWithRetry(
        `${REPLICATE_API_BASE}/models?limit=1`,
        { headers: { Authorization: `Bearer ${token}` } },
        { maxRetries: 1 }
      );
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          healthy: false,
          latencyMs,
          message: `Replicate API returned ${res.status}`,
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
