import type { AgentContext, AgentTaskResult, ResidentAgent } from "../types";
import { registerAgent } from "../registry";
import { recordAgentIssueFailure, resolveAgentIssue } from "../ledger";
import { matchesAgentErrorPattern } from "../error-patterns";
import { MANUAL_BENCHMARK_SOURCE_SLUGS } from "../../data-sources/manual-benchmark-sources";
import {
  BENCHMARK_SOURCE_SLUGS,
  summarizeBenchmarkSourceHealth,
  type BenchmarkSourceHealthAdapter,
} from "../../benchmark-source-health";
import {
  PIPELINE_CRON_EXPECTATIONS,
  summarizePipelineCronHealth,
  type PipelineCronJobHealth,
  type PipelineCronJobName,
} from "../../pipeline-cron-health";
import {
  computeStatus,
  resolveEffectiveHealthRow,
} from "../../pipeline-health-compute";
import { computeBenchmarkCoverage } from "../../benchmark-coverage-compute";
import { computeBenchmarkMetadataCoverage } from "../../benchmark-metadata-coverage-compute";
import { fetchAllHomepageActiveModels } from "../../homepage/fetch-active-models";
import { computeHomepageRankingHealth } from "../../homepage/ranking-health";
import {
  buildContentQualityMetrics,
  countStaleSellerListings,
  collectPaginatedRows,
  filterBenchmarkEvidenceModelIds,
  filterCoveredActiveModelIds,
  filterUserVisiblePricedModelIds,
  countModelsMissingUserVisibleDescriptions,
  getDescriptionCoverageThreshold,
  type ActiveModelSummary,
} from "./ux-monitor";
import { checkCrawlerSurfaceHealth } from "../../crawl-health";
import { getStripePaymentsHealth, type StripePaymentsHealth } from "../../payments/stripe-health";

interface AgentIssueRow {
  slug: string;
  title: string;
  issue_type: string;
  source: string | null;
  status: "open" | "investigating" | "resolved" | "escalated" | "ignored";
  evidence: Record<string, unknown> | null;
}

interface DataSourceHealthRow {
  slug: string;
  is_enabled?: boolean | null;
  sync_interval_hours?: number | null;
  last_sync_records?: number | null;
  last_error_message?: string | null;
  quarantined_at?: string | null;
  last_sync_status: string | null;
  last_success_at: string | null;
  last_sync_at: string | null;
}

interface PipelineHealthSourceRow {
  source_slug: string | null;
  consecutive_failures: number | null;
  last_success_at: string | null;
  expected_interval_hours: number | null;
}

interface ModelCoverageRow {
  model_id: string | null;
}

interface BenchmarkEvidenceRow {
  related_model_ids: string[] | null;
}

interface DeploymentCoverageRow {
  model_id: string | null;
  status: string | null;
}

interface DeploymentPlatformCoverageRow {
  slug: string;
}

interface StaleListingCandidateRow {
  seller_id: string | null;
}

interface SellerProfileHealthRow {
  id: string;
  is_seller: boolean | null;
  seller_verified: boolean | null;
}

export interface UxIssueSnapshot {
  totalModels: number;
  missingDescription: number;
  missingBenchmarks: number;
  missingPricing: number;
  totalListings: number;
  staleListings: number;
}

export function isSourceIssueResolved(input: {
  isEnabled?: boolean;
  quarantinedAt?: string | null;
  lastSyncStatus: string | null;
  lastSuccessAt: string | null;
  lastSyncAt: string | null;
  failedSyncJobs24h: number;
}): boolean {
  if (input.isEnabled === false || input.quarantinedAt) {
    return true;
  }
  const hasSuccessfulSync = Boolean(input.lastSuccessAt ?? input.lastSyncAt);
  return input.lastSyncStatus === "success" && hasSuccessfulSync && input.failedSyncJobs24h === 0;
}

export function buildUxIssueStateMap(snapshot: UxIssueSnapshot): Record<string, boolean> {
  return {
    "ux-missing-model-descriptions":
      snapshot.missingDescription > getDescriptionCoverageThreshold(snapshot.totalModels),
    "ux-missing-benchmark-coverage": snapshot.missingBenchmarks > snapshot.totalModels * 0.5,
    "ux-missing-pricing-coverage": snapshot.missingPricing > snapshot.totalModels * 0.3,
    "ux-stale-marketplace-listings": snapshot.staleListings > 0,
  };
}

