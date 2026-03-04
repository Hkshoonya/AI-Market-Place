/**
 * Compute Scores Pipeline — Fetch Inputs
 *
 * Fetches all data required for the scoring pipeline from Supabase.
 * Uses parameter injection (supabase client passed in) so this function
 * is importable and testable without a Next.js server.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getStaleSourceCount } from "@/lib/pipeline-health";
import type { ScoringInputs } from "./types";

/**
 * Fetch all scoring inputs from Supabase.
 *
 * @param supabase - Injected Supabase client (service role)
 * @returns ScoringInputs containing models, benchmark maps, ELO, news, provider stats, stale count
 * @throws Error if the models query fails
 */
export async function fetchInputs(supabase: SupabaseClient): Promise<ScoringInputs> {
  // 1. Fetch all active models
  const { data: models, error: modelsError } = await supabase
    .from("models")
    .select(
      "id, name, slug, provider, category, quality_score, value_score, hf_downloads, hf_likes, release_date, is_open_weights, hf_trending_score, parameter_count, github_stars"
    )
    .eq("status", "active");

  if (modelsError || !models) {
    throw new Error(`Failed to fetch models: ${modelsError?.message}`);
  }

  // 2. Fetch benchmark scores per model (with benchmark slug for weighted avg)
  const { data: benchmarkAvgs } = await supabase
    .from("benchmark_scores")
    .select("model_id, score_normalized, benchmarks(slug)");

  type BenchmarkScoreWithSlug = { model_id: string; score_normalized: number | null; benchmarks?: { slug: string } | null };
  const benchmarkMap = new Map<string, number[]>();
  const benchmarkDetailMap = new Map<string, Array<{ slug: string; score: number }>>();
  for (const bs of (benchmarkAvgs as unknown as BenchmarkScoreWithSlug[] ?? [])) {
    if (bs.score_normalized == null) continue;
    const modelId = bs.model_id;
    const score = Number(bs.score_normalized);

    if (!benchmarkMap.has(modelId)) benchmarkMap.set(modelId, []);
    benchmarkMap.get(modelId)!.push(score);

    const benchSlug = bs.benchmarks?.slug;
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

  // Pipeline health check
  const staleCount = await getStaleSourceCount();
  if (staleCount > 3) {
    console.warn(`[compute-scores] WARNING: ${staleCount} data sources are stale`);
  }

  return {
    models: models as ScoringInputs["models"],
    benchmarkMap,
    benchmarkDetailMap,
    eloMap,
    newsMentionMap,
    providerBenchmarkAvg,
    staleCount,
  };
}
