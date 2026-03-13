/**
 * UX Optimization Monitor — Resident Agent
 *
 * Audits page engagement, content quality, and data completeness
 * to suggest improvements for the platform.
 *
 * Schedule: Weekly on Monday at 10 AM
 * Capabilities: engagement_analysis, accessibility_audit, performance_check, report_generation
 */

import type { AgentContext, AgentTaskResult, ResidentAgent } from "../types";
import { registerAgent } from "../registry";
import { recordAgentIssue, resolveAgentIssue } from "../ledger";

export interface ActiveModelSummary {
  id: string;
  category: string | null;
}

interface ModelCoverageRow {
  model_id: string | null;
}

interface ContentQualityMetrics {
  totalActiveModels: number;
  missingDescription: number;
  missingBenchmarks: number;
  missingPricing: number;
  completenessScore: number;
}

export async function collectPaginatedRows<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);

    if (page.length < pageSize) {
      return rows;
    }
  }
}

export function filterCoveredActiveModelIds(
  rows: ModelCoverageRow[],
  activeModelIds: Set<string>
): Set<string> {
  const coveredModelIds = new Set<string>();

  for (const row of rows) {
    if (row.model_id && activeModelIds.has(row.model_id)) {
      coveredModelIds.add(row.model_id);
    }
  }

  return coveredModelIds;
}

export function buildContentQualityMetrics({
  activeModels,
  missingDescriptionCount,
  benchmarkedModelIds,
  pricedModelIds,
}: {
  activeModels: ActiveModelSummary[];
  missingDescriptionCount: number;
  benchmarkedModelIds: Set<string>;
  pricedModelIds: Set<string>;
}): ContentQualityMetrics {
  const totalActiveModels = activeModels.length;
  const missingBenchmarks = activeModels.filter(
    (model) => !benchmarkedModelIds.has(model.id)
  ).length;
  const missingPricing = activeModels.filter(
    (model) => !pricedModelIds.has(model.id)
  ).length;

  const describedModels = totalActiveModels - missingDescriptionCount;
  const benchmarkedModels = totalActiveModels - missingBenchmarks;
  const pricedModels = totalActiveModels - missingPricing;

  const completenessScore =
    totalActiveModels > 0
      ? Math.round(
          ((describedModels + benchmarkedModels + pricedModels) /
            (totalActiveModels * 3)) *
            100
        )
      : 0;

  return {
    totalActiveModels,
    missingDescription: missingDescriptionCount,
    missingBenchmarks,
    missingPricing,
    completenessScore,
  };
}

