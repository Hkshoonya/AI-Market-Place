/**
 * createAdapterSyncer() — generic factory for the static → scrape → API → upsert
 * sync pipeline shared by the anthropic, openai, and google model adapters.
 *
 * Each adapter provides its own:
 *   - Static known model IDs (from shared data files)
 *   - A bound buildRecord function (pre-filled with provider defaults)
 *   - Provider-specific scrape and API fetch functions (injected)
 *   - An enrichFn that applies API results to the record map
 *   - Health-check configuration
 *
 * The factory returns { sync, healthCheck } matching the DataSourceAdapter contract.
 */

import type {
  SyncContext,
  SyncResult,
  HealthCheckResult,
} from "../types";
import { upsertBatch, fetchWithRetry } from "../utils";
import type { KnownModelMeta } from "./build-record";

// ---------------------------------------------------------------------------
// Configuration interface
// ---------------------------------------------------------------------------

/**
 * Configuration object accepted by createAdapterSyncer().
 *
 * TApiResult is the type returned by the provider's live API fetch function
 * (e.g. Map<string, AnthropicModelMeta>, string[], etc.).
 */
export interface AdapterSyncerConfig<TApiResult> {
  /** Env var name for the API key (e.g. "ANTHROPIC_API_KEY"). */
  apiKeySecret: string;

  /** Human-readable source name pushed to metadata.sources (e.g. "anthropic_api"). */
  apiSourceName: string;

  /** All static model IDs from the provider's known-models data file. */
  knownModelIds: string[];

  /**
   * Bound buildRecord call — receives a modelId and optional overrides,
   * returns a normalized DB record.
   */
  buildRecordFn: (
    modelId: string,
    overrides?: Partial<KnownModelMeta>
  ) => Record<string, unknown>;

  /** Total count of static known models — used in healthCheck message. */
  staticModelCount: number;

  /**
   * Attempt to scrape the provider's public docs page for model IDs.
   * Returns an empty array on failure (never throws).
   */
  scrapeFn: (signal?: AbortSignal) => Promise<string[]>;

  /**
   * Attempt to fetch live model data from the provider's API.
   * Returns null on any failure so the factory can fall back gracefully.
   */
  apiFn: (
    apiKey: string,
    signal?: AbortSignal
  ) => Promise<TApiResult | null>;

  /**
   * Enrich the record map with data from the API result.
   * Called only when apiFn returns a non-null result.
   *
   * Responsible for:
   *   - Adding new models found in API but not in recordMap
   *   - Updating fields (display_name, data_refreshed_at, context_window, etc.)
   */
  enrichFn: (
    recordMap: Map<string, Record<string, unknown>>,
    apiResult: TApiResult,
    now: string,
    buildRecordFn: (
      modelId: string,
      overrides?: Partial<KnownModelMeta>
    ) => Record<string, unknown>
  ) => void;

  /**
   * URL to ping during healthCheck (if API key is present).
   * Accepts a static string or a function that receives the resolved API key
   * (useful for providers like Google that pass the key as a query parameter).
   */
  healthCheckUrl: string | ((apiKey: string) => string);

  /**
   * Build the request headers for the health check ping.
   * Return an empty object for providers that pass credentials via URL params.
   */
  healthCheckHeaders: (apiKey: string) => Record<string, string>;

  /** Message returned in HealthCheckResult when the API is reachable. */
  healthCheckSuccessMsg: string;