export function isRuntimeIssueResolved(
  recentErrorMessages: string[],
  issuePattern: string
): boolean {
  return !recentErrorMessages.some((message) => matchesAgentErrorPattern(message, issuePattern));
}

export function isPipelineCronIssueResolved(
  job: Pick<PipelineCronJobHealth, "status" | "stale">
): boolean {
  return job.status === "completed" && !job.stale;
}

export function isManualBenchmarkSourceIssueResolved(input: {
  sourceSlug: string;
  enabledSourceSlugs: Set<string>;
}): boolean {
  return (
    !input.enabledSourceSlugs.has(input.sourceSlug) ||
    !MANUAL_BENCHMARK_SOURCE_SLUGS.has(input.sourceSlug)
  );
}

export function isBenchmarkCoverageIssueResolved(input: {
  officialGapCount: number;
  missingTrustedLocatorCount: number;
}): boolean {
  return input.officialGapCount === 0 && input.missingTrustedLocatorCount === 0;
}

export function isBenchmarkSourceIssueResolved(input: {
  sourceSlug: string;
  enabledSourceSlugs: Set<string>;
  benchmarkSourceHealthBySlug: Map<string, BenchmarkSourceHealthAdapter>;
}): boolean {
  if (!input.enabledSourceSlugs.has(input.sourceSlug)) {
    return true;
  }

  if (!BENCHMARK_SOURCE_SLUGS.has(input.sourceSlug)) {
    return true;
  }

  return input.benchmarkSourceHealthBySlug.get(input.sourceSlug)?.status === "healthy";
}

export function isCrawlerSurfaceIssueResolved(input: {
  healthy: boolean;
  warningCount: number;
}): boolean {
  return input.healthy && input.warningCount === 0;
}

export function isStripePaymentsIssueResolved(input: StripePaymentsHealth): boolean {
  return (
    input.status !== "partial" &&
    input.webhookDelivery.status !== "degraded" &&
    input.webhookDelivery.tableAvailable !== false
  );
}

export function isHomepageRankingIssueResolved(input: { healthy: boolean }): boolean {
  return input.healthy;
}