const uxMonitor: ResidentAgent = {
  slug: "ux-monitor",
  name: "UX Optimization Monitor",

  async run(ctx: AgentContext): Promise<AgentTaskResult> {
    const { supabase, log } = ctx;
    const sb = supabase;
    const errors: string[] = [];
    const output: Record<string, unknown> = {
      contentQuality: {},
      engagementMetrics: {},
      marketplaceHealth: {},
      recommendations: [],
      summary: {},
    };

    try {
      // ── 1. Content Quality Audit ──────────────────────────────
      await log.info("Starting content quality audit...");

      // Models missing descriptions
      const { count: missingDescCount } = await sb
        .from("models")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .is("description", null);

      // Models missing benchmark scores
      const activeModels = await collectPaginatedRows<ActiveModelSummary>(
        async (from, to) => {
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
        }
      );

      const modelIds = activeModels.map((model) => model.id);
      const activeModelIdSet = new Set(modelIds);

      const benchmarkRows = await collectPaginatedRows<ModelCoverageRow>(
        async (from, to) => {
          const { data, error } = await sb
            .from("benchmark_scores")
            .select("model_id")
            .order("model_id", { ascending: true })
            .range(from, to);

          if (error) {
            throw new Error(`Failed to fetch benchmark coverage: ${error.message}`);
          }

          return (data ?? []) as ModelCoverageRow[];
        }
      );

      const benchmarkedSet = filterCoveredActiveModelIds(
        benchmarkRows,
        activeModelIdSet
      );

      // Models missing pricing
      const pricingRows = await collectPaginatedRows<ModelCoverageRow>(
        async (from, to) => {
          const { data, error } = await sb
            .from("model_pricing")
            .select("model_id")
            .order("model_id", { ascending: true })
            .range(from, to);

          if (error) {
            throw new Error(`Failed to fetch pricing coverage: ${error.message}`);
          }

          return (data ?? []) as ModelCoverageRow[];
        }
      );

      const pricedSet = filterCoveredActiveModelIds(pricingRows, activeModelIdSet);

      const contentQuality = buildContentQualityMetrics({
        activeModels,
        missingDescriptionCount: missingDescCount ?? 0,
        benchmarkedModelIds: benchmarkedSet,
        pricedModelIds: pricedSet,
      });
      output.contentQuality = contentQuality;

      await log.info(
        "Content quality audit complete",
        output.contentQuality as Record<string, unknown>
      );

      // ── 2. Engagement Metrics ─────────────────────────────────
      await log.info("Analyzing engagement metrics...");

      // Top 10 most viewed models
      const { data: topViewed } = await sb
        .from("models")
        .select("slug, name, hf_downloads, hf_likes, quality_score")
        .eq("status", "active")
        .order("hf_downloads", { ascending: false })
        .limit(10);

      // Models with zero engagement
      const { count: zeroDownloads } = await sb
        .from("models")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .eq("hf_downloads", 0);

      // Category distribution
      const categoryCounts: Record<string, number> = {};
      for (const model of activeModels) {
        const category = model.category ?? "unknown";
        categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
      }

      output.engagementMetrics = {
        topViewedModels: (topViewed ?? []).map(
          (m: Record<string, unknown>) => ({
            slug: m.slug,
            name: m.name,
            downloads: m.hf_downloads,
            likes: m.hf_likes,
          })
        ),
        zeroDownloadModels: zeroDownloads ?? 0,
        categoryDistribution: categoryCounts,
      };

      await log.info("Engagement analysis complete");

      // ── 3. Marketplace Health ─────────────────────────────────
      await log.info("Auditing marketplace health...");

      const { count: totalListings } = await sb
        .from("marketplace_listings")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Stale listings (active for 7+ days with 0 views)
      const weekAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();
      const { count: staleListings } = await sb
        .from("marketplace_listings")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .eq("view_count", 0)
        .lt("created_at", weekAgo);

      // Listings with no reviews
      const { count: noReviewListings } = await sb
        .from("marketplace_listings")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .eq("review_count", 0);

      // Average rating across marketplace
      const { data: ratingData } = await sb
        .from("marketplace_listings")
        .select("avg_rating")
        .eq("status", "active")
        .not("avg_rating", "is", null);

      const ratingRows = ratingData ?? [];
      const avgRating =
        ratingRows.length > 0
          ? (ratingRows as { avg_rating: number }[]).reduce(
              (sum, r) => sum + r.avg_rating,
              0
            ) / ratingRows.length
          : null;

      output.marketplaceHealth = {
        totalActiveListings: totalListings ?? 0,
        staleListings: staleListings ?? 0,
        listingsWithoutReviews: noReviewListings ?? 0,
        averageRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      };

      await log.info(
        "Marketplace health audit complete",
        output.marketplaceHealth as Record<string, unknown>
      );

      // ── 4. Generate Recommendations ───────────────────────────
      const recommendations: string[] = [];

      if ((missingDescCount ?? 0) > 5) {
        recommendations.push(
          `${missingDescCount} models are missing descriptions. Consider enriching via adapter pipelines.`
        );
      }
      if (
        contentQuality.missingBenchmarks > modelIds.length * 0.5
      ) {
        recommendations.push(
          `${contentQuality.missingBenchmarks} models lack benchmark scores. Expand benchmark adapter coverage.`
        );
      }
      if (
        contentQuality.missingPricing > modelIds.length * 0.3
      ) {
        recommendations.push(
          `${contentQuality.missingPricing} models lack pricing data. Check pricing adapters.`
        );
      }
      if ((staleListings ?? 0) > 0) {
        recommendations.push(
          `${staleListings} marketplace listings have 0 views after 7+ days. Consider featuring or notifying sellers.`
        );
      }
      if ((zeroDownloads ?? 0) > modelIds.length * 0.3) {
        recommendations.push(
          `${zeroDownloads} models show zero downloads. Review data freshness from HuggingFace adapter.`
        );
      }

      // Check for category imbalance
      const categoryValues = Object.values(categoryCounts);
      if (categoryValues.length > 0) {
        const maxCategory = Math.max(...categoryValues);
        const minCategory = Math.min(...categoryValues);
        if (maxCategory > minCategory * 10) {
          const smallCategories = Object.entries(categoryCounts)
            .filter(([, count]) => count < maxCategory * 0.1)
            .map(([cat]) => cat);
          if (smallCategories.length > 0) {
            recommendations.push(
              `Categories with low representation: ${smallCategories.join(", ")}. Consider expanding coverage.`
            );
          }
        }
      }

      output.recommendations = recommendations;

      // ── 5. Summary ────────────────────────────────────────────
      const uxIssues = [
        {
          active: (missingDescCount ?? 0) > 5,
          slug: "ux-missing-model-descriptions",
          title: "Model description coverage is degraded",
          severity: "medium" as const,
          evidence: {
            missingDescription: missingDescCount ?? 0,
            totalModels: modelIds.length,
          },
        },
        {
          active: contentQuality.missingBenchmarks > modelIds.length * 0.5,
          slug: "ux-missing-benchmark-coverage",
          title: "Benchmark coverage is degraded",
          severity: "high" as const,
          evidence: {
            missingBenchmarks: contentQuality.missingBenchmarks,
            totalModels: modelIds.length,
          },
        },
        {
          active: contentQuality.missingPricing > modelIds.length * 0.3,
          slug: "ux-missing-pricing-coverage",
          title: "Pricing coverage is degraded",
          severity: "medium" as const,
          evidence: {
            missingPricing: contentQuality.missingPricing,
            totalModels: modelIds.length,
          },
        },
        {
          active: (staleListings ?? 0) > 0,
          slug: "ux-stale-marketplace-listings",
          title: "Marketplace listings are stale",
          severity: "medium" as const,
          evidence: {
            staleListings: staleListings ?? 0,
            totalListings: totalListings ?? 0,
          },
        },
      ];

      for (const issue of uxIssues) {
        if (issue.active) {
          await recordAgentIssue(sb, {
            slug: issue.slug,
            title: issue.title,
            issueType: "ux_health",
            source: null,
            severity: issue.severity,
            confidence: 0.85,
            detectedBy: "ux-monitor",
            playbook: null,
            evidence: issue.evidence,
          }).catch(async (err) => {
            const msg = err instanceof Error ? err.message : String(err);
            await log.warn(`Failed to record UX issue: ${msg}`);
          });
        } else {
          await resolveAgentIssue(sb, issue.slug, {
            verifier: "ux-monitor",
            reason: "threshold no longer breached",
          }).catch(() => {});
        }
      }

      output.summary = {
        totalModels: modelIds.length,
        contentCompleteness: output.contentQuality,
        marketplaceListings: totalListings ?? 0,
        recommendationCount: recommendations.length,
        overallHealthScore: Math.max(
          0,
          100 -
            ((missingDescCount ?? 0) > 10 ? 15 : 0) -
            (contentQuality.missingBenchmarks > 20 ? 15 : 0) -
            (contentQuality.missingPricing > 20 ? 10 : 0) -
            ((staleListings ?? 0) > 5 ? 10 : 0) -
            recommendations.length * 5
        ),
      };

      await log.info("UX Monitor run complete", {
        healthScore: (output.summary as Record<string, unknown>)
          .overallHealthScore,
        recommendations: recommendations.length,
      });

      return {
        success: true,
        output,
        errors,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      await log.error(`UX Monitor crashed: ${msg}`);
      return { success: false, output, errors };
    }
  },
};

registerAgent(uxMonitor);
export default uxMonitor;
