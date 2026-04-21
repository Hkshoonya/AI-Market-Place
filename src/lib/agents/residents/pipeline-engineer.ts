/**
 * Pipeline Engineer — Resident Agent
 *
 * Monitors data pipeline health, detects failures,
 * and attempts self-repair of broken data source adapters.
 *
 * Schedule: Every 6 hours (after T1 sync)
 * Capabilities: health_check, sync_repair, error_analysis, adapter_monitoring
 */

import type { AgentContext, AgentTaskResult, ResidentAgent } from "../types";
import { registerAgent } from "../registry";
import { loadAllAdapters, getAdapter, listAdapters } from "../../data-sources/registry";
import { runSingleSync } from "../../data-sources/orchestrator";
import { MANUAL_BENCHMARK_SOURCE_SLUGS } from "../../data-sources/manual-benchmark-sources";
import { makeSlug, resolveSecrets } from "../../data-sources/utils";
import type { DataSourceRecord } from "../../data-sources/types";
import { recordAgentIssue, recordAgentIssueFailure, resolveAgentIssue } from "../ledger";
import { computeBenchmarkCoverage } from "../../benchmark-coverage-compute";
import { computeBenchmarkMetadataCoverage } from "../../benchmark-metadata-coverage-compute";
import { fetchAllHomepageActiveModels } from "../../homepage/fetch-active-models";
import { computeHomepageRankingHealth } from "../../homepage/ranking-health";
import {
  MODEL_PUBLIC_RANKING_FIELDS,
  hasPublicRankingInputs,
  stripPublicRankingInputs,
} from "../../models/public-ranking-inputs";
import { hasLifecycleWarningLanguage } from "../../models/public-ranking-confidence";
import { computePublicRankingHealth } from "../../models/public-ranking-health";
import { summarizeBenchmarkSourceHealth } from "../../benchmark-source-health";
import { checkCrawlerSurfaceHealth } from "../../crawl-health";
import { getStripePaymentsHealth } from "../../payments/stripe-health";
import {
  PIPELINE_CRON_EXPECTATIONS,
  summarizePipelineCronHealth,
} from "../../pipeline-cron-health";
import {
  computeStatus,
  resolveEffectiveHealthRow,
} from "../../pipeline-health-compute";

