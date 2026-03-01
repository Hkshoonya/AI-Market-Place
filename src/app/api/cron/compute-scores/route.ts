import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  calculateQualityScore,
  computeNormalizationStats,
  computeRankings,
  type QualityInputs,
} from "@/lib/scoring/quality-calculator";
import { lookupProviderPrice } from "@/lib/data-sources/adapters/provider-pricing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  try {
    // 1. Fetch all active models
    const { data: models, error: modelsError } = await supabase
      .from("models")
      .select(
        "id, name, slug, provider, category, quality_score, value_score, hf_downloads, hf_likes, release_date, is_open_weights, hf_trending_score, parameter_count"
      )
      .eq("status", "active");

    if (modelsError || !models) {
      return NextResponse.json(
        { error: `Failed to fetch models: ${modelsError?.message}` },
        { status: 500 }
      );
    }

    // 2. Fetch benchmark scores per model (with benchmark slug for weighted avg)
    const { data: benchmarkAvgs } = await supabase
      .from("benchmark_scores")
      .select("model_id, score_normalized, benchmarks(slug)");

    const benchmarkMap = new Map<string, number[]>();
    const benchmarkDetailMap = new Map<string, Array<{ slug: string; score: number }>>();
    for (const bs of benchmarkAvgs ?? []) {
      if (bs.score_normalized == null) continue;
      const modelId = bs.model_id;
      const score = Number(bs.score_normalized);

      if (!benchmarkMap.has(modelId)) benchmarkMap.set(modelId, []);
      benchmarkMap.get(modelId)!.push(score);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const benchSlug = (bs as any).benchmarks?.slug as string | undefined;
      if (benchSlug) {
        if (!benchmarkDetailMap.has(modelId)) benchmarkDetailMap.set(modelId, []);
        benchmarkDetailMap.get(modelId)!.push({ slug: benchSlug, score });
      }
    }

    // 2b. Fetch ELO ratings from Chatbot Arena
    const { data: eloRatings } = await supabase
      .from("elo_ratings")
      .select("model_id, elo_score, arena_name");

    const eloMap = new Map<string, number>();
    for (const elo of eloRatings ?? []) {
      if (elo.elo_score == null) continue;
      const score = Number(elo.elo_score);
      const existing = eloMap.get(elo.model_id);
      if (!existing || score > existing) {
        eloMap.set(elo.model_id, score);
      }
    }

    // 3. Count news mentions per model (last 30 days)
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data: newsItems } = await supabase
      .from("model_news")
      .select("related_model_ids")
      .gte("published_at", thirtyDaysAgo)
      .not("related_model_ids", "is", null);

    const newsMentionMap = new Map<string, number>();
    for (const item of newsItems ?? []) {
      const ids = item.related_model_ids as string[] | null;
      if (!ids) continue;
      for (const id of ids) {
        newsMentionMap.set(id, (newsMentionMap.get(id) ?? 0) + 1);
      }
    }

    // 3b. Compute per-provider average benchmark score (for proxy signals)
    const providerBenchmarkAvg = new Map<string, number>();
    const providerBenchmarkCounts = new Map<string, { sum: number; count: number }>();
    for (const m of models) {
      const provider = (m.provider as string) ?? "";
      const benchScores = benchmarkMap.get(m.id);
      if (benchScores && benchScores.length > 0) {
        const avg = benchScores.reduce((a, b) => a + b, 0) / benchScores.length;
        const existing = providerBenchmarkCounts.get(provider) ?? { sum: 0, count: 0 };
        existing.sum += avg;
        existing.count += 1;
        providerBenchmarkCounts.set(provider, existing);
      }
    }
    for (const [provider, { sum, count }] of providerBenchmarkCounts) {
      providerBenchmarkAvg.set(provider, sum / count);
    }

    // 4. Compute normalization stats
    const statsInput = models.map((m) => ({
      hf_downloads: m.hf_downloads as number | null,
      hf_likes: m.hf_likes as number | null,
      newsMentions: newsMentionMap.get(m.id) ?? 0,
    }));
    const stats = computeNormalizationStats(statsInput);

    // 5. Calculate quality scores for every model
    const scoredModels: Array<{
      id: string;
      category: string;
      qualityScore: number;
    }> = [];

    for (const m of models) {
      const benchScores = benchmarkMap.get(m.id);
      const avgBenchmark =
        benchScores && benchScores.length > 0
          ? benchScores.reduce((a, b) => a + b, 0) / benchScores.length
          : null;

      const provider = (m.provider as string) ?? "";
      const paramCount = m.parameter_count ? Number(m.parameter_count) : null;
      // Convert parameter_count to billions if stored as raw number
      const paramBillions = paramCount != null && paramCount > 1000
        ? paramCount / 1_000_000_000
        : paramCount;

      const inputs: QualityInputs = {
        existingScore: null, // No longer blending with external AA scores
        hfDownloads: m.hf_downloads as number | null,
        hfLikes: m.hf_likes as number | null,
        avgBenchmarkScore: avgBenchmark,
        benchmarkScores: benchmarkDetailMap.get(m.id) ?? null,
        releaseDate: m.release_date as string | null,
        isOpenWeights: !!(m.is_open_weights),
        trendingScore: m.hf_trending_score ? Number(m.hf_trending_score) : null,
        newsMentions: newsMentionMap.get(m.id) ?? 0,
        eloScore: eloMap.get(m.id) ?? null,
        eloRank: null,
        category: (m.category as string) ?? "other",
        providerAvgBenchmark: providerBenchmarkAvg.get(provider) ?? null,
        parameterCount: paramBillions,
      };

      const score = calculateQualityScore(inputs, stats);
      scoredModels.push({
        id: m.id,
        category: (m.category as string) ?? "other",
        qualityScore: score,
      });
    }

    // 5b. Compute value metric (quality / price) using provider pricing + model_pricing
    const { data: allPricing } = await supabase
      .from("model_pricing")
      .select("model_id, input_price_per_million")
      .not("input_price_per_million", "is", null);

    // Build cheapest-price map from DB pricing
    const cheapestPriceMap = new Map<string, number>();
    for (const p of allPricing ?? []) {
      const price = Number(p.input_price_per_million);
      if (price > 0) {
        const existing = cheapestPriceMap.get(p.model_id);
        if (!existing || price < existing) {
          cheapestPriceMap.set(p.model_id, price);
        }
      }
    }

    // Blend with curated provider pricing for models that have slugs
    const valueMetricMap = new Map<string, number>();
    for (const m of models) {
      const sm = scoredModels.find((s) => s.id === m.id);
      if (!sm || sm.qualityScore <= 0) continue;

      // Try curated pricing first, then DB pricing
      const curatedPrice = lookupProviderPrice(m.slug as string);
      const dbPrice = cheapestPriceMap.get(m.id);
      const inputPrice = curatedPrice?.inputPricePerMillion ?? dbPrice ?? null;

      if (inputPrice && inputPrice > 0) {
        const valueMetric = sm.qualityScore / inputPrice;
        valueMetricMap.set(m.id, valueMetric);
      }
    }

    // Normalize value metrics to 0-100 scale using log normalization
    let maxValueMetric = 0;
    for (const vm of valueMetricMap.values()) {
      if (vm > maxValueMetric) maxValueMetric = vm;
    }
    const normalizedValueMap = new Map<string, number>();
    if (maxValueMetric > 0) {
      for (const [modelId, vm] of valueMetricMap) {
        const normalized = (Math.log10(vm + 1) / Math.log10(maxValueMetric + 1)) * 100;
        normalizedValueMap.set(modelId, Math.round(Math.min(normalized, 100) * 10) / 10);
      }
    }

    // 6. Compute rankings
    const rankings = computeRankings(scoredModels);
    const rankMap = new Map(rankings.map((r) => [r.id, r]));

    // 7. Batch update models
    let updated = 0;
    let errors = 0;
    const BATCH = 50;

    for (let i = 0; i < scoredModels.length; i += BATCH) {
      const batch = scoredModels.slice(i, i + BATCH);

      for (const sm of batch) {
        const rank = rankMap.get(sm.id);
        const mentions = newsMentionMap.get(sm.id) ?? 0;

        const updateData: Record<string, unknown> = {
          quality_score: sm.qualityScore,
          popularity_score: mentions,
        };

        if (rank) {
          updateData.overall_rank = rank.overall_rank;
          updateData.category_rank = rank.category_rank;
        }

        // Store normalized value score (0-100) or null if no pricing
        const valueScore = normalizedValueMap.get(sm.id);
        updateData.value_score = valueScore ?? null;

        const { error } = await supabase
          .from("models")
          .update(updateData)
          .eq("id", sm.id);

        if (error) {
          errors++;
        } else {
          updated++;
        }
      }
    }

    // 8. Create model_snapshots for trend tracking
    const today = new Date().toISOString().split("T")[0];
    let snapshotsCreated = 0;

    for (const sm of scoredModels) {
      const m = models.find((x) => x.id === sm.id);
      if (!m) continue;

      const rank = rankMap.get(sm.id);

      const { error: snapError } = await supabase.from("model_snapshots").upsert(
        {
          model_id: sm.id,
          snapshot_date: today,
          quality_score: sm.qualityScore,
          hf_downloads: m.hf_downloads,
          hf_likes: m.hf_likes,
          overall_rank: rank?.overall_rank ?? null,
        },
        { onConflict: "model_id,snapshot_date" }
      );

      if (!snapError) snapshotsCreated++;
    }

    return NextResponse.json({
      ok: true,
      totalModels: models.length,
      scored: scoredModels.filter((s) => s.qualityScore > 0).length,
      ranked: rankings.length,
      updated,
      errors,
      snapshotsCreated,
      modelsWithValueMetric: valueMetricMap.size,
      modelsWithValueScore: normalizedValueMap.size,
      stats,
    });
  } catch (err) {
    console.error("[compute-scores] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
