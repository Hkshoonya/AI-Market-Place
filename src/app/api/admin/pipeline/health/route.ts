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
import { computeBenchmarkCoverage } from "@/lib/benchmark-coverage-compute";
import { computeBenchmarkMetadataCoverage } from "@/lib/benchmark-metadata-coverage-compute";
import { computePublicMetadataCoverage } from "@/lib/public-metadata-coverage-compute";
import {
  computeDeploymentOperationsSummary,
  isMissingDeploymentOperationsTableError,
} from "@/lib/deployment-operations-compute";
import { getStripePaymentsReadiness } from "@/lib/payments/stripe-readiness";
import {
  PIPELINE_CRON_EXPECTATIONS,
  summarizePipelineCronHealth,
} from "@/lib/pipeline-cron-health";
import { MANUAL_BENCHMARK_SOURCE_SLUGS } from "@/lib/data-sources/manual-benchmark-sources";
import {
  computePipelineDataQualityAlerts,
  computePipelineDataQualityStatus,
} from "@/lib/pipeline-quality-alerts";
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

const PIPELINE_CRON_LOOKBACK_DAYS = 7;

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
  dataQualityStatus: z.enum(["healthy", "warning", "critical"]),
  dataQualityAlerts: z.array(
    z.object({
      severity: z.enum(["warning", "critical"]),
      code: z.string(),
      message: z.string(),
      value: z.number(),
      target: z.number(),
    })
  ),
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
  deploymentOperations: z.object({
    total: z.number(),
    managedCount: z.number(),
    hostedCount: z.number(),
    readyCount: z.number(),
    pausedCount: z.number(),
    provisioningCount: z.number(),
    staleProvisioningCount: z.number(),
    failedCount: z.number(),
    staleProvisioningThresholdMinutes: z.number(),
  }),
  cron: z.object({
    recentFailures24h: z.number(),
    latestFailedJobCount: z.number(),
    staleJobCount: z.number(),
    lastRunAt: z.string().nullable(),
  }),
  publicMetadataCoverage: z.object({
    completeDiscoveryMetadataPct: z.number(),
    defaultPublicSurfaceReadyPct: z.number(),
    trustTierCounts: z.object({
      official: z.number(),
      trusted_catalog: z.number(),
      community: z.number(),
      wrapper: z.number(),
    }),
    lowTrustActiveCount: z.number(),
    lowTrustReadyCount: z.number(),
    signalContaminationCount: z.number(),
    missingCategoryCount: z.number(),
    missingReleaseDateCount: z.number(),
    openWeightsMissingLicenseCount: z.number(),
    llmMissingContextWindowCount: z.number(),
    rankingContaminationCount: z.number(),
    officialCompleteDiscoveryMetadataPct: z.number(),
    officialDefaultPublicSurfaceReadyPct: z.number(),
    officialMissingReleaseDateCount: z.number(),
    officialRankingContaminationCount: z.number(),
  }),
  payments: z.object({
    stripe: z.object({
      status: z.enum(["ready", "partial", "disabled"]),
      checkoutConfigured: z.boolean(),
      webhookConfigured: z.boolean(),
      publishableKeyConfigured: z.boolean(),
      blockingIssues: z.array(z.string()),
    }),
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
  deploymentOperations: z.object({
    total: z.number(),
    managedCount: z.number(),
    hostedCount: z.number(),
    readyCount: z.number(),
    pausedCount: z.number(),
    provisioningCount: z.number(),
    staleProvisioningCount: z.number(),
    failedCount: z.number(),
    staleProvisioningThresholdMinutes: z.number(),
    recentStaleProvisioning: z.array(
      z.object({
        id: z.string(),
        slug: z.string(),
        modelName: z.string(),
        provider: z.string().nullable(),
        deploymentKind: z.enum(["managed_api", "assistant_only", "hosted_external"]),
        updatedAt: z.string(),
        ageMinutes: z.number().nullable(),
      })
    ),
    recentFailed: z.array(
      z.object({
        id: z.string(),
        slug: z.string(),
        modelName: z.string(),
        provider: z.string().nullable(),
        deploymentKind: z.enum(["managed_api", "assistant_only", "hosted_external"]),
        updatedAt: z.string(),
        errorMessage: z.string().nullable(),
      })
    ),
  }),
  cron: z.object({
    recentFailures24h: z.number(),
    latestFailedJobCount: z.number(),
    staleJobCount: z.number(),
    lastRunAt: z.string().nullable(),
    latestFailedJobs: z.array(z.string()),
    staleJobs: z.array(z.string()),
    criticalJobs: z.array(
      z.object({
        jobName: z.string(),
        expectedIntervalHours: z.number(),
        lastRunAt: z.string().nullable(),
        status: z.enum(["completed", "failed", "running", "missing"]),
        stale: z.boolean(),
      })
    ),
  }),
  publicMetadataCoverage: z.object({
    completeDiscoveryMetadataPct: z.number(),
    defaultPublicSurfaceReadyPct: z.number(),
    trustTierCounts: z.object({
      official: z.number(),
      trusted_catalog: z.number(),
      community: z.number(),
      wrapper: z.number(),
    }),
    lowTrustActiveCount: z.number(),
    lowTrustReadyCount: z.number(),
    signalContaminationCount: z.number(),
    topReadinessBlockers: z.array(
      z.object({
        reason: z.string(),
        count: z.number(),
      })
    ),
    missingCategoryCount: z.number(),
    missingReleaseDateCount: z.number(),
    openWeightsMissingLicenseCount: z.number(),
    llmMissingContextWindowCount: z.number(),
    rankingContaminationCount: z.number(),
    officialCompleteDiscoveryMetadataPct: z.number(),
    officialDefaultPublicSurfaceReadyPct: z.number(),
    officialMissingReleaseDateCount: z.number(),
    officialRankingContaminationCount: z.number(),
    topOfficialReadinessBlockers: z.array(
      z.object({
        reason: z.string(),
        count: z.number(),
      })
    ),
    weakestOfficialProviders: z.array(
      z.object({
        provider: z.string(),
        complete_pct: z.number(),
        ready_pct: z.number(),
        total: z.number(),
      })
    ),
    weakestProviders: z.array(
      z.object({
        provider: z.string(),
        complete_pct: z.number(),
        ready_pct: z.number(),
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
    recentNotReadyModels: z.array(
      z.object({
        slug: z.string(),
        provider: z.string(),
        category: z.string().nullable(),
        release_date: z.string().nullable(),
        reasons: z.array(z.string()),
      })
    ),
    recentNotReadyOfficialModels: z.array(
      z.object({
        slug: z.string(),
        provider: z.string(),
        category: z.string().nullable(),
        release_date: z.string().nullable(),
        reasons: z.array(z.string()),
      })
    ),
    recentRankingContaminationModels: z.array(
      z.object({
        slug: z.string(),
        provider: z.string(),
        category: z.string().nullable(),
        release_date: z.string().nullable(),
        reasons: z.array(z.string()),
      })
    ),
    recentRankingContaminationOfficialModels: z.array(
      z.object({
        slug: z.string(),
        provider: z.string(),
        category: z.string().nullable(),
        release_date: z.string().nullable(),
        reasons: z.array(z.string()),
      })
    ),
    recentLowTrustModels: z.array(
      z.object({
        slug: z.string(),
        provider: z.string(),
        category: z.string().nullable(),
        release_date: z.string().nullable(),
        trust_tier: z.enum(["official", "trusted_catalog", "community", "wrapper"]),
      })
    ),
    recentSignalContaminationModels: z.array(
      z.object({
        slug: z.string(),
        provider: z.string(),
        category: z.string().nullable(),
        release_date: z.string().nullable(),
        trust_tier: z.enum(["official", "trusted_catalog", "community", "wrapper"]),
      })
    ),
  }),
  payments: z.object({
    stripe: z.object({
      status: z.enum(["ready", "partial", "disabled"]),
      checkoutConfigured: z.boolean(),
      webhookConfigured: z.boolean(),
      publishableKeyConfigured: z.boolean(),
      blockingIssues: z.array(z.string()),
    }),
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

    const [
      dataSourcesResult,
      pipelineHealthResult,
      benchmarkCoverage,
      benchmarkMetadataCoverage,
      publicMetadataCoverage,
      deploymentRowsResult,
      cronRunsResult,
    ] = await Promise.all([
      adminSupabase
        .from("data_sources")
        .select("slug, is_enabled, last_success_at, last_sync_at, last_sync_records, last_error_message, sync_interval_hours")
        .eq("is_enabled", true)
        .is("quarantined_at", null),
      adminSupabase
        .from("pipeline_health")
        .select("source_slug, consecutive_failures, last_success_at, expected_interval_hours"),
      computeBenchmarkCoverage(adminSupabase),
      computeBenchmarkMetadataCoverage(adminSupabase),
      computePublicMetadataCoverage(adminSupabase),
      adminSupabase
        .from("workspace_deployments")
        .select(
          "id, model_slug, model_name, provider_name, status, deployment_kind, created_at, updated_at, last_error_message"
        )
        .order("updated_at", { ascending: false })
        .limit(1000),
      adminSupabase
        .from("cron_runs")
        .select("job_name, status, started_at, created_at")
        .in("job_name", Object.keys(PIPELINE_CRON_EXPECTATIONS))
        .gte(
          "created_at",
          new Date(Date.now() - PIPELINE_CRON_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
        )
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    if (dataSourcesResult.error) {
      throw new Error(`Failed to fetch data_sources: ${dataSourcesResult.error.message}`);
    }
    if (pipelineHealthResult.error) {
      throw new Error(`Failed to fetch pipeline_health: ${pipelineHealthResult.error.message}`);
    }
    if (
      deploymentRowsResult.error &&
      !isMissingDeploymentOperationsTableError(deploymentRowsResult.error)
    ) {
      throw new Error(`Failed to fetch workspace_deployments: ${deploymentRowsResult.error.message}`);
    }
    if (cronRunsResult.error) {
      throw new Error(`Failed to fetch cron_runs: ${cronRunsResult.error.message}`);
    }

    const dataSources = dataSourcesResult.data ?? [];
    const healthRows = pipelineHealthResult.data ?? [];
    const deploymentOperations = computeDeploymentOperationsSummary(
      deploymentRowsResult.error ? [] : deploymentRowsResult.data ?? []
    );
    const cronHealth = summarizePipelineCronHealth(cronRunsResult.data ?? []);
    const enabledManualBenchmarkSources = dataSources
      .map((source) => source.slug)
      .filter((slug) => MANUAL_BENCHMARK_SOURCE_SLUGS.has(slug));

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
      downCount > 0
        ? "down"
        : degradedCount > 0 || cronHealth.latestFailedJobCount > 0 || cronHealth.staleJobCount > 0
          ? "degraded"
          : "healthy";

    const checkedAt = new Date().toISOString();
    const stripePaymentsReadiness = getStripePaymentsReadiness();
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
    const dataQualityAlerts = computePipelineDataQualityAlerts({
      benchmarkCoverage: benchmarkCoverageSummary,
      publicMetadataCoverage: {
        officialCompleteDiscoveryMetadataPct:
          publicMetadataCoverage.official.completeDiscoveryMetadataPct,
        officialDefaultPublicSurfaceReadyPct:
          publicMetadataCoverage.official.defaultPublicSurfaceReadyPct,
        officialRankingContaminationCount:
          publicMetadataCoverage.official.rankingContaminationCount,
        lowTrustReadyCount: publicMetadataCoverage.lowTrustReadyCount,
        signalContaminationCount: publicMetadataCoverage.signalContaminationCount,
      },
      deploymentOperations: {
        staleProvisioningCount: deploymentOperations.totals.staleProvisioningCount,
        failedCount: deploymentOperations.totals.failedCount,
      },
      cronOperations: {
        staleJobCount: cronHealth.staleJobCount,
        latestFailedJobCount: cronHealth.latestFailedJobCount,
      },
      manualBenchmarkSources: {
        count: enabledManualBenchmarkSources.length,
        slugs: enabledManualBenchmarkSources,
      },
    });
    const dataQualityStatus = computePipelineDataQualityStatus(dataQualityAlerts);

    const detail = PipelineHealthDetailSchema.parse({
      status: topLevelStatus,
      dataQualityStatus,
      dataQualityAlerts,
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
      deploymentOperations: {
        ...deploymentOperations.totals,
        recentStaleProvisioning: deploymentOperations.recentStaleProvisioning,
        recentFailed: deploymentOperations.recentFailed,
      },
      cron: cronHealth,
      publicMetadataCoverage: {
        completeDiscoveryMetadataPct:
          publicMetadataCoverage.completeDiscoveryMetadataPct,
        defaultPublicSurfaceReadyPct:
          publicMetadataCoverage.defaultPublicSurfaceReadyPct,
        trustTierCounts: publicMetadataCoverage.trustTierCounts,
        lowTrustActiveCount: publicMetadataCoverage.lowTrustActiveCount,
        lowTrustReadyCount: publicMetadataCoverage.lowTrustReadyCount,
        signalContaminationCount:
          publicMetadataCoverage.signalContaminationCount,
        topReadinessBlockers:
          publicMetadataCoverage.topReadinessBlockers.slice(0, 5),
        missingCategoryCount: publicMetadataCoverage.missingCategoryCount,
        missingReleaseDateCount: publicMetadataCoverage.missingReleaseDateCount,
        openWeightsMissingLicenseCount:
          publicMetadataCoverage.openWeightsMissingLicenseCount,
        llmMissingContextWindowCount:
          publicMetadataCoverage.llmMissingContextWindowCount,
        rankingContaminationCount:
          publicMetadataCoverage.rankingContaminationCount,
        officialCompleteDiscoveryMetadataPct:
          publicMetadataCoverage.official.completeDiscoveryMetadataPct,
        officialDefaultPublicSurfaceReadyPct:
          publicMetadataCoverage.official.defaultPublicSurfaceReadyPct,
        officialMissingReleaseDateCount:
          publicMetadataCoverage.official.missingReleaseDateCount,
        officialRankingContaminationCount:
          publicMetadataCoverage.official.rankingContaminationCount,
        topOfficialReadinessBlockers:
          publicMetadataCoverage.official.topReadinessBlockers.slice(0, 5),
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
            ready_pct: provider.ready_pct,
            total: provider.total,
          })),
        recentIncompleteModels: publicMetadataCoverage.recentIncompleteModels,
        recentIncompleteOfficialModels:
          publicMetadataCoverage.official.recentIncompleteModels,
        recentNotReadyModels: publicMetadataCoverage.recentNotReadyModels,
        recentNotReadyOfficialModels:
          publicMetadataCoverage.official.recentNotReadyModels,
        recentRankingContaminationModels:
          publicMetadataCoverage.recentRankingContaminationModels,
        recentRankingContaminationOfficialModels:
          publicMetadataCoverage.official.recentRankingContaminationModels,
        recentLowTrustModels: publicMetadataCoverage.recentLowTrustModels,
        recentSignalContaminationModels:
          publicMetadataCoverage.recentSignalContaminationModels,
      },
      payments: {
        stripe: stripePaymentsReadiness,
      },
    });

    return NextResponse.json(detail);
  } catch (err) {
    return handleApiError(err, "admin/pipeline/health");
  }
}
