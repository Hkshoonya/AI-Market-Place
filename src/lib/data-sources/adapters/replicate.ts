/**
 * Replicate Adapter
 *
 * Fetches models from the Replicate API using cursor-based pagination,
 * infers categories from descriptions, and upserts into Supabase.
 *
 * When REPLICATE_API_TOKEN is not provided, falls back to KNOWN_MODELS
 * static list so the adapter always produces useful data.
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
import { REPLICATE_KNOWN_MODELS, type KnownReplicateModel } from "../shared/known-models/replicate";
import { inferCategory } from "../shared/infer-category";
import { getCanonicalProviderName } from "@/lib/constants/providers";

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

// ────────────────────────────────────────────────────────────────
// Static fallback — top popular Replicate models (imported from shared data file)
// ────────────────────────────────────────────────────────────────

// REPLICATE_KNOWN_MODELS and KnownReplicateModel are imported above from
// src/lib/data-sources/shared/known-models/replicate.ts

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
// Transform a single Replicate model into our DB record shape
// ────────────────────────────────────────────────────────────────

function transformModel(model: ReplicateModel): Record<string, unknown> {
  const fullName = `${model.owner}/${model.name}`;
  const slug = makeSlug(fullName);
  const category = inferCategory({ mode: "description", description: model.description });

  return {
    slug,
    name: model.name,
    provider: getCanonicalProviderName(model.owner),
    category,
    description: model.description || null,
    status: "active",
    hf_downloads: model.run_count || 0, // store run_count as popularity metric
    is_api_available: true, // Replicate hosts runnable models
    is_open_weights: model.visibility === "public",
    release_date: model.latest_version?.created_at
      ? model.latest_version.created_at.split("T")[0]
      : null,
    data_refreshed_at: new Date().toISOString(),
    modalities: [],
    capabilities: {},
    supported_languages: [],
  };
}

/** Transform a REPLICATE_KNOWN_MODELS entry into our DB record shape. */
function transformKnownModel(model: KnownReplicateModel): Record<string, unknown> {
  const fullName = `${model.owner}/${model.name}`;
  const slug = makeSlug(fullName);

  return {
    slug,
    name: model.name,
    provider: getCanonicalProviderName(model.owner),
    category: model.category,
    description: model.description || null,
    status: "active",
    hf_downloads: model.run_count || 0,
    is_api_available: true,
    is_open_weights: model.is_open_weights,
    release_date: null,
    data_refreshed_at: new Date().toISOString(),
    modalities: [],
    capabilities: {},
    supported_languages: [],
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
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxPages = (ctx.config.maxPages as number) ?? 10;
    const rateLimitDelayMs = (ctx.config.rateLimitDelayMs as number) ?? 250;
    const token = ctx.secrets.REPLICATE_API_TOKEN;

    // ── Static fallback path (no token provided) ──────────────────
    if (!token) {
      const records = REPLICATE_KNOWN_MODELS.map(transformKnownModel);

      let totalCreated = 0;
      const errors: SyncError[] = [];

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

      return {
        success: true,
        recordsProcessed: records.length,
        recordsCreated: totalCreated,
        recordsUpdated: 0,
        errors,
        metadata: {
          source: "static_fallback",
          modelCount: records.length,
        },
      };
    }

    // ── Live API path (token provided) ────────────────────────────
    const rateLimitedFetch = createRateLimitedFetch(rateLimitDelayMs);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    let totalProcessed = 0;
    let totalCreated = 0;
    const totalUpdated = 0;
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

        // Progress tracked via SyncResult metadata

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
        source: "live_api",
        maxPages,
        pagesFetched: page,
      },
    };
  },

  async healthCheck(secrets: Record<string, string>): Promise<HealthCheckResult> {
    const token = secrets.REPLICATE_API_TOKEN;
    if (!token) {
      // Without a token, the static fallback is always healthy
      return {
        healthy: true,
        latencyMs: 0,
        message: "No token — using static fallback data",
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
