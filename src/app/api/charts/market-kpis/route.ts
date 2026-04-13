import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { handleApiError } from "@/lib/api-error";
import { getCanonicalProviderName } from "@/lib/constants/providers";
import { getTrustedStructuredBenchmarkModelIds } from "@/lib/models/benchmark-score-trust";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";

export const dynamic = "force-dynamic";

/**
 * GET /api/charts/market-kpis
 *
 * Returns aggregated market statistics with delta comparisons
 * for dashboard KPI cards.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Current stats
    const { data: models } = await supabase
      .from("models")
      .select("id, slug, name, quality_score, category, provider, is_open_weights, hf_downloads")
      .eq("status", "active");

    if (!models) {
      return NextResponse.json({ error: "No models found" }, { status: 500 });
    }

    const uniqueModels = preferDefaultPublicSurfaceReady(
      dedupePublicModelFamilies(models),
      12
    );
    const totalModels = uniqueModels.length;
    const scoredModels = uniqueModels.filter((m) => m.quality_score && m.quality_score > 0);
    const avgQuality =
      scoredModels.length > 0
        ? scoredModels.reduce((sum, m) => sum + (m.quality_score ?? 0), 0) / scoredModels.length
        : 0;
    const openWeightCount = uniqueModels.filter((m) => m.is_open_weights).length;
    const totalDownloads = uniqueModels.reduce(
      (sum, m) => sum + (m.hf_downloads ? Number(m.hf_downloads) : 0),
      0
    );

    // Provider distribution
    const providerCounts = new Map<string, number>();
    for (const m of uniqueModels) {
      const provider = getCanonicalProviderName(m.provider as string);
      providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1);
    }

    const providerDistribution = Array.from(providerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => ({ name, count, share: Math.round((count / totalModels) * 1000) / 10 }));

    // Category distribution
    const categoryCounts = new Map<string, number>();
    for (const m of uniqueModels) {
      const cat = (m.category as string) || "other";
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }

    const categoryDistribution = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // Quality score distribution (histogram buckets)
    const qualityBuckets = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}-${(i + 1) * 10}`,
      count: 0,
    }));
    for (const m of scoredModels) {
      const bucket = Math.min(Math.floor((m.quality_score ?? 0) / 10), 9);
      qualityBuckets[bucket].count++;
    }

    // Benchmark coverage stats
    const { data: benchmarkRows, error: benchmarkRowsError } = await supabase
      .from("benchmark_scores")
      .select("model_id, source");

    if (benchmarkRowsError) {
      return NextResponse.json({ error: benchmarkRowsError.message }, { status: 500 });
    }

    const { data: eloRows, error: eloRowsError } = await supabase
      .from("elo_ratings")
      .select("model_id");

    if (eloRowsError) {
      return NextResponse.json({ error: eloRowsError.message }, { status: 500 });
    }

    const modelsWithBenchmarks = getTrustedStructuredBenchmarkModelIds(
      benchmarkRows ?? []
    ).size;
    const modelsWithElo = new Set(
      (eloRows ?? [])
        .map((row) =>
          row && typeof row === "object" && "model_id" in row && typeof row.model_id === "string"
            ? row.model_id
            : null
        )
        .filter((value): value is string => typeof value === "string")
    ).size;

    return NextResponse.json(
      {
        kpis: {
          totalModels,
          scoredModels: scoredModels.length,
          avgQuality: Math.round(avgQuality * 10) / 10,
          openWeightCount,
          openWeightPercent: Math.round((openWeightCount / totalModels) * 1000) / 10,
          totalDownloads,
          modelsWithBenchmarks,
          modelsWithElo,
        },
        providerDistribution,
        categoryDistribution,
        qualityBuckets,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    return handleApiError(err, "api/charts/market-kpis");
  }
}
