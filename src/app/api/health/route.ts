/**
 * System Health Endpoint
 *
 * GET /api/health
 *
 * Public (no auth): returns { status: "healthy"|"degraded", version, timestamp }
 * Authed (Bearer CRON_SECRET): returns full detail including database, cron, uptime, pipeline summary
 *
 * Returns 503 ONLY when the database is unreachable.
 * Degraded pipeline or cron returns 200 with status: "degraded".
 */

import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";
import {
  computeStatus,
  resolveEffectiveHealthRow,
} from "@/lib/pipeline-health-compute";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isCronSchedulerConfigured,
  resolveCronRunnerMode,
} from "@/lib/cron-runtime";

export const dynamic = "force-dynamic";

const CRON_HEALTH_LOOKBACK_HOURS = 24;

const pkgPath = join(process.cwd(), "package.json");
const APP_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      version?: string;
    };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

const HealthPublicSchema = z.object({
  status: z.enum(["healthy", "degraded"]),
  version: z.string(),
  timestamp: z.string(),
  release: z.object({
    provider: z.enum(["railway", "vercel", "unknown"]),
    commitSha: z.string().nullable(),
    branch: z.string().nullable(),
    environment: z.string().nullable(),
  }),
});

const HealthDetailSchema = HealthPublicSchema.extend({
  uptime: z.number(),
  database: z.object({
    connected: z.boolean(),
    latencyMs: z.number(),
  }),
  cron: z.object({
    mode: z.enum(["disabled", "internal", "external"]),
    schedulerConfigured: z.boolean(),
    stale: z.boolean(),
    runningJobs: z.number(),
    recentFailures24h: z.number(),
    lastRunAt: z.string().nullable(),
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

function resolveReleaseMetadata() {
  const normalizeEnvValue = (value: string | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === "undefined" || trimmed === "null") {
      return null;
    }
    return trimmed;
  };

  const railwayCommitSha = normalizeEnvValue(process.env.RAILWAY_GIT_COMMIT_SHA);
  const railwayBranch = normalizeEnvValue(process.env.RAILWAY_GIT_BRANCH);
  const railwayEnvironment = normalizeEnvValue(process.env.RAILWAY_ENVIRONMENT_NAME);
  const vercelCommitSha = normalizeEnvValue(process.env.VERCEL_GIT_COMMIT_SHA);
  const vercelBranch = normalizeEnvValue(process.env.VERCEL_GIT_COMMIT_REF);
  const vercelEnvironment = normalizeEnvValue(process.env.VERCEL_ENV);

  if (railwayCommitSha || railwayBranch || railwayEnvironment) {
    return {
      provider: "railway" as const,
      commitSha: railwayCommitSha,
      branch: railwayBranch,
      environment: railwayEnvironment,
    };
  }

  if (vercelCommitSha || vercelBranch || vercelEnvironment) {
    return {
      provider: "vercel" as const,
      commitSha: vercelCommitSha,
      branch: vercelBranch,
      environment: vercelEnvironment,
    };
  }

  return {
    provider: "unknown" as const,
    commitSha: null,
    branch: null,
    environment: null,
  };
}

async function pingDb(
  version: string,
  timestamp: string
): Promise<
  { supabase: ReturnType<typeof createAdminClient>; latencyMs: number } | NextResponse
> {
  const dbStart = performance.now();

  try {
    const supabase = createAdminClient();
    const { error: pingError } = await supabase
      .from("data_sources")
      .select("slug")
      .limit(1);

    const latencyMs = Math.round(performance.now() - dbStart);

    if (pingError) {
      throw new Error(`DB ping failed: ${pingError.message}`);
    }

    return { supabase, latencyMs };
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
}

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const version = APP_VERSION;
  const release = resolveReleaseMetadata();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isAuthenticated = Boolean(
    cronSecret && authHeader === `Bearer ${cronSecret}`
  );

  const dbResult = await pingDb(version, timestamp);
  if (dbResult instanceof NextResponse) {
    return dbResult;
  }

  const { supabase, latencyMs: dbLatencyMs } = dbResult;

  try {
    const [dataSourcesResult, pipelineHealthResult] = await Promise.all([
      supabase
        .from("data_sources")
        .select(
          "slug, is_enabled, last_success_at, last_sync_at, last_sync_records, last_error_message, sync_interval_hours"
        )
        .eq("is_enabled", true)
        .is("quarantined_at", null),
      supabase
        .from("pipeline_health")
        .select(
          "source_slug, consecutive_failures, last_success_at, expected_interval_hours"
        ),
    ]);

    const dataSources = dataSourcesResult.data ?? [];
    const healthRows = pipelineHealthResult.data ?? [];
    const healthBySlug = new Map(healthRows.map((row) => [row.source_slug, row]));

    let pipelineHealthy = 0;
    let pipelineDegraded = 0;
    let pipelineDown = 0;

    for (const source of dataSources) {
      const effectiveRow = resolveEffectiveHealthRow(
        source,
        healthBySlug.get(source.slug)
      );
      const status = computeStatus(effectiveRow);
      if (status === "healthy") pipelineHealthy++;
      else if (status === "degraded") pipelineDegraded++;
      else pipelineDown++;
    }

    let overallStatus: "healthy" | "degraded" =
      pipelineDown > 0 || pipelineDegraded > 0 ? "degraded" : "healthy";

    if (isAuthenticated) {
      const cronCutoff = new Date(
        Date.now() - CRON_HEALTH_LOOKBACK_HOURS * 60 * 60 * 1000
      ).toISOString();
      const { data: cronRuns = [] } = await supabase
        .from("cron_runs")
        .select("status, started_at, created_at")
        .gte("created_at", cronCutoff)
        .order("created_at", { ascending: false })
        .limit(100);
      const recentCronRuns = cronRuns ?? [];

      const cronMode = resolveCronRunnerMode();
      const schedulerConfigured = isCronSchedulerConfigured(cronMode);
      const recentFailures24h = recentCronRuns.filter((run) => run.status === "failed")
        .length;
      const cronStale = schedulerConfigured && recentCronRuns.length === 0;
      const cronDegraded = cronStale || recentFailures24h > 0;
      overallStatus = overallStatus === "degraded" || cronDegraded ? "degraded" : "healthy";
      const body = HealthDetailSchema.parse({
        status: overallStatus,
        version,
        timestamp,
        uptime: process.uptime(),
        database: {
          connected: true,
          latencyMs: dbLatencyMs,
        },
        release,
        cron: {
          mode: cronMode,
          schedulerConfigured,
          stale: cronStale,
          runningJobs: recentCronRuns.filter((run) => run.status === "running").length,
          recentFailures24h,
          lastRunAt: recentCronRuns[0]?.started_at ?? recentCronRuns[0]?.created_at ?? null,
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
      release,
    });
    return NextResponse.json(body);
  } catch (err) {
    return handleApiError(err, "health");
  }
}
