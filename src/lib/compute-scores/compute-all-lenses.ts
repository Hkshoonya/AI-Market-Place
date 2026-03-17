/**
 * Compute Scores Pipeline — Compute All Lenses
 *
 * Orchestrates all 7 scoring calculators + pricing + value + agent + market cap.
 * Uses parameter injection (supabase client passed in) for pricing sync/upsert.
 * No dependency on Next.js server types.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateQualityScore,
  computeNormalizationStats,
  type QualityInputs,
} from "@/lib/scoring/quality-calculator";
import { computeCapabilityScore, type CapabilityInputs } from "@/lib/scoring/capability-calculator";
import { computeUsageScore, computeUsageNormStats, type UsageInputs } from "@/lib/scoring/usage-calculator";
import { computeExpertScore, computeExpertNormStats, type ExpertInputs } from "@/lib/scoring/expert-calculator";
import { computeBalancedRankings } from "@/lib/scoring/balanced-calculator";
import { lookupProviderPrice } from "@/lib/data-sources/adapters/provider-pricing";
import {
  computeAgentBenchmarkWeights,
  computeAgentScore,
  normalizeAgentSlug,
  type AgentBenchmarkScore,
} from "@/lib/scoring/agent-score-calculator";
import { getProviderUsageEstimate } from "@/lib/constants/scoring";
import { computeMarketCap } from "@/lib/scoring/market-cap-calculator";
import {
  computePopularityScore,
  computePopularityStats,
} from "@/lib/scoring/popularity-score";
import {
  computeAdoptionScore,
  computeEconomicConfidenceMultiplier,
  computeEconomicFootprintScore,
} from "@/lib/scoring/economic-footprint";
import { buildSourceCoverage, getCorroborationMultiplier } from "@/lib/source-coverage";
import type { ScoringInputs, ScoringResults } from "./types";

/**
 * Orchestrate all scoring lenses for all models.
 *
 * @param inputs  - Fetched scoring inputs (models, maps, stale count)
 * @param supabase - Injected Supabase client (needed for pricing sync/upsert)
 * @returns ScoringResults with all score maps, rank maps, and computed values
 */