  /**
   * Optionally deactivate active provider rows that are no longer emitted by the
   * current static + scrape + API sync result. This is useful for retiring
   * stale docs/article slugs that previously leaked into the models table.
   */
  deactivateMissing?: {
    provider: string;
    slugPrefix: string;
    shouldDeactivateSlug?: (slug: string) => boolean;
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a { sync, healthCheck } pair for an adapter following the
 * static → scrape → API → upsert pipeline.
 */
export function createAdapterSyncer<TApiResult>(
  config: AdapterSyncerConfig<TApiResult>
): {
  sync: (ctx: SyncContext) => Promise<SyncResult>;
  healthCheck: (secrets: Record<string, string>) => Promise<HealthCheckResult>;
} {
  async function sync(ctx: SyncContext): Promise<SyncResult> {
    const now = new Date().toISOString();

    // ── Step 1: Populate recordMap from static known model IDs ──────────────
    const recordMap = new Map<string, Record<string, unknown>>();
    for (const modelId of config.knownModelIds) {
      recordMap.set(modelId, config.buildRecordFn(modelId));
    }

    const sources: string[] = ["static_known_models"];

    // ── Step 2: Scrape public docs page (optional enrichment) ───────────────
    const scrapedIds = await config.scrapeFn(ctx.signal);
    if (scrapedIds.length > 0) {
      sources.push("html_scrape");
      for (const modelId of scrapedIds) {
        if (!recordMap.has(modelId)) {
          recordMap.set(modelId, config.buildRecordFn(modelId));
        }
      }
    }

    // ── Step 3: Live API if key available (optional enrichment) ─────────────
    const apiKey = process.env[config.apiKeySecret] ?? ctx.secrets[config.apiKeySecret];
    let apiResult: TApiResult | null = null;
    if (apiKey) {
      apiResult = await config.apiFn(apiKey, ctx.signal);
      if (apiResult !== null) {
        sources.push(config.apiSourceName);
        config.enrichFn(recordMap, apiResult, now, config.buildRecordFn);
      }
    }

    // ── Step 4: Upsert all records ───────────────────────────────────────────
    const records = Array.from(recordMap.values());
    const { created, errors: upsertErrors } = await upsertBatch(
      ctx.supabase,
      "models",
      records,
      "slug"
    );

    let deactivatedStale = 0;
    if (config.deactivateMissing) {
      const currentSlugs = new Set(
        records
          .map((record) =>
            typeof record.slug === "string" ? record.slug : null
          )
          .filter((slug): slug is string => Boolean(slug))
      );

      const { data: activeRows, error: activeRowsError } = await ctx.supabase
        .from("models")
        .select("slug")
        .eq("provider", config.deactivateMissing.provider)
        .eq("status", "active")
        .like("slug", `${config.deactivateMissing.slugPrefix}-%`);

      if (activeRowsError) {
        upsertErrors.push({
          message: `Failed to fetch active ${config.deactivateMissing.provider} rows for stale cleanup: ${activeRowsError.message}`,
        });
      } else {
        const staleSlugs = (activeRows ?? [])
          .map((row) => row.slug)
          .filter(
            (slug): slug is string =>
              typeof slug === "string" &&
              !currentSlugs.has(slug) &&
              (config.deactivateMissing?.shouldDeactivateSlug?.(slug) ?? true)
          );

        if (staleSlugs.length > 0) {
          const { error: deactivateError } = await ctx.supabase
            .from("models")
            .update({ status: "archived", data_refreshed_at: now })
            .in("slug", staleSlugs);

          if (deactivateError) {
            upsertErrors.push({
              message: `Failed to deactivate stale ${config.deactivateMissing.provider} rows: ${deactivateError.message}`,
            });
          } else {
            deactivatedStale = staleSlugs.length;
          }
        }
      }
    }

    return {
      success: upsertErrors.length === 0,
      recordsProcessed: records.length,
      recordsCreated: created,
      recordsUpdated: records.length - created,
      errors: upsertErrors,
      metadata: {
        sources,
        staticModels: config.staticModelCount,
        scrapedIds: scrapedIds.length,
        apiModels: getApiResultSize(apiResult),
        totalRecords: records.length,
        deactivatedStale,
      },
    };
  }

  async function healthCheck(
    secrets: Record<string, string>
  ): Promise<HealthCheckResult> {
    const apiKey = secrets[config.apiKeySecret] ?? process.env[config.apiKeySecret];

    if (!apiKey) {
      return {
        healthy: true,
        latencyMs: 0,
        message: `Static-only mode — ${config.staticModelCount} models available without API key`,
      };
    }

    const healthUrl =
      typeof config.healthCheckUrl === "function"
        ? config.healthCheckUrl(apiKey)
        : config.healthCheckUrl;

    const start = Date.now();
    try {
      const res = await fetchWithRetry(
        healthUrl,
        { headers: config.healthCheckHeaders(apiKey) },
        { maxRetries: 1 }
      );
      const latencyMs = Date.now() - start;
      return res.ok
        ? { healthy: true, latencyMs, message: config.healthCheckSuccessMsg }
        : {
            healthy: false,
            latencyMs,
            message: `API returned HTTP ${res.status}`,
          };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: `API unreachable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { sync, healthCheck };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Determine the "size" of an API result for metadata reporting.
 * Handles Map, Array, and null.
 */
function getApiResultSize(result: unknown): number {
  if (result === null || result === undefined) return 0;
  if (result instanceof Map) return result.size;
  if (Array.isArray(result)) return result.length;
  return 0;
}
