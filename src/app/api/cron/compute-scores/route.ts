import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { trackCronRun } from "@/lib/cron-tracker";
import { fetchInputs } from "@/lib/compute-scores/fetch-inputs";
import { computeAllLenses } from "@/lib/compute-scores/compute-all-lenses";
import { persistResults } from "@/lib/compute-scores/persist-results";
import { createTaggedLogger } from "@/lib/logging";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const log = createTaggedLogger("cron/compute-scores");

/**
 * Compute quality scores and rankings for ALL active models.
 *
 * GET /api/cron/compute-scores
 * Authorization: Bearer <CRON_SECRET>
 *
 * Schedule: every 6 hours (after data sync completes).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Missing Supabase config" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const tracker = await trackCronRun("compute-scores");
  if (tracker.shouldSkip) {
    return tracker.skip();
  }

  try {
    const inputs = await fetchInputs(supabase);
    const results = await computeAllLenses(inputs, supabase);
    const persistStats = await persistResults(supabase, inputs, results);
    if (persistStats.errors > 0 || persistStats.snapshotErrors > 0) {
      throw new Error(
        `Score persistence incomplete: ${persistStats.errors} model update errors, ${persistStats.snapshotErrors} snapshot errors`
      );
    }

    return tracker.complete({
      totalModels: inputs.models.length,
      scored: results.scoredModels.filter((s) => s.qualityScore > 0).length,
      ranked: results.balancedRankings.length,
      updated: persistStats.updated,
      errors: persistStats.errors,
      snapshotsCreated: persistStats.snapshotsCreated,
      snapshotErrors: persistStats.snapshotErrors,
      modelsWithValueMetric: results.normalizedValueMap.size,
      modelsWithValueScore: results.normalizedValueMap.size,
      modelsWithAgentScore: results.agentScoreMap.size,
      modelsWithPopularity: results.popularityMap.size,
      modelsWithMarketCap: results.marketCapMap.size,
      modelsWithCapabilityScore: results.capRankMap.size,
      modelsWithUsageScore: results.usageRankMap.size,
      modelsWithExpertScore: results.expertRankMap.size,
      staleDataSources: inputs.staleCount,
      pricingSynced: results.pricingSynced,
      stats: results.stats,
    });
  } catch (err) {
    void log.error("Score computation failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return tracker.fail(err);
  }
}
