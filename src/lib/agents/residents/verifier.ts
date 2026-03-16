import type { AgentContext, AgentTaskResult, ResidentAgent } from "../types";
import { registerAgent } from "../registry";
import { recordAgentIssueFailure, resolveAgentIssue } from "../ledger";
import { matchesAgentErrorPattern } from "../error-patterns";
import {
  buildContentQualityMetrics,
  collectPaginatedRows,
  filterCoveredActiveModelIds,
  type ActiveModelSummary,
} from "./ux-monitor";

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
  last_sync_status: string | null;
  last_success_at: string | null;
  last_sync_at: string | null;
}

interface ModelCoverageRow {
  model_id: string | null;
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
  lastSyncStatus: string | null;
  lastSuccessAt: string | null;
  lastSyncAt: string | null;
  failedSyncJobs24h: number;
}): boolean {
  const hasSuccessfulSync = Boolean(input.lastSuccessAt ?? input.lastSyncAt);
  return input.lastSyncStatus === "success" && hasSuccessfulSync && input.failedSyncJobs24h === 0;
}

export function buildUxIssueStateMap(snapshot: UxIssueSnapshot): Record<string, boolean> {
  return {
    "ux-missing-model-descriptions": snapshot.missingDescription > 5,
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

async function loadUxIssueSnapshot(ctx: AgentContext): Promise<UxIssueSnapshot> {
  const sb = ctx.supabase;
  const { count: missingDescription } = await sb
    .from("models")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .is("description", null);

  const activeModels = await collectPaginatedRows<ActiveModelSummary>(async (from, to) => {
    const { data, error } = await sb
      .from("models")
      .select("id, category")
      .eq("status", "active")
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch active models: ${error.message}`);
    }

    return (data ?? []) as ActiveModelSummary[];
  });

  const activeModelIds = new Set(activeModels.map((model) => model.id));

  const benchmarkRows = await collectPaginatedRows<ModelCoverageRow>(async (from, to) => {
    const { data, error } = await sb
      .from("benchmark_scores")
      .select("model_id")
      .order("model_id", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch benchmark coverage: ${error.message}`);
    }

    return (data ?? []) as ModelCoverageRow[];
  });

  const pricingRows = await collectPaginatedRows<ModelCoverageRow>(async (from, to) => {
    const { data, error } = await sb
      .from("model_pricing")
      .select("model_id")
      .order("model_id", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch pricing coverage: ${error.message}`);
    }

    return (data ?? []) as ModelCoverageRow[];
  });

  const contentQuality = buildContentQualityMetrics({
    activeModels,
    missingDescriptionCount: missingDescription ?? 0,
    benchmarkedModelIds: filterCoveredActiveModelIds(benchmarkRows, activeModelIds),
    pricedModelIds: filterCoveredActiveModelIds(pricingRows, activeModelIds),
  });

  const { count: totalListings } = await sb
    .from("marketplace_listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: staleListings } = await sb
    .from("marketplace_listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("view_count", 0)
    .lte("created_at", weekAgo);

  return {
    totalModels: contentQuality.totalActiveModels,
    missingDescription: contentQuality.missingDescription,
    missingBenchmarks: contentQuality.missingBenchmarks,
    missingPricing: contentQuality.missingPricing,
    totalListings: totalListings ?? 0,
    staleListings: staleListings ?? 0,
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
        .in("status", ["open", "investigating"])
        .order("updated_at", { ascending: false })
        .limit(maxIssues);

      if (issueError) {
        throw new Error(`Failed to load agent issues: ${issueError.message}`);
      }

      const issueRows = (issues ?? []) as AgentIssueRow[];
      output.issuesScanned = issueRows.length;

      let uxSnapshot: UxIssueSnapshot | null = null;
      let recentErrorMessages: string[] | null = null;

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
                .select("slug, last_sync_status, last_success_at, last_sync_at")
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
