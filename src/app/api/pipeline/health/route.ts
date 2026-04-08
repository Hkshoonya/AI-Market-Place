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
 *   fresh success <= 1x interval and failures < 3           -> "healthy"
 *   consecutive_failures >= 1  OR  staleness > 2x interval  -> "degraded"
 *   otherwise                                                -> "healthy"
 *
 * Top-level status: "down" if any down, "degraded" if any degraded, "healthy" if all healthy.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-error";
import {
  computeStatus,
  resolveEffectiveHealthRow,
} from "@/lib/pipeline-health-compute";
import { computeBenchmarkCoverage } from "@/lib/benchmark-coverage-compute";
import { computeBenchmarkMetadataCoverage } from "@/lib/benchmark-metadata-coverage-compute";
import { computePublicMetadataCoverage } from "@/lib/public-metadata-coverage-compute";

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
  benchmarkCoverage: z.object({
    coveragePct: z.number(),
    coveredModels: z.number(),
    activeModels: z.number(),
    officialGapCount: z.number(),
    trustedLocatorCoveragePct: z.number(),
    missingTrustedLocatorCount: z.number(),
  }),
  publicMetadataCoverage: z.object({
    completeDiscoveryMetadataPct: z.number(),
    defaultPublicSurfaceReadyPct: z.number(),
    missingCategoryCount: z.number(),
    missingReleaseDateCount: z.number(),
    openWeightsMissingLicenseCount: z.number(),
    llmMissingContextWindowCount: z.number(),
    officialCompleteDiscoveryMetadataPct: z.number(),
    officialDefaultPublicSurfaceReadyPct: z.number(),
    officialMissingReleaseDateCount: z.number(),
  }),
});

