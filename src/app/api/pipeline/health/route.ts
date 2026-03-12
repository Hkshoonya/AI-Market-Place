/**
 * Pipeline Health Endpoint
 *
 * GET /api/pipeline/health
 *
 * Public (no auth):  returns aggregate summary { status, healthy, degraded, down, checkedAt }
 * Authed (Bearer CRON_SECRET): returns full per-adapter breakdown including adapters[]
 *
 * Status rules (worst wins):
 *   consecutive_failures >= 3  OR  staleness > 4x interval  -> "down"
 *   consecutive_failures >= 1  OR  staleness > 2x interval  -> "degraded"
 *   otherwise                                                -> "healthy"
 *
 * Top-level status: "down" if any down, "degraded" if any degraded, "healthy" if all healthy.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const AdapterHealthSchema = z.object({
  slug: z.string(),
  status: z.enum(["healthy", "degraded", "down"]),
  lastSync: z.string().nullable(),
  consecutiveFailures: z.number(),
  recordCount: z.number(),
  error: z.string().nullable(),
});

const PipelineHealthSummarySchema = z.object({
  status: z.enum(["healthy", "degraded", "down"]),
  healthy: z.number(),
  degraded: z.number(),
  down: z.number(),
  checkedAt: z.string(),
});

const PipelineHealthDetailSchema = PipelineHealthSummarySchema.extend({
  adapters: z.array(AdapterHealthSchema),
});

// ---------------------------------------------------------------------------
// Status computation
// ---------------------------------------------------------------------------

function computeStatus(row: {
  consecutive_failures: number;
  last_success_at: string | null;
  expected_interval_hours: number;
}): "healthy" | "degraded" | "down" {
  const failures = row.consecutive_failures;
  const intervalMs = row.expected_interval_hours * 60 * 60 * 1000;
  const sinceLastSync = row.last_success_at
    ? Date.now() - new Date(row.last_success_at).getTime()
    : Infinity;

  if (failures >= 3 || sinceLastSync > 4 * intervalMs) return "down";
  if (failures >= 1 || sinceLastSync > 2 * intervalMs) return "degraded";
  return "healthy";
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isAuthenticated = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

    const supabase = createAdminClient();

    // Fetch data_sources and pipeline_health in parallel
    const [dataSourcesResult, pipelineHealthResult] = await Promise.all([
      supabase
        .from("data_sources")
        .select("slug, last_sync_at, last_sync_records, last_error_message, sync_interval_hours"),
      supabase
        .from("pipeline_health")
        .select("source_slug, consecutive_failures, last_success_at, expected_interval_hours"),
    ]);

    if (dataSourcesResult.error) {
      throw new Error(`Failed to fetch data_sources: ${dataSourcesResult.error.message}`);
    }
    if (pipelineHealthResult.error) {
      throw new Error(`Failed to fetch pipeline_health: ${pipelineHealthResult.error.message}`);
    }

    const dataSources = dataSourcesResult.data ?? [];
    const healthRows = pipelineHealthResult.data ?? [];

    // Build a lookup map from pipeline_health by source_slug
    const healthBySlug = new Map(
      healthRows.map((row) => [row.source_slug, row])
    );

    // Compute per-adapter status
    const adapterStatuses = dataSources.map((source) => {
      const healthRow = healthBySlug.get(source.slug);

      // If no pipeline_health row exists, treat as never synced:
      // last_success_at = null => staleness = Infinity => "down"
      const effectiveRow = healthRow ?? {
        consecutive_failures: 0,
        last_success_at: null as string | null,
        expected_interval_hours: source.sync_interval_hours ?? 6,
      };

      const status = computeStatus(effectiveRow);

      return {
        slug: source.slug,
        status,
        lastSync: source.last_sync_at ?? null,
        consecutiveFailures: effectiveRow.consecutive_failures,
        recordCount: source.last_sync_records ?? 0,
        error: source.last_error_message ?? null,
      };
    });

    // Count by status
    let healthyCount = 0;
    let degradedCount = 0;
    let downCount = 0;

    for (const adapter of adapterStatuses) {
      if (adapter.status === "healthy") healthyCount++;
      else if (adapter.status === "degraded") degradedCount++;
      else downCount++;
    }

    // Determine top-level status
    const topLevelStatus: "healthy" | "degraded" | "down" =
      downCount > 0 ? "down" : degradedCount > 0 ? "degraded" : "healthy";

    const checkedAt = new Date().toISOString();

    if (isAuthenticated) {
      const detail = PipelineHealthDetailSchema.parse({
        status: topLevelStatus,
        healthy: healthyCount,
        degraded: degradedCount,
        down: downCount,
        checkedAt,
        adapters: adapterStatuses,
      });
      return NextResponse.json(detail);
    }

    const summary = PipelineHealthSummarySchema.parse({
      status: topLevelStatus,
      healthy: healthyCount,
      degraded: degradedCount,
      down: downCount,
      checkedAt,
    });
    return NextResponse.json(summary);
  } catch (err) {
    return handleApiError(err, "pipeline/health");
  }
}
