/**
 * System Health Endpoint
 *
 * GET /api/health
 *
 * Public (no auth):  returns { status: "healthy"|"degraded", version, timestamp }
 * Authed (Bearer CRON_SECRET): returns full detail including database, uptime, cron, pipeline summary
 *
 * Returns 503 ONLY when the database is unreachable.
 * Degraded pipeline or cron returns 200 with status: "degraded".
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-error";
import { computeStatus } from "@/lib/pipeline-health-compute";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Version — read once at module scope, not per-request
// ---------------------------------------------------------------------------

const pkgPath = join(process.cwd(), "package.json");
const APP_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

// ---------------------------------------------------------------------------
// Cron status — populated by Plan 02's custom-server.js wiring
// ---------------------------------------------------------------------------

let _cronActive = false;
let _cronJobCount = 0;

export function setCronStatus(active: boolean, count: number): void {
  _cronActive = active;
  _cronJobCount = count;
}

export function getCronStatus(): { active: boolean; jobCount: number } {
  return { active: _cronActive, jobCount: _cronJobCount };
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const HealthPublicSchema = z.object({
  status: z.enum(["healthy", "degraded"]),
  version: z.string(),
  timestamp: z.string(),
});

const HealthDetailSchema = HealthPublicSchema.extend({
  uptime: z.number(),
  database: z.object({
    connected: z.boolean(),
    latencyMs: z.number(),
  }),
  cron: z.object({
    active: z.boolean(),
    jobCount: z.number(),
  }),
  pipeline: z.object({
    healthy: z.number(),
    degraded: z.number(),
    down: z.number(),
  }),
});

const HealthUnhealthySchema = z.object({
  status: z.literal("unhealthy"),
  version: z.string(),
  timestamp: z.string(),
  error: z.string(),
});

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const version = APP_VERSION;

  // Auth check
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isAuthenticated = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  // DB ping — always first; if unreachable, return 503 immediately (outside main try/catch)
  const dbStart = performance.now();
  // eslint-disable-next-line prefer-const
  let supabase!: ReturnType<typeof createAdminClient>;
  let dbConnected = false;
  let dbLatencyMs = 0;

  try {
    supabase = createAdminClient();

    const { error: pingError } = await supabase
      .from("data_sources")
      .select("slug")
      .limit(1);

    dbLatencyMs = Math.round(performance.now() - dbStart);
    dbConnected = !pingError;

    if (pingError) {
      throw new Error(`DB ping failed: ${pingError.message}`);
    }
  } catch (dbErr) {
    const errorMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    const body = HealthUnhealthySchema.parse({
      status: "unhealthy",
      version,
      timestamp,
      error: errorMsg,
    });
    return NextResponse.json(body, { status: 503 });
  }

  try {

    // Pipeline summary — fetch data_sources and pipeline_health
    const [dataSourcesResult, pipelineHealthResult] = await Promise.all([
      supabase
        .from("data_sources")
        .select("slug, last_sync_at, last_sync_records, last_error_message, sync_interval_hours"),
      supabase
        .from("pipeline_health")
        .select("source_slug, consecutive_failures, last_success_at, expected_interval_hours"),
    ]);

    const dataSources = dataSourcesResult.data ?? [];
    const healthRows = pipelineHealthResult.data ?? [];

    const healthBySlug = new Map(
      healthRows.map((row) => [row.source_slug, row])
    );

    let pipelineHealthy = 0;
    let pipelineDegraded = 0;
    let pipelineDown = 0;

    for (const source of dataSources) {
      const healthRow = healthBySlug.get(source.slug);
      const effectiveRow = healthRow ?? {
        consecutive_failures: 0,
        last_success_at: null as string | null,
        expected_interval_hours: source.sync_interval_hours ?? 6,
      };
      const status = computeStatus(effectiveRow);
      if (status === "healthy") pipelineHealthy++;
      else if (status === "degraded") pipelineDegraded++;
      else pipelineDown++;
    }

    // Top-level status: "degraded" if any pipeline issue; db is up so no "unhealthy"
    const overallStatus: "healthy" | "degraded" =
      pipelineDown > 0 || pipelineDegraded > 0 ? "degraded" : "healthy";

    if (isAuthenticated) {
      const cronStatus = getCronStatus();
      const body = HealthDetailSchema.parse({
        status: overallStatus,
        version,
        timestamp,
        uptime: process.uptime(),
        database: {
          connected: dbConnected,
          latencyMs: dbLatencyMs,
        },
        cron: {
          active: cronStatus.active,
          jobCount: cronStatus.jobCount,
        },
        pipeline: {
          healthy: pipelineHealthy,
          degraded: pipelineDegraded,
          down: pipelineDown,
        },
      });
      return NextResponse.json(body);
    }

    const body = HealthPublicSchema.parse({
      status: overallStatus,
      version,
      timestamp,
    });
    return NextResponse.json(body);
  } catch (err) {
    return handleApiError(err, "health");
  }
}