const PipelineHealthDetailSchema = PipelineHealthSummarySchema.extend({
  adapters: z.array(AdapterHealthSchema),
  benchmarkCoverage: z.object({
    coveragePct: z.number(),
    coveredModels: z.number(),
    activeModels: z.number(),
    officialGapCount: z.number(),
    trustedLocatorCoveragePct: z.number(),
    missingTrustedLocatorCount: z.number(),
    weakestOfficialProviders: z.array(
      z.object({
        provider: z.string(),
        coverage_pct: z.number(),
        total: z.number(),
      })
    ),
    recentOfficialGaps: z.array(
      z.object({
        slug: z.string(),
        provider: z.string(),
        category: z.string().nullable(),
        release_date: z.string().nullable(),
      })
    ),
    recentMissingTrustedLocators: z.array(
      z.object({
        slug: z.string(),
        provider: z.string(),
        category: z.string().nullable(),
        release_date: z.string().nullable(),
      })
    ),
  }),
  publicMetadataCoverage: z.object({
    completeDiscoveryMetadataPct: z.number(),
    defaultPublicSurfaceReadyPct: z.number(),
    missingCategoryCount: z.number(),
    missingReleaseDateCount: z.number(),
    openWeightsMissingLicenseCount: z.number(),
    llmMissingContextWindowCount: z.number(),
    officialCompleteDiscoveryMetadataPct: z.number(),
    officialDefaultPublicSurfaceReadyPct: z.number(),
    officialMissingReleaseDateCount: z.number(),
    weakestProviders: z.array(
      z.object({
        provider: z.string(),
        complete_pct: z.number(),
        ready_pct: z.number(),
        total: z.number(),
      })
    ),
    weakestOfficialProviders: z.array(
      z.object({
        provider: z.string(),
        complete_pct: z.number(),
        total: z.number(),
      })
    ),
    recentIncompleteModels: z.array(
      z.object({
        slug: z.string(),
        provider: z.string(),
        category: z.string().nullable(),
        release_date: z.string().nullable(),
      })
    ),
    recentIncompleteOfficialModels: z.array(
      z.object({
        slug: z.string(),
        provider: z.string(),
        category: z.string().nullable(),
        release_date: z.string().nullable(),
      })
    ),
  }),
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
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isAuthenticated = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

    const supabase = createAdminClient();

    // Fetch data_sources and pipeline_health in parallel
    const [
      dataSourcesResult,
      pipelineHealthResult,
      benchmarkCoverage,
      benchmarkMetadataCoverage,
      publicMetadataCoverage,
    ] = await Promise.all([
      supabase
        .from("data_sources")
        .select("slug, is_enabled, last_success_at, last_sync_at, last_sync_records, last_error_message, sync_interval_hours")
        .eq("is_enabled", true)
        .is("quarantined_at", null),
      supabase
        .from("pipeline_health")
        .select("source_slug, consecutive_failures, last_success_at, expected_interval_hours"),
      computeBenchmarkCoverage(supabase),
      computeBenchmarkMetadataCoverage(supabase),
      computePublicMetadataCoverage(supabase),
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

    // Determine top-level status
    const topLevelStatus: "healthy" | "degraded" | "down" =
      downCount > 0 ? "down" : degradedCount > 0 ? "degraded" : "healthy";

    const checkedAt = new Date().toISOString();
    const benchmarkCoverageSummary = {
      coveragePct: benchmarkCoverage.totals.coverage_pct,
      coveredModels: benchmarkCoverage.totals.covered_models,
      activeModels: benchmarkCoverage.totals.active_models,
      officialGapCount:
        benchmarkCoverage.recent_sparse_benchmark_expected_official.length,
      trustedLocatorCoveragePct:
        benchmarkMetadataCoverage.trustedLocatorCoveragePct,
      missingTrustedLocatorCount:
        benchmarkMetadataCoverage.missingTrustedLocatorCount,
    };

    if (isAuthenticated) {
      const detail = PipelineHealthDetailSchema.parse({
        status: topLevelStatus,
        healthy: healthyCount,
        degraded: degradedCount,
        down: downCount,
        checkedAt,
        adapters: adapterStatuses,
        benchmarkCoverage: {
          ...benchmarkCoverageSummary,
          weakestOfficialProviders: benchmarkCoverage.official_providers
            .slice(0, 5)
            .map((provider) => ({
              provider: provider.provider,
              coverage_pct: provider.coverage_pct,
              total: provider.total,
            })),
          recentOfficialGaps:
            benchmarkCoverage.recent_sparse_benchmark_expected_official.slice(0, 10),
          recentMissingTrustedLocators:
            benchmarkMetadataCoverage.recentMissingTrustedLocators,
        },
      publicMetadataCoverage: {
        completeDiscoveryMetadataPct:
          publicMetadataCoverage.completeDiscoveryMetadataPct,
        defaultPublicSurfaceReadyPct:
          publicMetadataCoverage.defaultPublicSurfaceReadyPct,
        missingCategoryCount: publicMetadataCoverage.missingCategoryCount,
        missingReleaseDateCount: publicMetadataCoverage.missingReleaseDateCount,
        openWeightsMissingLicenseCount:
          publicMetadataCoverage.openWeightsMissingLicenseCount,
        llmMissingContextWindowCount:
          publicMetadataCoverage.llmMissingContextWindowCount,
        officialCompleteDiscoveryMetadataPct:
          publicMetadataCoverage.official.completeDiscoveryMetadataPct,
        officialDefaultPublicSurfaceReadyPct:
          publicMetadataCoverage.official.defaultPublicSurfaceReadyPct,
        officialMissingReleaseDateCount:
          publicMetadataCoverage.official.missingReleaseDateCount,
        weakestProviders: publicMetadataCoverage.providers.slice(0, 5).map(
          (provider) => ({
            provider: provider.provider,
            complete_pct: provider.complete_pct,
            ready_pct: provider.ready_pct,
            total: provider.total,
          })
        ),
          weakestOfficialProviders: publicMetadataCoverage.official.providers
            .slice(0, 5)
            .map((provider) => ({
              provider: provider.provider,
              complete_pct: provider.complete_pct,
              total: provider.total,
            })),
          recentIncompleteModels: publicMetadataCoverage.recentIncompleteModels,
          recentIncompleteOfficialModels:
            publicMetadataCoverage.official.recentIncompleteModels,
        },
      });
      return NextResponse.json(detail);
    }

    const summary = PipelineHealthSummarySchema.parse({
      status: topLevelStatus,
      healthy: healthyCount,
      degraded: degradedCount,
      down: downCount,
      checkedAt,
      benchmarkCoverage: benchmarkCoverageSummary,
      publicMetadataCoverage: {
        completeDiscoveryMetadataPct:
          publicMetadataCoverage.completeDiscoveryMetadataPct,
        defaultPublicSurfaceReadyPct:
          publicMetadataCoverage.defaultPublicSurfaceReadyPct,
        missingCategoryCount: publicMetadataCoverage.missingCategoryCount,
        missingReleaseDateCount: publicMetadataCoverage.missingReleaseDateCount,
        openWeightsMissingLicenseCount:
          publicMetadataCoverage.openWeightsMissingLicenseCount,
        llmMissingContextWindowCount:
          publicMetadataCoverage.llmMissingContextWindowCount,
        officialCompleteDiscoveryMetadataPct:
          publicMetadataCoverage.official.completeDiscoveryMetadataPct,
        officialDefaultPublicSurfaceReadyPct:
          publicMetadataCoverage.official.defaultPublicSurfaceReadyPct,
        officialMissingReleaseDateCount:
          publicMetadataCoverage.official.missingReleaseDateCount,
      },
    });
    return NextResponse.json(summary);
  } catch (err) {
    return handleApiError(err, "pipeline/health");
  }
}
