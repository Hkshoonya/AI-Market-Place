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
import { isTrustedStructuredBenchmarkSource } from "@/lib/models/benchmark-score-trust";
import { selectArenaEvidence } from "./arena-evidence";

const log = createTaggedLogger("compute-scores");
const PAGE_SIZE = 1000;
const SCORING_NEWS_SOURCES = [
  "provider-blog",
  "provider-benchmarks",
  "x-twitter",
  "hf-papers",
  "arxiv",
] as const;

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
  // 1. Fetch models eligible for ranking or provider pricing. Preview/beta
  // rows receive current pricing but are excluded from public score updates.
  const catalogModels = await fetchAllPages(
    () =>
      supabase
        .from("models")
        .select(
          "id, name, slug, provider, category, status, description, short_description, quality_score, value_score, hf_downloads, hf_likes, release_date, is_open_weights, license, license_name, context_window, is_api_available, hf_trending_score, parameter_count, github_stars"
        )
        .in("status", ["active", "beta", "preview"])
        .order("id", { ascending: true }),
    "models"
  );
  const models = catalogModels.filter(
    (model) => model.status === "active" || model.status == null
  );
  const pricingModels = catalogModels.map((model) => ({
    id: model.id,
    slug: model.slug,
    provider: model.provider,
  }));

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
        .select("model_id, score_normalized, source, benchmarks(slug, category, source)")
        .order("id", { ascending: true }),
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
  const groupedBenchmarks = new Map<string, Map<string, number[]>>();
  for (const bs of benchmarkAvgs) {
    const modelId = bs.model_id;
    // A benchmark's definition does not establish provenance for an individual result.
    if (!isTrustedStructuredBenchmarkSource(bs.source) || bs.score_normalized == null) continue;
    const score = Number(bs.score_normalized);
    const benchSlug = bs.benchmarks?.slug.toLowerCase().replace(/_/g, "-");
    if (!Number.isFinite(score) || score < 0 || score > 100 || !benchSlug
      || benchSlug === "chatbot-arena-elo") continue;
    const source = bs.source;
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

    const grouped = groupedBenchmarks.get(modelId) ?? new Map<string, number[]>();
    const scores = grouped.get(benchSlug) ?? [];
    scores.push(score);
    grouped.set(benchSlug, scores);
    groupedBenchmarks.set(modelId, grouped);
  }
  // Multiple reports of the same test count once, not as extra benchmark breadth.
  for (const [modelId, grouped] of groupedBenchmarks) {
    const details = Array.from(grouped, ([slug, scores]) => ({
      slug, score: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    }));
    benchmarkDetailMap.set(modelId, details);
    benchmarkMap.set(modelId, details.map(({ score }) => score));
  }

  // 2b. Fetch ELO ratings from Chatbot Arena
  const eloRatings = await fetchAllPages(
    () =>
      supabase
        .from("elo_ratings")
        .select("model_id, elo_score, arena_name, snapshot_date")
        .in("arena_name", ["arena-text-official", "vision-arena"])
        .order("id", { ascending: true }),
    "elo_ratings"
  );

  const { eloMap, eloNormalizedMap, eloSourcesByModel } = selectArenaEvidence(eloRatings, models);
  if (models.some((model) => ["llm", "multimodal", "code", "agentic_browser"].includes(model.category))
    && ![...eloSourcesByModel.values()].some((sources) => sources.has("arena-text-official"))) {
    const legacy = await supabase.from("elo_ratings").select("model_id")
      .eq("arena_name", "chatbot-arena").limit(1);
    if (legacy.error || legacy.data?.length) {
      throw new Error("Import verified official Arena text evidence before replacing legacy-derived rankings");
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
        .select("title, related_provider, related_model_ids, source, category, published_at, metadata")
        .in("source", [...SCORING_NEWS_SOURCES])
        .gte("published_at", thirtyDaysAgo)
        .not("related_model_ids", "is", null)
        .order("id", { ascending: true }),
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
    pricingModels,
    benchmarkMap,
    benchmarkDetailMap,
    eloMap,
    eloNormalizedMap,
    newsMentionMap,
    providerBenchmarkAvg,
    staleCount,
    sourceCoverageMap,
  };
}
