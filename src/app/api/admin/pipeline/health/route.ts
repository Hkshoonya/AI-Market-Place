/**
 * Admin Pipeline Health Endpoint
 *
 * GET /api/admin/pipeline/health
 *
 * Admin-session-authenticated equivalent of /api/pipeline/health.
 * Returns the full PipelineHealthDetailSchema payload (always includes adapters[])
 * but authenticates via session cookie + is_admin check instead of CRON_SECRET.
 *
 * This is needed because /api/pipeline/health requires Bearer CRON_SECRET for
 * full detail, which cannot be sent from the browser (see RESEARCH.md Pitfall 2).
 *
 * Auth:
 *   - Uses createClient() for session auth check (getUser + profiles.is_admin)
 *   - Uses createAdminClient() for data queries (bypasses RLS)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-error";
import {
  computeStatus,
  resolveEffectiveHealthRow,
} from "@/lib/pipeline-health-compute";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";

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

function sanitizePipelineErrorMessage(error: string | null | undefined) {
  if (!error) return null;

  const collapsed = error.replace(/\s+/g, " ").trim();
  const htmlStart = collapsed.search(/<!DOCTYPE|<html|<head|<body|<[a-z]/i);
  const useful = htmlStart >= 0 ? collapsed.slice(0, htmlStart).trim() : collapsed;

  if (!useful) {
    return "Upstream response error";
  }

  return useful.length > 280 ? `${useful.slice(0, 277)}...` : useful;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-pipeline-health:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    // ── Admin session auth ──────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Data queries via admin client (bypasses RLS) ─────────────────────────
    const adminSupabase = createAdminClient();

    const [dataSourcesResult, pipelineHealthResult] = await Promise.all([
      adminSupabase
        .from("data_sources")
        .select("slug, is_enabled, last_success_at, last_sync_at, last_sync_records, last_error_message, sync_interval_hours")
        .eq("is_enabled", true)
        .is("quarantined_at", null),
      adminSupabase
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

    // Compute per-adapter status using shared computeStatus
    const adapterStatuses = dataSources.map((source) => {
      const effectiveRow = resolveEffectiveHealthRow(
        source,
        healthBySlug.get(source.slug)
      );
      const status = computeStatus(effectiveRow);

      return {
        slug: source.slug,
        status,
        lastSync: source.last_success_at ?? source.last_sync_at ?? null,
        consecutiveFailures: effectiveRow.consecutive_failures,
        recordCount: source.last_sync_records ?? 0,
        error: sanitizePipelineErrorMessage(source.last_error_message),
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

    // Determine top-level status (worst wins)
    const topLevelStatus: "healthy" | "degraded" | "down" =
      downCount > 0 ? "down" : degradedCount > 0 ? "degraded" : "healthy";

    const checkedAt = new Date().toISOString();

    const detail = PipelineHealthDetailSchema.parse({
      status: topLevelStatus,
      healthy: healthyCount,
      degraded: degradedCount,
      down: downCount,
      checkedAt,
      adapters: adapterStatuses,
    });

    return NextResponse.json(detail);
  } catch (err) {
    return handleApiError(err, "admin/pipeline/health");
  }
}