const pipelineEngineer: ResidentAgent = {
  slug: "pipeline-engineer",
  name: "Pipeline Engineer",

  async run(ctx: AgentContext): Promise<AgentTaskResult> {
    const { supabase, log } = ctx;
    const sb = supabase;
    const errors: string[] = [];
    const output: Record<string, unknown> = {
      healthChecks: [],
      failedSources: [],
      repairAttempts: [],
      summary: {},
    };

    try {
      // Step 1: Load all adapters
      await loadAllAdapters();
      const adapterIds = listAdapters();
      await log.info(`Loaded ${adapterIds.length} adapters`);

      // Step 2: Fetch all enabled data sources
      const { data: sources, error: srcErr } = await sb
        .from("data_sources")
        .select("*")
        .eq("is_enabled", true)
        .order("tier", { ascending: true });

      if (srcErr) {
        errors.push(`Failed to fetch data sources: ${srcErr.message}`);
        return { success: false, output, errors };
      }

      const dataSources = (sources ?? []) as DataSourceRecord[];
      const enabledSourceSlugs = new Set(dataSources.map((source) => source.slug));
      const enabledManualBenchmarkSources = dataSources
        .map((source) => source.slug)
        .filter((slug) => MANUAL_BENCHMARK_SOURCE_SLUGS.has(slug));
      await log.info(`Found ${dataSources.length} enabled data sources`);

      // Step 3: Health check all adapters
      const healthChecks: Record<string, unknown>[] = [];
      for (const source of dataSources) {
        const adapter = getAdapter(source.adapter_type);
        if (!adapter) {
          healthChecks.push({
            source: source.slug,
            healthy: false,
            message: `No adapter for type "${source.adapter_type}"`,
          });
          continue;
        }

        try {
          const { secrets } = resolveSecrets(source.secret_env_keys);
          const result = await adapter.healthCheck(secrets);
          healthChecks.push({
            source: source.slug,
            healthy: result.healthy,
            latencyMs: result.latencyMs,
            message: result.message,
          });

          if (!result.healthy) {
            await log.warn(`Health check failed for ${source.slug}: ${result.message}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          healthChecks.push({
            source: source.slug,
            healthy: false,
            message: `Health check error: ${msg}`,
          });
          await log.error(`Health check error for ${source.slug}: ${msg}`);
        }
      }
      output.healthChecks = healthChecks;

      // Step 4: Find recently failed sync jobs (last 24 hours)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: failedJobs } = await sb
        .from("sync_jobs")
        .select("*")
        .eq("status", "failed")
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      const failedSources = new Set<string>();
      for (const job of failedJobs ?? []) {
        if (!enabledSourceSlugs.has(job.source)) continue;
        failedSources.add(job.source);
      }
      output.failedSources = Array.from(failedSources);

      for (const healthCheck of healthChecks) {
        const sourceSlug = String(healthCheck.source ?? "");
        const issueSlug = makeSlug(`pipeline-source-${sourceSlug}`);
        const failedRecently = failedSources.has(sourceSlug);
        const unhealthy = healthCheck.healthy === false;

        if (unhealthy || failedRecently) {
          await recordAgentIssue(sb, {
            slug: issueSlug,
            title: `Pipeline issue for ${sourceSlug}`,
            issueType: "source_health",
            source: sourceSlug,
            severity: failedRecently ? "high" : "medium",
            confidence: failedRecently ? 0.95 : 0.8,
            detectedBy: "pipeline-engineer",
            playbook: "resync_source",
            evidence: {
              failedRecently,
              unhealthy,
              healthMessage: healthCheck.message ?? null,
              latencyMs: healthCheck.latencyMs ?? null,
            },
          });
        } else {
          await resolveAgentIssue(sb, issueSlug, {
            verifier: "pipeline-engineer",
            reason: "source healthy and no recent failed sync jobs",
          }).catch(() => {});
        }
      }

      if (failedSources.size > 0) {
        await log.warn(
          `Found ${failedSources.size} failed sources in last 24h: ${Array.from(failedSources).join(", ")}`
        );
      } else {
        await log.info("No failed sync jobs in last 24 hours");
      }

      // Step 4a: Track benchmark-source freshness/failure health using the same
      // status rules as the public pipeline health endpoints.
      const { data: pipelineHealthRows, error: pipelineHealthError } = await sb
        .from("pipeline_health")
        .select(
          "source_slug, consecutive_failures, last_success_at, expected_interval_hours"
        );

      if (pipelineHealthError) {
        errors.push(`Failed to fetch pipeline health rows: ${pipelineHealthError.message}`);
      } else {
        const pipelineHealthBySource = new Map(
          (pipelineHealthRows ?? []).map((row) => [row.source_slug, row])
        );
        const benchmarkSourceHealth = summarizeBenchmarkSourceHealth(
          dataSources.map((source) => {
            const effectiveRow = resolveEffectiveHealthRow(
              source,
              pipelineHealthBySource.get(source.slug)
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

        output.benchmarkSourceHealth = benchmarkSourceHealth;

        for (const source of benchmarkSourceHealth.sources) {
          const issueSlug = makeSlug(`benchmark-source-health-${source.slug}`);
          const unhealthy = source.status !== "healthy";

          if (unhealthy) {
            await recordAgentIssue(sb, {
              slug: issueSlug,
              title: `Benchmark source health issue for ${source.slug}`,
              issueType: "benchmark_source_health",
              source: source.slug,
              severity: source.status === "down" ? "critical" : "high",
              confidence: 0.97,
              detectedBy: "pipeline-engineer",
              playbook: "repair_benchmark_source_sync",
              evidence: {
                sourceSlug: source.slug,
                status: source.status,
                lastSync: source.lastSync,
                consecutiveFailures: source.consecutiveFailures,
                recordCount: source.recordCount,
                error: source.error,
              },
            });
          } else {
            await resolveAgentIssue(sb, issueSlug, {
              verifier: "pipeline-engineer",
              reason: "benchmark source sync is fresh and healthy",
              sourceSlug: source.slug,
              status: source.status,
              lastSync: source.lastSync,
            }).catch(() => {});
          }
        }
      }

      // Step 4b: Track critical cron health
      const cronSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: cronRuns, error: cronRunsError } = await sb
        .from("cron_runs")
        .select("job_name, status, started_at, created_at")
        .in("job_name", Object.keys(PIPELINE_CRON_EXPECTATIONS))
        .gte("created_at", cronSince)
        .order("created_at", { ascending: false });

      if (cronRunsError) {
        errors.push(`Failed to fetch cron runs: ${cronRunsError.message}`);
      } else {
        const cronHealth = summarizePipelineCronHealth(cronRuns ?? []);
        output.cron = cronHealth;

        for (const job of cronHealth.criticalJobs) {
          const issueSlug = makeSlug(`pipeline-cron-${job.jobName}`);
          const unhealthy = job.stale || job.status === "failed" || job.status === "missing";

          if (unhealthy) {
            await recordAgentIssue(sb, {
              slug: issueSlug,
              title: `Pipeline cron issue for ${job.jobName}`,
              issueType: "pipeline_cron_health",
              source: job.jobName,
              severity: job.status === "failed" || job.status === "missing" ? "critical" : "high",
              confidence: 0.98,
              detectedBy: "pipeline-engineer",
              playbook: "rerun_pipeline_cron",
              evidence: {
                jobName: job.jobName,
                status: job.status,
                stale: job.stale,
                lastRunAt: job.lastRunAt,
                expectedIntervalHours: job.expectedIntervalHours,
              },
            });
          } else {
            await resolveAgentIssue(sb, issueSlug, {
              verifier: "pipeline-engineer",
              reason: "critical cron job is running on schedule",
              jobName: job.jobName,
              status: job.status,
              lastRunAt: job.lastRunAt,
            }).catch(() => {});
          }
        }
      }

      // Step 4c: Track manual benchmark sources that still require operator-maintained updates.
      output.manualBenchmarkSources = enabledManualBenchmarkSources;
      for (const sourceSlug of MANUAL_BENCHMARK_SOURCE_SLUGS) {
        const issueSlug = makeSlug(`manual-benchmark-source-${sourceSlug}`);
        const enabled = enabledSourceSlugs.has(sourceSlug);

        if (enabled) {
          await recordAgentIssue(sb, {
            slug: issueSlug,
            title: `Manual benchmark source still enabled for ${sourceSlug}`,
            issueType: "manual_benchmark_source",
            source: sourceSlug,
            severity: "high",
            confidence: 0.99,
            detectedBy: "pipeline-engineer",
            playbook: "replace_manual_benchmark_source",
            evidence: {
              sourceSlug,
              enabled: true,
              automationRequired: true,
              reason: "static benchmark adapter still depends on manual updates",
            },
          });
        } else {
          await resolveAgentIssue(sb, issueSlug, {
            verifier: "pipeline-engineer",
            reason: "manual benchmark source is no longer enabled",
            sourceSlug,
          }).catch(() => {});
        }
      }

      // Step 4d: Track aggregate benchmark automation gaps so stale rankings do not go unnoticed.
      try {
        const [benchmarkCoverage, benchmarkMetadataCoverage] = await Promise.all([
          computeBenchmarkCoverage(sb),
          computeBenchmarkMetadataCoverage(sb),
        ]);
        const benchmarkIssueSlug = "pipeline-benchmark-automation-gap";
        const officialGapCount =
          benchmarkCoverage.recent_sparse_benchmark_expected_official.length;
        const missingTrustedLocatorCount =
          benchmarkMetadataCoverage.missingTrustedLocatorCount;
        const benchmarkCoverageHealthy =
          officialGapCount === 0 && missingTrustedLocatorCount === 0;

        output.benchmarkCoverage = {
          officialGapCount,
          missingTrustedLocatorCount,
          trustedLocatorCoveragePct: benchmarkMetadataCoverage.trustedLocatorCoveragePct,
        };

        if (!benchmarkCoverageHealthy) {
          await recordAgentIssue(sb, {
            slug: benchmarkIssueSlug,
            title: "Benchmark automation coverage gaps detected",
            issueType: "benchmark_coverage_health",
            source: "benchmark-pipeline",
            severity:
              missingTrustedLocatorCount > 0 ? "critical" : "high",
            confidence: 0.99,
            detectedBy: "pipeline-engineer",
            playbook: "repair_benchmark_coverage",
            evidence: {
              officialGapCount,
              missingTrustedLocatorCount,
              trustedLocatorCoveragePct:
                benchmarkMetadataCoverage.trustedLocatorCoveragePct,
              recentOfficialGaps:
                benchmarkCoverage.recent_sparse_benchmark_expected_official,
              recentMissingTrustedLocators:
                benchmarkMetadataCoverage.recentMissingTrustedLocators,
            },
          });
        } else {
          await resolveAgentIssue(sb, benchmarkIssueSlug, {
            verifier: "pipeline-engineer",
            reason: "benchmark coverage and trusted benchmark locators are healthy",
            officialGapCount,
            missingTrustedLocatorCount,
            trustedLocatorCoveragePct:
              benchmarkMetadataCoverage.trustedLocatorCoveragePct,
          }).catch(() => {});
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to compute benchmark automation health: ${message}`);
        await log.error(`Benchmark automation health check failed: ${message}`);
      }

      // Step 4e: Track crawler-critical public routes so Search Console issues surface automatically.
      try {
        const crawlSurface = await checkCrawlerSurfaceHealth();
        output.crawlSurface = crawlSurface;
        const crawlIssueSlug = "pipeline-crawler-surface-health";
        const crawlIssueOpen = !crawlSurface.healthy || crawlSurface.warningCount > 0;

        if (crawlIssueOpen) {
          await recordAgentIssue(sb, {
            slug: crawlIssueSlug,
            title: "Crawler surface health issues detected",
            issueType: "crawler_surface_health",
            source: "public-web",
            severity: crawlSurface.criticalFailures > 0 ? "critical" : "high",
            confidence: 0.9,
            detectedBy: "pipeline-engineer",
            playbook: "inspect_crawler_surface",
            evidence: {
              healthy: crawlSurface.healthy,
              criticalFailures: crawlSurface.criticalFailures,
              warningCount: crawlSurface.warningCount,
              warnings: crawlSurface.warnings,
              routes: crawlSurface.routes,
            },
          });
        } else {
          await resolveAgentIssue(sb, crawlIssueSlug, {
            verifier: "pipeline-engineer",
            reason: "crawler-critical public routes are healthy and warning-free",
            healthy: crawlSurface.healthy,
            criticalFailures: crawlSurface.criticalFailures,
            warningCount: crawlSurface.warningCount,
          }).catch(() => {});
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to compute crawler surface health: ${message}`);
        await log.error(`Crawler surface health check failed: ${message}`);
      }

      // Step 4f: Track Stripe delivery readiness so checkout can not silently stop crediting wallets.
      try {
        const stripePaymentsHealth = await getStripePaymentsHealth(sb);
        output.payments = {
          stripe: stripePaymentsHealth,
        };
        const stripeIssueSlug = "pipeline-stripe-webhook-health";
        const stripeIssueOpen =
          stripePaymentsHealth.status === "partial" ||
          stripePaymentsHealth.webhookDelivery.status === "degraded" ||
          stripePaymentsHealth.webhookDelivery.tableAvailable === false;

        if (stripeIssueOpen) {
          await recordAgentIssue(sb, {
            slug: stripeIssueSlug,
            title: "Stripe payment health issues detected",
            issueType: "payments_webhook_health",
            source: "stripe",
            severity:
              stripePaymentsHealth.webhookDelivery.status === "degraded"
                ? "critical"
                : "high",
            confidence: 0.95,
            detectedBy: "pipeline-engineer",
            playbook: "inspect_stripe_payments",
            evidence: stripePaymentsHealth,
          });
        } else {
          await resolveAgentIssue(sb, stripeIssueSlug, {
            verifier: "pipeline-engineer",
            reason: "Stripe checkout configuration and webhook delivery health are both healthy",
            ...stripePaymentsHealth,
          }).catch(() => {});
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to compute Stripe payment health: ${message}`);
        await log.error(`Stripe payment health check failed: ${message}`);
      }

      // Step 4g: Track homepage ranking drift so fresh current flagships do not quietly disappear.
      try {
        const homepageModels = (await fetchAllHomepageActiveModels(
          sb as never
        )) as unknown as Parameters<typeof computeHomepageRankingHealth>[0];
        const lifecycleRepairCandidates = homepageModels.filter(
          (model) =>
            hasLifecycleWarningLanguage(model) && hasPublicRankingInputs(model)
        );
        const lifecycleRepairs: Array<{ id: string; slug: string }> = [];

        for (const candidate of lifecycleRepairCandidates.slice(0, 25)) {
          const sanitized = stripPublicRankingInputs(
            candidate as unknown as Record<string, unknown>
          );
          const updatePayload = Object.fromEntries(
            MODEL_PUBLIC_RANKING_FIELDS.map((field) => [
              field,
              sanitized[field] ?? null,
            ])
          );
          const { error } = await sb
            .from("models")
            .update(updatePayload)
            .eq("id", candidate.id);

          if (error) {
            errors.push(
              `Failed to auto-repair lifecycle ranking inputs for ${candidate.slug}: ${error.message}`
            );
            await log.warn(
              `Lifecycle ranking auto-repair failed for ${candidate.slug}: ${error.message}`
            );
            continue;
          }

          Object.assign(candidate, updatePayload);
          lifecycleRepairs.push({
            id: candidate.id,
            slug: candidate.slug ?? candidate.id,
          });
        }

        const homepageRankingHealth = computeHomepageRankingHealth(homepageModels);
        const publicRankingHealth = computePublicRankingHealth(
          homepageModels as unknown as Parameters<typeof computePublicRankingHealth>[0]
        );
        output.homepageRanking = homepageRankingHealth;
        output.publicRanking = publicRankingHealth;
        output.publicRankingAutoRepair = {
          attempted: lifecycleRepairCandidates.length,
          repaired: lifecycleRepairs.length,
          rows: lifecycleRepairs,
        };
        const homepageRankingIssueSlug = "pipeline-homepage-ranking-health";
        const homepageRankingIssueOpen = !homepageRankingHealth.healthy;
        const publicRankingIssueSlug = "pipeline-public-ranking-health";
        const publicRankingIssueOpen = !publicRankingHealth.healthy;

        if (homepageRankingIssueOpen) {
          await recordAgentIssue(sb, {
            slug: homepageRankingIssueSlug,
            title: "Homepage ranking drift detected",
            issueType: "homepage_ranking_health",
            source: "homepage-top-models",
            severity:
              homepageRankingHealth.missingRecentLeadership.length > 0
                ? "critical"
                : "high",
            confidence: 0.96,
            detectedBy: "pipeline-engineer",
            playbook: "repair_homepage_ranking",
            evidence: {
              ...homepageRankingHealth,
            },
          });
        } else {
          await resolveAgentIssue(sb, homepageRankingIssueSlug, {
            verifier: "pipeline-engineer",
            reason:
              "homepage shortlist does not contain superseded rows and includes current leadership candidates",
            ...homepageRankingHealth,
          }).catch(() => {});
        }

        if (publicRankingIssueOpen) {
          await recordAgentIssue(sb, {
            slug: publicRankingIssueSlug,
            title: "Public ranking drift detected",
            issueType: "public_ranking_health",
            source: "public-ranking-pool",
            severity:
              publicRankingHealth.missingRecentLeadership.length > 0
                ? "critical"
                : "high",
            confidence: 0.95,
            detectedBy: "pipeline-engineer",
            playbook: "repair_public_rankings",
            evidence: {
              ...publicRankingHealth,
            },
          });
        } else {
          await resolveAgentIssue(sb, publicRankingIssueSlug, {
            verifier: "pipeline-engineer",
            reason:
              "public ranking pool does not contain superseded rows and still includes current leadership candidates",
            ...publicRankingHealth,
          }).catch(() => {});
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to compute homepage ranking health: ${message}`);
        await log.error(`Homepage ranking health check failed: ${message}`);
      }

      // Step 5: Attempt repair of failed sources
      const maxRepairs = (ctx.agent.config.max_repair_attempts as number) ?? 3;
      const maxVerificationRetries =
        (ctx.agent.config.max_verification_retries as number) ?? 3;
      const repairAttempts: Record<string, unknown>[] = [];
      let repaired = 0;

      for (const slug of Array.from(failedSources).slice(0, maxRepairs)) {
        await log.info(`Attempting repair sync for: ${slug}`);
        try {
          const result = await runSingleSync(slug);
          const success = result.sourcesFailed === 0;
          repairAttempts.push({
            source: slug,
            success,
            recordsProcessed: result.details[0]?.recordsProcessed ?? 0,
            errors: result.details[0]?.errors?.map((e) => e.message) ?? [],
          });

          if (success) {
            repaired++;
            await log.info(`Successfully repaired: ${slug}`);
            await resolveAgentIssue(sb, makeSlug(`pipeline-source-${slug}`), {
              verifier: "pipeline-engineer",
              reason: "repair sync succeeded",
              recordsProcessed: result.details[0]?.recordsProcessed ?? 0,
            }).catch(() => {});
          } else {
            await log.warn(`Repair failed for: ${slug}`);
            await recordAgentIssueFailure(
              sb,
              makeSlug(`pipeline-source-${slug}`),
              {
                verifier: "pipeline-engineer",
                reason: "repair sync completed without clearing the failure",
                errors: result.details[0]?.errors?.map((error) => error.message) ?? [],
              },
              maxVerificationRetries
            ).catch(() => {});
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          repairAttempts.push({ source: slug, success: false, error: msg });
          await log.error(`Repair error for ${slug}: ${msg}`);
          await recordAgentIssueFailure(
            sb,
            makeSlug(`pipeline-source-${slug}`),
            {
              verifier: "pipeline-engineer",
              reason: "repair sync threw an error",
              error: msg,
            },
            maxVerificationRetries
          ).catch(() => {});
          errors.push(`Repair failed for ${slug}: ${msg}`);
        }
      }
      output.repairAttempts = repairAttempts;

      // Step 6: Summary
      const healthyCount = healthChecks.filter((h) => h.healthy).length;
      output.summary = {
        totalSources: dataSources.length,
        healthyAdapters: healthyCount,
        unhealthyAdapters: dataSources.length - healthyCount,
        failedInLast24h: failedSources.size,
        enabledManualBenchmarkSources: enabledManualBenchmarkSources.length,
        repairAttempts: repairAttempts.length,
        repairsSucceeded: repaired,
      };

      await log.info("Pipeline Engineer run complete", output.summary as Record<string, unknown>);

      return {
        success: errors.length === 0,
        output,
        errors,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      await log.error(`Pipeline Engineer crashed: ${msg}`);
      return { success: false, output, errors };
    }
  },
};

registerAgent(pipelineEngineer);
export default pipelineEngineer;
