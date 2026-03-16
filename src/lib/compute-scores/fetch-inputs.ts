/**
 * Compute Scores Pipeline — Fetch Inputs
 *
 * Fetches all data required for the scoring pipeline from Supabase.
 * Uses parameter injection (supabase client passed in) so this function
 * is importable and testable without a Next.js server.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { parseQueryResult } from "@/lib/schemas/parse";
import { getStaleSourceCount } from "@/lib/pipeline-health";
import { buildSourceCoverage } from "@/lib/source-coverage";
import type { ScoringInputs } from "./types";
import { createTaggedLogger } from "@/lib/logging";
import { buildModelNewsEvidenceMap } from "@/lib/news/evidence";

const log = createTaggedLogger("compute-scores");
const PAGE_SIZE = 1000;

async function fetchAllPages<T>(
  buildQuery: () => {
    range: (
      from: number,
      to: number
    ) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>;
  },
  label: string
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) {
      throw new Error(`Failed to fetch ${label}: ${error.message ?? "unknown error"}`);
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

/**
 * Fetch all scoring inputs from Supabase.
 *
 * @param supabase - Injected Supabase client (service role)
 * @returns ScoringInputs containing models, benchmark maps, ELO, news, provider stats, stale count
 * @throws Error if the models query fails
 */
export async function fetchInputs(supabase: SupabaseClient): Promise<ScoringInputs> {
  // 1. Fetch all active models
  const models = await fetchAllPages(
    () =>
      supabase
        .from("models")
        .select(
          "id, name, slug, provider, category, quality_score, value_score, hf_downloads, hf_likes, release_date, is_open_weights, is_api_available, hf_trending_score, parameter_count, github_stars"
        )
        .eq("status", "active"),
    "models"
  );

  // 2. Fetch benchmark scores per model (with benchmark slug for weighted avg)
  const BenchmarkScoreWithSlugSchema = z.object({
    model_id: z.string(),
    score_normalized: z.number().nullable(),
    source: z.string().nullable().optional(),
    benchmarks: z.object({
      slug: z.string(),
      category: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
    }).nullable().optional(),
  });
  const benchmarkRows = await fetchAllPages(
    () =>
      supabase
        .from("benchmark_scores")
        .select("model_id, score_normalized, source, benchmarks(slug, category, source)"),
    "benchmark_scores"
  );

  const benchmarkAvgs = parseQueryResult(
    { data: benchmarkRows, error: null },
    BenchmarkScoreWithSlugSchema,
    "ScoringBenchmarkAvgs"
  );
  const benchmarkMap = new Map<string, number[]>();
  const benchmarkDetailMap = new Map<string, Array<{ slug: string; score: number }>>();
  const benchmarkSourcesByModel = new Map<string, Set<string>>();
  const benchmarkCategoriesByModel = new Map<string, Set<string>>();
  for (const bs of benchmarkAvgs) {
    const modelId = bs.model_id;
    const source = bs.source ?? bs.benchmarks?.source ?? bs.benchmarks?.slug ?? null;
    if (source) {
      const sources = benchmarkSourcesByModel.get(modelId) ?? new Set<string>();
      sources.add(source);
      benchmarkSourcesByModel.set(modelId, sources);
    }
    const benchmarkCategory = bs.benchmarks?.category;
    if (benchmarkCategory) {
      const categories = benchmarkCategoriesByModel.get(modelId) ?? new Set<string>();
      categories.add(benchmarkCategory);
      benchmarkCategoriesByModel.set(modelId, categories);
    }

    if (bs.score_normalized == null) continue;
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
  const eloRatings = await fetchAllPages(
    () =>
      supabase
        .from("elo_ratings")
        .select("model_id, elo_score, arena_name"),
    "elo_ratings"
  );

  const eloMap = new Map<string, number>();
  const eloSourcesByModel = new Map<string, Set<string>>();
  for (const elo of eloRatings ?? []) {
    const arenas = eloSourcesByModel.get(elo.model_id) ?? new Set<string>();
    arenas.add(elo.arena_name ?? "arena");
    eloSourcesByModel.set(elo.model_id, arenas);

    if (elo.elo_score == null) continue;
    const score = Number(elo.elo_score);
    const existing = eloMap.get(elo.model_id);
    if (!existing || score > existing) {
      eloMap.set(elo.model_id, score);
    }
  }

  // 3. Aggregate weighted news evidence per model (last 30 days)
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const newsItems = await fetchAllPages(
    () =>
      supabase
        .from("model_news")
        .select("related_model_ids, source, category, metadata")
        .gte("published_at", thirtyDaysAgo)
        .not("related_model_ids", "is", null),
    "model_news"
  );

  const newsMentionMap = buildModelNewsEvidenceMap(newsItems ?? []);
  const newsSourcesByModel = new Map<string, Set<string>>();
  for (const item of newsItems ?? []) {
    const ids = item.related_model_ids as string[] | null;
    if (!ids) continue;
    for (const id of ids) {
      const sources = newsSourcesByModel.get(id) ?? new Set<string>();
      if (item.source) sources.add(item.source);
      newsSourcesByModel.set(id, sources);
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
    void log.warn(`WARNING: ${staleCount} data sources are stale`, { staleCount });
  }

  const sourceCoverageMap = new Map<string, ScoringInputs["sourceCoverageMap"] extends Map<string, infer T> ? T : never>();
  for (const m of models) {
    sourceCoverageMap.set(
      m.id,
      buildSourceCoverage({
        benchmarkSources: benchmarkSourcesByModel.get(m.id) ?? [],
        benchmarkCategories: benchmarkCategoriesByModel.get(m.id) ?? [],
        eloSources: eloSourcesByModel.get(m.id) ?? [],
        newsSources: newsSourcesByModel.get(m.id) ?? [],
        pricingSources: [],
        hasCommunitySignals: Boolean(m.hf_downloads || m.hf_likes || m.github_stars),
      })
    );
  }

  return {
    models: models as ScoringInputs["models"],
    benchmarkMap,
    benchmarkDetailMap,
    eloMap,
    newsMentionMap,
    providerBenchmarkAvg,
    staleCount,
    sourceCoverageMap,
  };
}
