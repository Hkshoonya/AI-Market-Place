/**
 * Sync Orchestrator
 *
 * Reads enabled data_sources for a given tier,
 * runs each adapter sequentially (to avoid memory pressure),
 * records results into sync_jobs table.
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import type {
  DataSourceRecord,
  SyncContext,
  SyncResult,
  SyncError,
} from "./types";
import type { TypedSupabaseClient } from "@/types/database";
import { getAdapter, loadAllAdapters } from "./registry";
import { resolveSecrets, needsSync } from "./utils";
import { recordSyncSuccess, recordSyncFailure } from "@/lib/pipeline-health";
import { systemLog } from "@/lib/logging";

interface SourceDetail {
  source: string;
  status: "success" | "partial" | "failed" | "skipped";
  recordsProcessed: number;
  errors: SyncError[];
  durationMs: number;
}

export interface OrchestratorResult {
  tier: number;
  sourcesRun: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  details: SourceDetail[];
}

/** Create a service-role Supabase client (bypasses RLS) */
function createServiceClient(): TypedSupabaseClient {
  return createClient<import("@/types/database").Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Run a single adapter with timeout, job tracking, and error handling */
async function executeAdapter(
  sb: TypedSupabaseClient,
  source: DataSourceRecord,
  trigger: "scheduled" | "manual"
): Promise<SourceDetail> {
  const adapter = getAdapter(source.adapter_type);

  if (!adapter) {
    return {
      source: source.slug,
      status: "failed",
      recordsProcessed: 0,
      errors: [
        {
          message: `No adapter registered for type "${source.adapter_type}"`,
        },
      ],
      durationMs: 0,
    };
  }

  const startTime = Date.now();

  // Resolve secrets from env
  const { secrets, missing } = resolveSecrets(source.secret_env_keys);
  if (missing.length > 0) {
    void systemLog.warn("sync-orchestrator", `Adapter ${source.slug} missing secrets — running in degraded mode`, {
      slug: source.slug,
      missingSecrets: missing,
    });
  }

  // Merge default config with DB config
  const config = { ...adapter.defaultConfig, ...source.config };

  // Create abort controller with configurable timeout (default 5 min)
  const timeoutMs =
    ((config.timeoutSeconds as number) ?? 300) * 1000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Create sync context
  const ctx: SyncContext = {
    supabase: sb,
    config,
    secrets,
    lastSyncAt: source.last_sync_at,
    signal: controller.signal,
  };

  // Create sync_jobs record
  const { data: syncJob } = await sb
    .from("sync_jobs")
    .insert({
      source: source.slug,
      job_type: trigger,
      status: "running",
      started_at: new Date().toISOString(),
      metadata: { tier: source.tier, adapter_type: source.adapter_type },
    })
    .select("id")
    .single();

  let syncResult: SyncResult;

  try {
    syncResult = await adapter.sync(ctx);
  } catch (err) {
    syncResult = {
      success: false,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      errors: [
        { message: err instanceof Error ? err.message : String(err) },
      ],
    };
  } finally {
    clearTimeout(timeout);
  }

  const durationMs = Date.now() - startTime;
  const status = syncResult.success
    ? "success"
    : syncResult.errors.length > 0 && syncResult.recordsProcessed > 0
      ? "partial"
      : "failed";

  // Update sync_jobs record
  if (syncJob?.id) {
    await sb
      .from("sync_jobs")
      .update({
        status: status === "success" ? "completed" : "failed",
        completed_at: new Date().toISOString(),
        records_processed: syncResult.recordsProcessed,
        records_created: syncResult.recordsCreated,
        records_updated: syncResult.recordsUpdated,
        error_message:
          syncResult.errors.length > 0
            ? syncResult.errors.map((e) => e.message).join("; ")
            : null,
        metadata: {
          tier: source.tier,
          adapter_type: source.adapter_type,
          trigger,
          duration_ms: durationMs,
          cursor: syncResult.cursor,
          ...syncResult.metadata,
        },
      })
      .eq("id", syncJob.id);
  }

  // Update data_sources record
  await sb
    .from("data_sources")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
      last_sync_records: syncResult.recordsProcessed,
      last_error_message:
        syncResult.errors.length > 0
          ? syncResult.errors[0].message
          : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", source.id);

  // Track pipeline health
  if (status === "failed") {
    const failureCount = await recordSyncFailure(source.slug).catch((err: unknown) => {
      void systemLog.warn("sync-orchestrator", "Failed to record sync failure status", {
        slug: source.slug,
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    });

    // Structured failure log — written for every adapter failure
    void systemLog.error("sync-orchestrator", "Adapter sync failed", {
      adapter: source.slug,
      adapter_type: source.adapter_type,
      tier: source.tier,
      durationMs,
      consecutiveFailures: failureCount,
      error: syncResult.errors[0]?.message ?? "unknown",
    });

    // Sentry alert on 3+ consecutive failures
    if (failureCount >= 3) {
      Sentry.captureMessage(
        `Pipeline adapter consecutive failures: ${source.slug}`,
        {
          level: "warning",
          tags: {
            adapter: source.slug,
            adapter_type: source.adapter_type,
            tier: String(source.tier),
          },
          extra: {
            consecutiveFailures: failureCount,
            lastError: syncResult.errors[0]?.message,
          },
        }
      );
    }
  } else {
    await recordSyncSuccess(source.slug).catch((err: unknown) => {
      void systemLog.warn("sync-orchestrator", "Failed to record sync success status", {
        slug: source.slug,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  return {
    source: source.slug,
    status,
    recordsProcessed: syncResult.recordsProcessed,
    errors: syncResult.errors,
    durationMs,
  };
}

/** Run all enabled sources for a given tier */
export async function runTierSync(
  tier: number
): Promise<OrchestratorResult> {
  await loadAllAdapters();

  const supabase = createServiceClient();
  const sb = supabase;

  // Fetch enabled sources for this tier, ordered by priority
  const { data: sources, error: fetchErr } = await sb
    .from("data_sources")
    .select("*")
    .eq("is_enabled", true)
    .eq("tier", tier)
    .order("priority", { ascending: true });

  if (fetchErr) {
    throw new Error(`Failed to fetch data_sources: ${fetchErr.message}`);
  }

  const result: OrchestratorResult = {
    tier,
    sourcesRun: 0,
    sourcesSucceeded: 0,
    sourcesFailed: 0,
    details: [],
  };

  for (const source of ((sources ?? []) as DataSourceRecord[])) {
    // Check if sync is due
    if (!needsSync(source.last_sync_at, source.sync_interval_hours)) {
      result.details.push({
        source: source.slug,
        status: "skipped",
        recordsProcessed: 0,
        errors: [],
        durationMs: 0,
      });
      continue;
    }

    result.sourcesRun++;
    const detail = await executeAdapter(sb, source, "scheduled");
    result.details.push(detail);

    if (detail.status === "failed") {
      result.sourcesFailed++;
    } else {
      result.sourcesSucceeded++;
    }
  }

  return result;
}

/** Run a single source by slug (for manual triggers) */
export async function runSingleSync(
  slug: string
): Promise<OrchestratorResult> {
  await loadAllAdapters();

  const supabase = createServiceClient();
  const sb = supabase;

  const { data: source, error } = await sb
    .from("data_sources")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !source) {
    throw new Error(`Data source "${slug}" not found`);
  }

  const record = source as DataSourceRecord;
  const detail = await executeAdapter(sb, record, "manual");

  return {
    tier: record.tier,
    sourcesRun: 1,
    sourcesSucceeded: detail.status !== "failed" ? 1 : 0,
    sourcesFailed: detail.status === "failed" ? 1 : 0,
    details: [detail],
  };
}