export async function computeAllLenses(
  inputs: ScoringInputs,
  supabase: SupabaseClient
): Promise<ScoringResults> {
  const {
    models,
    benchmarkMap,
    benchmarkDetailMap,
    eloMap,
    newsMentionMap,
    providerBenchmarkAvg,
  } = inputs;
  const sourceCoverageMap = inputs.sourceCoverageMap ?? new Map();

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

    const qualityInputs: QualityInputs = {
      existingScore: null,
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
      sourceCoverage: sourceCoverageMap.get(m.id) ?? null,
    };

    const score = calculateQualityScore(qualityInputs, stats);
    scoredModels.push({
      id: m.id,
      category: (m.category as string) ?? "other",
      qualityScore: score,
    });
  }
  const qualityScoreMap = new Map(scoredModels.map((model) => [model.id, model.qualityScore]));

  // 5b. Sync curated pricing to model_pricing table
  let pricingSynced = 0;
  const { data: allPricing } = await supabase
    .from("model_pricing")
    .select("model_id, input_price_per_million, provider_name, source")
    .not("input_price_per_million", "is", null);

  const cheapestPriceMap = new Map<string, number>();
  const pricingSourceMap = new Map<string, Set<string>>();
  for (const p of allPricing ?? []) {
    const price = Number(p.input_price_per_million);
    if (price > 0) {
      const existing = cheapestPriceMap.get(p.model_id);
      if (!existing || price < existing) {
        cheapestPriceMap.set(p.model_id, price);
      }
    }
    const pricingSources = pricingSourceMap.get(p.model_id) ?? new Set<string>();
    pricingSources.add(p.provider_name ?? "pricing");
    pricingSourceMap.set(p.model_id, pricingSources);
  }

  for (const m of models) {
    const curatedPrice = lookupProviderPrice(m.slug as string);
    if (!curatedPrice) continue;

    const pricingModel = curatedPrice.inputPricePerMillion === 0
      ? "free"
      : "token_based";

    const { error: upsertErr } = await supabase.from("model_pricing").upsert(
      {
        model_id: m.id,
        provider_name: curatedPrice.provider,
        pricing_model: pricingModel,
        input_price_per_million: curatedPrice.inputPricePerMillion,
        output_price_per_million: curatedPrice.outputPricePerMillion,
        blended_price_per_million: curatedPrice.inputPricePerMillion * 0.6 + curatedPrice.outputPricePerMillion * 0.4,
        source: curatedPrice.source,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "model_id,provider_name" }
    );

    if (!upsertErr) {
      const price = curatedPrice.inputPricePerMillion;
      if (price > 0) {
        const existing = cheapestPriceMap.get(m.id);
        if (!existing || price < existing) {
          cheapestPriceMap.set(m.id, price);
        }
      }
      const pricingSources = pricingSourceMap.get(m.id) ?? new Set<string>();
      pricingSources.add(curatedPrice.source ?? curatedPrice.provider);
      pricingSourceMap.set(m.id, pricingSources);

      const existingCoverage = sourceCoverageMap.get(m.id);
      if (existingCoverage) {
        sourceCoverageMap.set(
          m.id,
          buildSourceCoverage({
            benchmarkSources: existingCoverage.benchmarkSources,
            benchmarkCategories: existingCoverage.benchmarkCategories,
            eloSources: existingCoverage.eloSources,
            newsSources: existingCoverage.newsSources,
            pricingSources,
            hasCommunitySignals: existingCoverage.hasCommunitySignals,
          })
        );
      }
      pricingSynced++;
    }
  }

  // Value metric computation
  const valueMetricMap = new Map<string, number>();
  for (const m of models) {
    const sm = scoredModels.find((s) => s.id === m.id);
    if (!sm || sm.qualityScore <= 0) continue;

    const curatedPrice = lookupProviderPrice(m.slug as string);
    const dbPrice = cheapestPriceMap.get(m.id);
    const inputPrice = curatedPrice?.inputPricePerMillion ?? dbPrice ?? null;

    if (inputPrice && inputPrice > 0) {
      const valueMetric = sm.qualityScore / inputPrice;
      valueMetricMap.set(m.id, valueMetric);
    }
  }

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

  // 5c. Compute agent scores
  const agentScoresInput: Array<{ benchmarkSlug: string; modelId: string }> = [];
  const modelAgentScoresMap = new Map<string, AgentBenchmarkScore[]>();
  const allAgentScoresForRanking = new Map<string, number[]>();

  for (const [modelId, details] of benchmarkDetailMap) {
    const agentBenchmarks: AgentBenchmarkScore[] = [];
    for (const d of details) {
      const canonical = normalizeAgentSlug(d.slug);
      if (canonical) {
        agentScoresInput.push({ benchmarkSlug: d.slug, modelId });
        agentBenchmarks.push({
          benchmarkSlug: d.slug,
          score: d.score,
          scoreNormalized: d.score,
        });
        if (!allAgentScoresForRanking.has(canonical)) {
          allAgentScoresForRanking.set(canonical, []);
        }
        allAgentScoresForRanking.get(canonical)!.push(d.score);
      }
    }
    if (agentBenchmarks.length > 0) {
      modelAgentScoresMap.set(modelId, agentBenchmarks);
    }
  }

  const agentWeights = computeAgentBenchmarkWeights(agentScoresInput);
  const agentScoreMap = new Map<string, number>();
  for (const [modelId, scores] of modelAgentScoresMap) {
    const result = computeAgentScore(scores, agentWeights, allAgentScoresForRanking);
    if (result) {
      agentScoreMap.set(modelId, result.agentScore);
    }
  }

  const agentRankedModels = Array.from(agentScoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id], i) => ({ id, rank: i + 1 }));
  const agentRankMap = new Map(agentRankedModels.map((r) => [r.id, r.rank]));

  // --- LENS 1: Capability scores ---
  const capabilityScoreMap = new Map<string, number | null>();
  for (const m of models) {
    const capInputs: CapabilityInputs = {
      benchmarkScores: benchmarkDetailMap.get(m.id) ?? null,
      eloScore: eloMap.get(m.id) ?? null,
      releaseDate: m.release_date as string | null,
      category: (m.category as string) ?? "other",
      sourceCoverage: sourceCoverageMap.get(m.id) ?? null,
    };
    capabilityScoreMap.set(m.id, computeCapabilityScore(capInputs));
  }

  // Capability ranks (only ranked models)
  const capRanked = Array.from(capabilityScoreMap.entries())
    .filter(([, score]) => score != null)
    .sort((a, b) => b[1]! - a[1]!)
    .map(([id], i) => ({ id, rank: i + 1 }));
  const capRankMap = new Map(capRanked.map(r => [r.id, r.rank]));

  // --- LENS 2: Usage scores (with split normalization) ---
  const usageInputsList: Array<UsageInputs & { id: string }> = models.map((m) => ({
    id: m.id,
    downloads: (m.hf_downloads as number) ?? 0,
    likes: (m.hf_likes as number) ?? 0,
    stars: (m.github_stars as number) ?? 0,
    newsMentions: newsMentionMap.get(m.id) ?? 0,
    providerUsageEstimate: getProviderUsageEstimate((m.provider as string) ?? ""),
    trendingScore: m.hf_trending_score ? Number(m.hf_trending_score) : 0,
    isOpenWeights: !!(m.is_open_weights),
  }));
  const usageNormStats = computeUsageNormStats(usageInputsList);
  const usageScoreMap = new Map<string, number>();
  for (const input of usageInputsList) {
    usageScoreMap.set(input.id, computeUsageScore(input, usageNormStats));
  }

  // Usage ranks
  const usageRanked = Array.from(usageScoreMap.entries())
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id], i) => ({ id, rank: i + 1 }));
  const usageRankMap = new Map(usageRanked.map(r => [r.id, r.rank]));

  // --- LENS 3: Expert consensus scores ---
  const expertNormInput = models.map((m) => ({
    hfLikes: (m.hf_likes as number) ?? 0,
    githubStars: (m.github_stars as number) ?? 0,
    newsMentions: newsMentionMap.get(m.id) ?? 0,
  }));
  const expertNormStats = computeExpertNormStats(expertNormInput);
  const expertScoreMap = new Map<string, number>();
  for (const m of models) {
    const benchScores = benchmarkMap.get(m.id);
    const avgBenchmark = benchScores && benchScores.length > 0
      ? benchScores.reduce((a, b) => a + b, 0) / benchScores.length
      : null;
    const provider = (m.provider as string) ?? "";

    const expertInputs: ExpertInputs = {
      avgBenchmarkScore: avgBenchmark,
      benchmarkScores: benchmarkDetailMap.get(m.id) ?? null,
      eloScore: eloMap.get(m.id) ?? null,
      hfLikes: (m.hf_likes as number) ?? null,
      githubStars: (m.github_stars as number) ?? null,
      newsMentions: newsMentionMap.get(m.id) ?? 0,
      providerAvgBenchmark: providerBenchmarkAvg.get(provider) ?? null,
      releaseDate: m.release_date as string | null,
      isOpenWeights: !!(m.is_open_weights),
    };
    expertScoreMap.set(m.id, computeExpertScore(expertInputs, expertNormStats));
  }

  // Expert ranks
  const expertRanked = Array.from(expertScoreMap.entries())
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id], i) => ({ id, rank: i + 1 }));
  const expertRankMap = new Map(expertRanked.map(r => [r.id, r.rank]));

  // 5d. Compute popularity scores and market cap
  const popularityInputs = models.map((m) => ({
    id: m.id,
    downloads: (m.hf_downloads as number) ?? 0,
    likes: (m.hf_likes as number) ?? 0,
    stars: (m.github_stars as number) ?? 0,
    newsMentions: newsMentionMap.get(m.id) ?? 0,
    providerUsageEstimate: getProviderUsageEstimate((m.provider as string) ?? ""),
    trendingScore: m.hf_trending_score ? Number(m.hf_trending_score) : 0,
    releaseDate: m.release_date as string | null,
  }));

  const popStats = computePopularityStats(popularityInputs);
  const popularityMap = new Map<string, number>();
  const adoptionScoreMap = new Map<string, number>();
  const economicFootprintMap = new Map<string, number>();
  const marketCapMap = new Map<string, number>();

  for (const input of popularityInputs) {
    const popScore = computePopularityScore(input, popStats);
    popularityMap.set(input.id, popScore);

    const m = models.find((x) => x.id === input.id);
    const sourceCoverage = sourceCoverageMap.get(input.id) ?? null;
    const capabilityScore = capabilityScoreMap.get(input.id) ?? null;
    const qualityScore = qualityScoreMap.get(input.id) ?? null;
    const pricingSourceCount = pricingSourceMap.get(input.id)?.size ?? 0;
    const adoptionScore = computeAdoptionScore({
      downloads: input.downloads,
      providerUsageEstimate: input.providerUsageEstimate,
      pricingSourceCount,
      isApiAvailable: m?.is_api_available ?? false,
      releaseDate: input.releaseDate,
    });
    adoptionScoreMap.set(input.id, adoptionScore);

    const curatedPrice = m ? lookupProviderPrice(m.slug as string) : null;
    const dbPrice = cheapestPriceMap.get(input.id);
    const inputPrice = curatedPrice?.inputPricePerMillion ?? dbPrice ?? 0;
    const blendedPrice = inputPrice;

    const economicFootprintScore = computeEconomicFootprintScore({
      adoptionScore,
      blendedPricePerMillion: blendedPrice,
      pricingSourceCount,
      isApiAvailable: m?.is_api_available ?? false,
      releaseDate: input.releaseDate,
      corroborationLevel: sourceCoverage?.corroborationLevel ?? "none",
      sourceCoverage,
      capabilityScore,
      qualityScore,
    });
    economicFootprintMap.set(input.id, economicFootprintScore);

    const economicConfidenceMultiplier = computeEconomicConfidenceMultiplier({
      corroborationLevel: sourceCoverage?.corroborationLevel ?? "none",
      pricingSourceCount,
      sourceCoverage,
      capabilityScore,
      qualityScore,
    });

    const coverage = sourceCoverageMap.get(input.id) ?? null;
    const mktCap = computeMarketCap({
      adoptionScore,
      popularityScore: popScore,
      capabilityScore: capabilityScore ?? 0,
      economicFootprintScore,
      blendedPricePerMillion: blendedPrice,
      agentScore: agentScoreMap.get(input.id) ?? null,
      confidenceMultiplier: economicConfidenceMultiplier * getCorroborationMultiplier(coverage),
    });
    if (mktCap > 0) {
      marketCapMap.set(input.id, mktCap);
    }
  }

  // Compute popularity ranks
  const popRankedModels = Array.from(popularityMap.entries())
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id], i) => ({ id, rank: i + 1 }));
  const popRankMap = new Map(popRankedModels.map((r) => [r.id, r.rank]));

  const adoptionRankedModels = Array.from(adoptionScoreMap.entries())
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id], i) => ({ id, rank: i + 1 }));
  const adoptionRankMap = new Map(adoptionRankedModels.map((r) => [r.id, r.rank]));

  const economicFootprintRankedModels = Array.from(economicFootprintMap.entries())
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id], i) => ({ id, rank: i + 1 }));
  const economicFootprintRankMap = new Map(
    economicFootprintRankedModels.map((r) => [r.id, r.rank])
  );

  // --- LENS 4: Balanced composite rankings ---
  // Pre-compute value ranks (sorted descending by value score)
  const valueRankMap = new Map<string, number>();
  const valueSorted = Array.from(normalizedValueMap.entries())
    .sort((a, b) => b[1] - a[1]);
  valueSorted.forEach(([id], i) => { valueRankMap.set(id, i + 1); });

  const defaultRank = models.length;
  const balancedInput = models.map((m) => ({
    id: m.id,
    category: (m.category as string) ?? "other",
    capabilityRank: capRankMap.get(m.id) ?? null,
    usageRank: usageRankMap.get(m.id) ?? defaultRank,
    expertRank: expertRankMap.get(m.id) ?? defaultRank,
    valueRank: valueRankMap.get(m.id) ?? null,
  }));
  const balancedRankings = computeBalancedRankings(balancedInput);
  const balancedRankMap = new Map(
    balancedRankings.map(r => [r.id, { overall: r.balanced_rank, category: r.category_balanced_rank }])
  );

  return {
    scoredModels,
    capabilityScoreMap,
    capRankMap,
    usageScoreMap,
    usageRankMap,
    expertScoreMap,
    expertRankMap,
    balancedRankings,
    balancedRankMap,
    agentScoreMap,
    agentRankMap,
    popularityMap,
    popRankMap,
    adoptionScoreMap,
    adoptionRankMap,
    economicFootprintMap,
    economicFootprintRankMap,
    marketCapMap,
    cheapestPriceMap,
    normalizedValueMap,
    valueRankMap,
    pricingSynced,
    pricingSourceMap,
    stats,
  };
}