async function loadUxIssueSnapshot(ctx: AgentContext): Promise<UxIssueSnapshot> {
  const sb = ctx.supabase;
  const activeModels = await collectPaginatedRows<ActiveModelSummary>(async (from, to) => {
    const { data, error } = await sb
      .from("models")
      .select(
        "id, slug, name, provider, category, description, short_description, is_open_weights, parameter_count, context_window, capabilities"
      )
      .eq("status", "active")
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch active models: ${error.message}`);
    }

    return (data ?? []) as ActiveModelSummary[];
  });

  const activeModelIds = new Set(activeModels.map((model) => model.id));
  const missingDescription = countModelsMissingUserVisibleDescriptions(activeModels);

  const [benchmarkRows, benchmarkEvidenceRows, pricingRows, deploymentRows, platformRows] =
    await Promise.all([
      collectPaginatedRows<ModelCoverageRow>(async (from, to) => {
        const { data, error } = await sb
          .from("benchmark_scores")
          .select("model_id")
          .order("model_id", { ascending: true })
          .range(from, to);

        if (error) {
          throw new Error(`Failed to fetch benchmark coverage: ${error.message}`);
        }

        return (data ?? []) as ModelCoverageRow[];
      }),
      collectPaginatedRows<BenchmarkEvidenceRow>(async (from, to) => {
        const { data, error } = await sb
          .from("model_news")
          .select("related_model_ids")
          .eq("category", "benchmark")
          .order("published_at", { ascending: false })
          .range(from, to);

        if (error) {
          throw new Error(`Failed to fetch benchmark evidence coverage: ${error.message}`);
        }

        return (data ?? []) as BenchmarkEvidenceRow[];
      }),
    collectPaginatedRows<ModelCoverageRow>(async (from, to) => {
      const { data, error } = await sb
        .from("model_pricing")
        .select("model_id")
        .order("model_id", { ascending: true })
        .range(from, to);

      if (error) {
        throw new Error(`Failed to fetch pricing coverage: ${error.message}`);
      }

      return (data ?? []) as ModelCoverageRow[];
    }),
    collectPaginatedRows<DeploymentCoverageRow>(async (from, to) => {
      const { data, error } = await sb
        .from("model_deployments")
        .select("model_id, status")
        .order("model_id", { ascending: true })
        .range(from, to);

      if (error) {
        throw new Error(`Failed to fetch deployment coverage: ${error.message}`);
      }

      return (data ?? []) as DeploymentCoverageRow[];
    }),
    collectPaginatedRows<DeploymentPlatformCoverageRow>(async (from, to) => {
      const { data, error } = await sb
        .from("deployment_platforms")
        .select("slug")
        .order("slug", { ascending: true })
        .range(from, to);

      if (error) {
        throw new Error(`Failed to fetch deployment platforms: ${error.message}`);
      }

      return (data ?? []) as DeploymentPlatformCoverageRow[];
    }),
  ]);

  const contentQuality = buildContentQualityMetrics({
    activeModels,
    missingDescriptionCount: missingDescription,
    benchmarkedModelIds: new Set([
      ...filterCoveredActiveModelIds(benchmarkRows, activeModelIds),
      ...filterBenchmarkEvidenceModelIds(benchmarkEvidenceRows, activeModelIds),
    ]),
    pricedModelIds: filterUserVisiblePricedModelIds({
      activeModels,
      pricedModelIds: filterCoveredActiveModelIds(pricingRows, activeModelIds),
      directDeploymentModelIds: filterCoveredActiveModelIds(
        deploymentRows.filter((row) => !row.status || row.status === "available"),
        activeModelIds
      ),
      availablePlatformSlugs: new Set(platformRows.map((row) => row.slug)),
    }),
  });

  const { count: totalListings } = await sb
    .from("marketplace_listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: staleListingCandidates, error: staleListingError } = await sb
    .from("marketplace_listings")
    .select("seller_id")
    .eq("status", "active")
    .eq("view_count", 0)
    .lte("created_at", weekAgo);

  if (staleListingError) {
    throw new Error(`Failed to fetch stale listings: ${staleListingError.message}`);
  }

  const staleSellerIds = Array.from(
    new Set(
      (staleListingCandidates ?? [])
        .map((listing) => listing.seller_id)
        .filter((sellerId): sellerId is string => Boolean(sellerId))
    )
  );

  const sellerProfiles =
    staleSellerIds.length > 0
      ? await (async () => {
          const { data, error } = await sb
            .from("profiles")
            .select("id, is_seller, seller_verified")
            .in("id", staleSellerIds);

          if (error) {
            throw new Error(`Failed to fetch seller profiles: ${error.message}`);
          }

          return (data ?? []) as SellerProfileHealthRow[];
        })()
      : [];

  const staleListings = countStaleSellerListings({
    listings: (staleListingCandidates ?? []) as StaleListingCandidateRow[],
    sellerProfiles,
  });

  return {
    totalModels: contentQuality.totalActiveModels,
    missingDescription: contentQuality.missingDescription,
    missingBenchmarks: contentQuality.missingBenchmarks,
    missingPricing: contentQuality.missingPricing,
    totalListings: totalListings ?? 0,
    staleListings,
  };
}

const verifier: ResidentAgent = {
  slug: "verifier",
  name: "Verifier Agent",

  async run(ctx: AgentContext): Promise<AgentTaskResult> {
    const { supabase, log } = ctx;
    const sb = supabase;
    const output: Record<string, unknown> = {
      issuesScanned: 0,
      resolved: [],
      escalated: [],
      skipped: [],
      summary: {},
    };
    const errors: string[] = [];

    try {
      const maxIssues = (ctx.agent.config.max_issues_per_run as number) ?? 25;
      const maxVerificationRetries =
        (ctx.agent.config.max_verification_retries as number) ?? 3;
      const verificationWindowHours =
        (ctx.agent.config.verification_window_hours as number) ?? 24;
      const since = new Date(
        Date.now() - verificationWindowHours * 60 * 60 * 1000
      ).toISOString();

      const { data: issues, error: issueError } = await sb
        .from("agent_issues")
        .select("slug, title, issue_type, source, status, evidence")
        .in("status", ["open", "investigating", "escalated"])
        .order("updated_at", { ascending: false })
        .limit(maxIssues);

      if (issueError) {
        throw new Error(`Failed to load agent issues: ${issueError.message}`);
      }

      const issueRows = (issues ?? []) as AgentIssueRow[];
      output.issuesScanned = issueRows.length;

      let uxSnapshot: UxIssueSnapshot | null = null;
      let recentErrorMessages: string[] | null = null;
      let cronHealthByJob: Map<PipelineCronJobName, PipelineCronJobHealth> | null = null;
      let enabledSourceSlugs: Set<string> | null = null;
      let benchmarkSourceHealthBySlug: Map<string, BenchmarkSourceHealthAdapter> | null = null;
      let benchmarkHealth:
        | {
            officialGapCount: number;
            missingTrustedLocatorCount: number;
            trustedLocatorCoveragePct: number;
          }
        | null = null;
      let stripePaymentsHealth: StripePaymentsHealth | null = null;
      let homepageRankingHealth:
        | ReturnType<typeof computeHomepageRankingHealth>
        | null = null;
      let crawlSurfaceHealth:
        | {
            healthy: boolean;
            criticalFailures: number;
            warningCount: number;
            warnings: string[];
          }
        | null = null;

      for (const issue of issueRows) {
        try {
          if (issue.issue_type === "source_health") {
            if (!issue.source) {
              output.skipped = [
                ...(output.skipped as string[]),
                `${issue.slug}: missing source slug`,
              ];
              continue;
            }

            const [{ data: source }, { count: failedSyncJobs }] = await Promise.all([
              sb
                .from("data_sources")
                .select(
                  "slug, is_enabled, quarantined_at, last_sync_status, last_success_at, last_sync_at"
                )
                .eq("slug", issue.source)
                .maybeSingle(),
              sb
                .from("sync_jobs")
                .select("*", { count: "exact", head: true })
                .eq("source", issue.source)
                .eq("status", "failed")
                .gte("created_at", since),
            ]);

            const sourceRow = source as DataSourceHealthRow | null;
            const resolved =
              sourceRow != null &&
              isSourceIssueResolved({
                isEnabled: sourceRow.is_enabled ?? true,
                quarantinedAt: sourceRow.quarantined_at ?? null,
                lastSyncStatus: sourceRow.last_sync_status,
                lastSuccessAt: sourceRow.last_success_at,
                lastSyncAt: sourceRow.last_sync_at,
                failedSyncJobs24h: failedSyncJobs ?? 0,
              });

            if (resolved) {
              await resolveAgentIssue(sb, issue.slug, {
                verifier: "verifier",
                issueType: issue.issue_type,
                source: issue.source,
                reason: "source sync status is healthy and no recent failed jobs remain",
              });
              (output.resolved as string[]).push(issue.slug);
            } else {
              await recordAgentIssueFailure(
                sb,
                issue.slug,
                {
                  verifier: "verifier",
                  issueType: issue.issue_type,
                  source: issue.source,
                  reason: "source still unhealthy or failed jobs are still present",
                },
                maxVerificationRetries
              );
              (output.escalated as string[]).push(issue.slug);
            }

            continue;
          }

          if (issue.issue_type === "ux_health") {
            uxSnapshot ??= await loadUxIssueSnapshot(ctx);
            const stateMap = buildUxIssueStateMap(uxSnapshot);
            const stillActive = stateMap[issue.slug] ?? false;

            if (!stillActive) {
              await resolveAgentIssue(sb, issue.slug, {
                verifier: "verifier",
                issueType: issue.issue_type,
                snapshot: uxSnapshot,
                reason: "ux metric thresholds are back under the alert boundary",
              });
              (output.resolved as string[]).push(issue.slug);
            } else {
              await recordAgentIssueFailure(
                sb,
                issue.slug,
                {
                  verifier: "verifier",
                  issueType: issue.issue_type,
                  snapshot: uxSnapshot,
                  reason: "ux metric threshold is still breached",
                },
                maxVerificationRetries
              );
              (output.escalated as string[]).push(issue.slug);
            }

            continue;
          }

          if (issue.issue_type === "pipeline_cron_health") {
            cronHealthByJob ??= await (async () => {
              const cronSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
              const { data, error } = await sb
                .from("cron_runs")
                .select("job_name, status, started_at, created_at")
                .in("job_name", Object.keys(PIPELINE_CRON_EXPECTATIONS))
                .gte("created_at", cronSince);

              if (error) {
                throw new Error(`Failed to fetch cron run health: ${error.message}`);
              }

              return new Map(
                summarizePipelineCronHealth(data ?? []).criticalJobs.map((job) => [
                  job.jobName,
                  job,
                ])
              );
            })();

            const jobName = issue.source as PipelineCronJobName | null;
            const jobHealth = jobName ? cronHealthByJob.get(jobName) ?? null : null;
            const resolved = jobHealth ? isPipelineCronIssueResolved(jobHealth) : false;

            if (resolved) {
              await resolveAgentIssue(sb, issue.slug, {
                verifier: "verifier",
                issueType: issue.issue_type,
                jobName,
                status: jobHealth?.status ?? null,
                stale: jobHealth?.stale ?? null,
                lastRunAt: jobHealth?.lastRunAt ?? null,
                reason: "critical cron job is completed and no longer stale",
              });
              (output.resolved as string[]).push(issue.slug);
            } else {
              await recordAgentIssueFailure(
                sb,
                issue.slug,
                {
                  verifier: "verifier",
                  issueType: issue.issue_type,
                  jobName,
                  status: jobHealth?.status ?? "missing",
                  stale: jobHealth?.stale ?? true,
                  lastRunAt: jobHealth?.lastRunAt ?? null,
                  reason: "critical cron job is still failed, missing, running, or stale",
                },
                maxVerificationRetries
              );
              (output.escalated as string[]).push(issue.slug);
            }

            continue;
          }

          if (issue.issue_type === "manual_benchmark_source") {
            enabledSourceSlugs ??= await (async () => {
              const { data, error } = await sb
                .from("data_sources")
                .select("slug")
                .eq("is_enabled", true);

              if (error) {
                throw new Error(`Failed to fetch enabled data sources: ${error.message}`);
              }

              return new Set(
                (data ?? [])
                  .map((row) => row.slug)
                  .filter((slug): slug is string => typeof slug === "string")
              );
            })();

            const sourceSlug = issue.source ?? "";
            const resolved = isManualBenchmarkSourceIssueResolved({
              sourceSlug,
              enabledSourceSlugs,
            });

            if (resolved) {
              await resolveAgentIssue(sb, issue.slug, {
                verifier: "verifier",
                issueType: issue.issue_type,
                source: sourceSlug,
                reason: "manual benchmark source is disabled or removed from the manual-source list",
              });
              (output.resolved as string[]).push(issue.slug);
            } else {
              await recordAgentIssueFailure(
                sb,
                issue.slug,
                {
                  verifier: "verifier",
                  issueType: issue.issue_type,
                  source: sourceSlug,
                  reason: "manual benchmark source is still enabled and still requires automation work",
                },
                maxVerificationRetries
              );
              (output.escalated as string[]).push(issue.slug);
            }

            continue;
          }

          if (issue.issue_type === "benchmark_source_health") {
            enabledSourceSlugs ??= await (async () => {
              const { data, error } = await sb
                .from("data_sources")
                .select("slug")
                .eq("is_enabled", true);

              if (error) {
                throw new Error(`Failed to fetch enabled data sources: ${error.message}`);
              }

              return new Set(
                (data ?? [])
                  .map((row) => row.slug)
                  .filter((slug): slug is string => typeof slug === "string")
              );
            })();

            benchmarkSourceHealthBySlug ??= await (async () => {
              const [{ data: sourceRows, error: sourceError }, { data: healthRows, error: healthError }] =
                await Promise.all([
                  sb
                    .from("data_sources")
                    .select(
                      "slug, is_enabled, sync_interval_hours, last_success_at, last_sync_at, last_sync_records, last_error_message"
                    )
                    .eq("is_enabled", true),
                  sb
                    .from("pipeline_health")
                    .select(
                      "source_slug, consecutive_failures, last_success_at, expected_interval_hours"
                    ),
                ]);

              if (sourceError) {
                throw new Error(
                  `Failed to fetch benchmark source rows: ${sourceError.message}`
                );
              }

              if (healthError) {
                throw new Error(
                  `Failed to fetch benchmark source health rows: ${healthError.message}`
                );
              }

              const healthBySource = new Map(
                ((healthRows ?? []) as PipelineHealthSourceRow[])
                  .filter(
                    (row): row is PipelineHealthSourceRow & { source_slug: string } =>
                      typeof row.source_slug === "string"
                  )
                  .map((row) => [row.source_slug, row])
              );

              const summary = summarizeBenchmarkSourceHealth(
                ((sourceRows ?? []) as DataSourceHealthRow[]).map((source) => {
                  const healthRow = healthBySource.get(source.slug);
                  const effectiveRow = resolveEffectiveHealthRow(
                    source,
                    healthRow
                      ? {
                          consecutive_failures: healthRow.consecutive_failures ?? 0,
                          last_success_at: healthRow.last_success_at ?? null,
                          expected_interval_hours:
                            healthRow.expected_interval_hours ?? 0,
                        }
                      : null
                  );

                  return {
                    slug: source.slug,
                    status: computeStatus(effectiveRow),
                    lastSync: effectiveRow.last_success_at,
                    consecutiveFailures: effectiveRow.consecutive_failures,
                    recordCount: source.last_sync_records ?? 0,
                    error: source.last_error_message ?? null,
                  };
                })
              );

              return new Map(summary.sources.map((source) => [source.slug, source]));
            })();

            const sourceSlug = issue.source ?? "";
            const resolved = isBenchmarkSourceIssueResolved({
              sourceSlug,
              enabledSourceSlugs,
              benchmarkSourceHealthBySlug,
            });
            const sourceHealth = benchmarkSourceHealthBySlug.get(sourceSlug) ?? null;

            if (resolved) {
              await resolveAgentIssue(sb, issue.slug, {
                verifier: "verifier",
                issueType: issue.issue_type,
                source: sourceSlug,
                status: sourceHealth?.status ?? "healthy",
                lastSync: sourceHealth?.lastSync ?? null,
                reason: "benchmark source sync is healthy or no longer relevant",
              });
              (output.resolved as string[]).push(issue.slug);
            } else {
              await recordAgentIssueFailure(
                sb,
                issue.slug,
                {
                  verifier: "verifier",
                  issueType: issue.issue_type,
                  source: sourceSlug,
                  status: sourceHealth?.status ?? "down",
                  lastSync: sourceHealth?.lastSync ?? null,
                  consecutiveFailures: sourceHealth?.consecutiveFailures ?? null,
                  reason: "benchmark source sync is still stale, degraded, or failing",
                },
                maxVerificationRetries
              );
              (output.escalated as string[]).push(issue.slug);
            }

            continue;
          }

          if (issue.issue_type === "benchmark_coverage_health") {
            benchmarkHealth ??= await (async () => {
              const [benchmarkCoverage, benchmarkMetadataCoverage] = await Promise.all([
                computeBenchmarkCoverage(sb),
                computeBenchmarkMetadataCoverage(sb),
              ]);

              return {
                officialGapCount:
                  benchmarkCoverage.recent_sparse_benchmark_expected_official.length,
                missingTrustedLocatorCount:
                  benchmarkMetadataCoverage.missingTrustedLocatorCount,
                trustedLocatorCoveragePct:
                  benchmarkMetadataCoverage.trustedLocatorCoveragePct,
              };
            })();

            const resolved = isBenchmarkCoverageIssueResolved(benchmarkHealth);

            if (resolved) {
              await resolveAgentIssue(sb, issue.slug, {
                verifier: "verifier",
                issueType: issue.issue_type,
                reason: "benchmark coverage gaps and trusted locator gaps are resolved",
                ...benchmarkHealth,
              });
              (output.resolved as string[]).push(issue.slug);
            } else {
              await recordAgentIssueFailure(
                sb,
                issue.slug,
                {
                  verifier: "verifier",
                  issueType: issue.issue_type,
                  reason: "benchmark coverage gaps or trusted locator gaps still remain",
                  ...benchmarkHealth,
                },
                maxVerificationRetries
              );
              (output.escalated as string[]).push(issue.slug);
            }

            continue;
          }

          if (issue.issue_type === "crawler_surface_health") {
            crawlSurfaceHealth ??= await (async () => {
              const crawlSurface = await checkCrawlerSurfaceHealth();
              return {
                healthy: crawlSurface.healthy,
                criticalFailures: crawlSurface.criticalFailures,
                warningCount: crawlSurface.warningCount,
                warnings: crawlSurface.warnings,
              };
            })();

            const resolved = isCrawlerSurfaceIssueResolved(crawlSurfaceHealth);

            if (resolved) {
              await resolveAgentIssue(sb, issue.slug, {
                verifier: "verifier",
                issueType: issue.issue_type,
                reason: "crawler-critical public routes are healthy and warning-free",
                ...crawlSurfaceHealth,
              });
              (output.resolved as string[]).push(issue.slug);
            } else {
              await recordAgentIssueFailure(
                sb,
                issue.slug,
                {
                  verifier: "verifier",
                  issueType: issue.issue_type,
                  reason: "crawler-critical public routes still have failures or crawler warnings",
                  ...crawlSurfaceHealth,
                },
                maxVerificationRetries
              );
              (output.escalated as string[]).push(issue.slug);
            }

            continue;
          }

          if (issue.issue_type === "payments_webhook_health") {
            stripePaymentsHealth ??= await getStripePaymentsHealth(sb);
            const resolved = isStripePaymentsIssueResolved(stripePaymentsHealth);

            if (resolved) {
              await resolveAgentIssue(sb, issue.slug, {
                verifier: "verifier",
                issueType: issue.issue_type,
                reason: "Stripe checkout configuration is complete and webhook delivery health is no longer degraded",
                ...stripePaymentsHealth,
              });
              (output.resolved as string[]).push(issue.slug);
            } else {
              await recordAgentIssueFailure(
                sb,
                issue.slug,
                {
                  verifier: "verifier",
                  issueType: issue.issue_type,
                  reason: "Stripe payment configuration or webhook delivery health still requires attention",
                  ...stripePaymentsHealth,
                },
                maxVerificationRetries
              );
              (output.escalated as string[]).push(issue.slug);
            }

            continue;
          }

          if (issue.issue_type === "homepage_ranking_health") {
            homepageRankingHealth ??= await (async () => {
              const homepageModels = (await fetchAllHomepageActiveModels(
                sb as never
              )) as unknown as Parameters<typeof computeHomepageRankingHealth>[0];
              return computeHomepageRankingHealth(homepageModels);
            })();
            const resolved = isHomepageRankingIssueResolved(homepageRankingHealth);

            if (resolved) {
              await resolveAgentIssue(sb, issue.slug, {
                verifier: "verifier",
                issueType: issue.issue_type,
                reason:
                  "homepage shortlist includes current leadership candidates and no longer surfaces superseded rows",
                ...homepageRankingHealth,
              });
              (output.resolved as string[]).push(issue.slug);
            } else {
              await recordAgentIssueFailure(
                sb,
                issue.slug,
                {
                  verifier: "verifier",
                  issueType: issue.issue_type,
                  reason:
                    "homepage shortlist is still missing current leadership rows or still surfaces superseded lifecycle rows",
                  ...homepageRankingHealth,
                },
                maxVerificationRetries
              );
              (output.escalated as string[]).push(issue.slug);
            }

            continue;
          }

          if (issue.issue_type === "runtime_error_pattern") {
            recentErrorMessages ??= (
              (
                await sb
                  .from("agent_logs")
                  .select("message")
                  .eq("level", "error")
                  .gte("created_at", since)
              ).data ?? []
            )
              .map((entry) => entry.message)
              .filter((message): message is string => typeof message === "string");

            const issuePattern =
              typeof issue.evidence?.pattern === "string" ? issue.evidence.pattern : "";
            const resolved = issuePattern
              ? isRuntimeIssueResolved(recentErrorMessages, issuePattern)
              : false;

            if (resolved) {
              await resolveAgentIssue(sb, issue.slug, {
                verifier: "verifier",
                issueType: issue.issue_type,
                verificationWindowHours,
                reason: "no matching runtime error pattern was seen in the verification window",
              });
              (output.resolved as string[]).push(issue.slug);
            } else {
              await recordAgentIssueFailure(
                sb,
                issue.slug,
                {
                  verifier: "verifier",
                  issueType: issue.issue_type,
                  verificationWindowHours,
                  reason: "matching runtime error pattern is still present",
                },
                maxVerificationRetries
              );
              (output.escalated as string[]).push(issue.slug);
            }

            continue;
          }

          (output.skipped as string[]).push(`${issue.slug}: unsupported issue type ${issue.issue_type}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${issue.slug}: ${message}`);
          await log.warn(`Verifier failed for ${issue.slug}: ${message}`);
        }
      }

      output.summary = {
        issuesScanned: output.issuesScanned,
        resolvedCount: (output.resolved as string[]).length,
        escalatedCount: (output.escalated as string[]).length,
        skippedCount: (output.skipped as string[]).length,
      };

      await log.info("Verifier Agent run complete", output.summary as Record<string, unknown>);
      return { success: errors.length === 0, output, errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      await log.error(`Verifier Agent crashed: ${message}`);
      return { success: false, output, errors };
    }
  },
};

registerAgent(verifier);
export default verifier;
