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

const uxMonitor: ResidentAgent = {
  slug: "ux-monitor",
  name: "UX Optimization Monitor",

  async run(ctx: AgentContext): Promise<AgentTaskResult> {
    const { supabase, log } = ctx;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
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
      const { data: allModels } = await sb
        .from("models")
        .select("id, slug, name")
        .eq("status", "active");

      const modelIds = (allModels ?? []).map((m: { id: string }) => m.id);

      const { data: modelsWithBenchmarks } = await sb
        .from("benchmark_scores")
        .select("model_id")
        .in("model_id", modelIds.length > 0 ? modelIds : ["__none__"]);

      const benchmarkedSet = new Set(
        (modelsWithBenchmarks ?? []).map(
          (b: { model_id: string }) => b.model_id
        )
      );
      const missingBenchmarks = modelIds.filter(
        (id: string) => !benchmarkedSet.has(id)
      );

      // Models missing pricing
      const { data: modelsWithPricing } = await sb
        .from("model_pricing")
        .select("model_id")
        .in("model_id", modelIds.length > 0 ? modelIds : ["__none__"]);

      const pricedSet = new Set(
        (modelsWithPricing ?? []).map((p: { model_id: string }) => p.model_id)
      );
      const missingPricing = modelIds.filter(
        (id: string) => !pricedSet.has(id)
      );

      output.contentQuality = {
        totalActiveModels: modelIds.length,
        missingDescription: missingDescCount ?? 0,
        missingBenchmarks: missingBenchmarks.length,
        missingPricing: missingPricing.length,
        completenessScore:
          modelIds.length > 0
            ? Math.round(
                ((modelIds.length -
                  (missingDescCount ?? 0) -
                  missingBenchmarks.length -
                  missingPricing.length) /
                  (modelIds.length * 3)) *
                  100
              )
            : 0,
      };

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
      const { data: categoryData } = await sb
        .from("models")
        .select("category")
        .eq("status", "active");

      const categoryCounts: Record<string, number> = {};
      for (const m of (categoryData ?? []) as { category: string }[]) {
        categoryCounts[m.category] = (categoryCounts[m.category] ?? 0) + 1;
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

      const avgRating =
        (ratingData ?? []).length > 0
          ? (ratingData as { avg_rating: number }[]).reduce(
              (sum, r) => sum + r.avg_rating,
              0
            ) / ratingData.length
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
      if (missingBenchmarks.length > modelIds.length * 0.5) {
        recommendations.push(
          `${missingBenchmarks.length} models lack benchmark scores. Expand benchmark adapter coverage.`
        );
      }
      if (missingPricing.length > modelIds.length * 0.3) {
        recommendations.push(
          `${missingPricing.length} models lack pricing data. Check pricing adapters.`
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
      output.summary = {
        totalModels: modelIds.length,
        contentCompleteness: output.contentQuality,
        marketplaceListings: totalListings ?? 0,
        recommendationCount: recommendations.length,
        overallHealthScore: Math.max(
          0,
          100 -
            ((missingDescCount ?? 0) > 10 ? 15 : 0) -
            (missingBenchmarks.length > 20 ? 15 : 0) -
            (missingPricing.length > 20 ? 10 : 0) -
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
