/**
 * Compute Scores Pipeline — Persist Results
 *
 * Batch-updates the models table and creates model_snapshots for trend tracking.
 * Uses parameter injection (supabase client passed in).
 * No dependency on Next.js server types.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSignalCoverage } from "@/lib/pipeline-health";
import { createTaggedLogger } from "@/lib/logging";
import { isDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";
import { stripPublicRankingInputs } from "@/lib/models/public-ranking-inputs";
import type { ScoringInputs, ScoringResults, PersistStats } from "./types";

const log = createTaggedLogger("compute-scores/persist-results");
const SNAPSHOT_UPSERT_MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Persist scoring results to the database.
 *
 * @param supabase - Injected Supabase client (service role)
 * @param inputs   - ScoringInputs (needs models list for snapshot data and benchmark/elo/news maps)
 * @param results  - ScoringResults containing all computed scores and ranks
 * @returns PersistStats with model update and snapshot persistence counts
 */
export async function persistResults(
  supabase: SupabaseClient,
  inputs: ScoringInputs,
  results: ScoringResults
): Promise<PersistStats> {
  const {
    models,
    benchmarkMap,
    eloMap,
    newsMentionMap,
    sourceCoverageMap,
  } = inputs;

  const {
    scoredModels,
    capabilityScoreMap,
    capRankMap,
    usageScoreMap,
    usageRankMap,
    expertScoreMap,
    expertRankMap,
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
  } = results;

  // 7. Batch update models (parallel within each batch of 50)
  let updated = 0;
  let errors = 0;
  const BATCH = 50;
  const modelMap = new Map(models.map((m) => [m.id, m]));

  for (let i = 0; i < scoredModels.length; i += BATCH) {
    const batch = scoredModels.slice(i, i + BATCH);

    const promises = batch.map((sm) => {
      const model = modelMap.get(sm.id);
      const updateData: Record<string, unknown> = {
        quality_score: sm.qualityScore,
        popularity_score: popularityMap.get(sm.id) ?? 0,
        capability_score: null,
        capability_rank: null,
        agent_score: null,
        agent_rank: null,
        popularity_rank: null,
        market_cap_estimate: null,
      };

      // Lens scores
      const capScore = capabilityScoreMap.get(sm.id);
      if (capScore != null) {
        updateData.capability_score = capScore;
        updateData.capability_rank = capRankMap.get(sm.id) ?? null;
      }
      updateData.usage_score = usageScoreMap.get(sm.id) ?? 0;
      updateData.usage_rank = usageRankMap.get(sm.id) ?? null;
      updateData.expert_score = expertScoreMap.get(sm.id) ?? 0;
      updateData.expert_rank = expertRankMap.get(sm.id) ?? null;

      const balRank = balancedRankMap.get(sm.id);
      if (balRank) {
        updateData.balanced_rank = balRank.overall;
        updateData.overall_rank = balRank.overall;
        updateData.category_rank = balRank.category;
      }

      // Store normalized value score (0-100) or null if no pricing
      const valueScore = normalizedValueMap.get(sm.id);
      updateData.value_score = valueScore ?? null;

      // Agent score + rank
      const agentScore = agentScoreMap.get(sm.id);
      if (agentScore !== undefined) {
        updateData.agent_score = agentScore;
        updateData.agent_rank = agentRankMap.get(sm.id) ?? null;
      }

      // Popularity + Market cap
      const popRank = popRankMap.get(sm.id);
      if (popRank !== undefined) {
        updateData.popularity_rank = popRank;
      }
      const adoptionScore = adoptionScoreMap.get(sm.id);
      if (adoptionScore !== undefined) {
        updateData.adoption_score = adoptionScore;
        updateData.adoption_rank = adoptionRankMap.get(sm.id) ?? null;
      }
      const economicFootprintScore = economicFootprintMap.get(sm.id);
      if (economicFootprintScore !== undefined) {
        updateData.economic_footprint_score = economicFootprintScore;
        updateData.economic_footprint_rank = economicFootprintRankMap.get(sm.id) ?? null;
      }
      const mktCap = marketCapMap.get(sm.id);
      if (mktCap !== undefined) {
        updateData.market_cap_estimate = mktCap;
      }

      if (model && !isDefaultPublicSurfaceReady(model)) {
        Object.assign(updateData, stripPublicRankingInputs(updateData));
      }

      return supabase
        .from("models")
        .update(updateData)
        .eq("id", sm.id)
        .then(({ error }) => ({ error }));
    });

    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      if (r.error) errors++;
      else updated++;
    }
  }

  // 8. Create model_snapshots for trend tracking (parallel batches)
  const today = new Date().toISOString().split("T")[0];
  let snapshotsCreated = 0;
  let snapshotErrors = 0;

  async function upsertSnapshotWithRetry(snapshot: Record<string, unknown>, modelMeta: {
    id: string;
    slug: string;
    name: string;
  }) {
    for (let attempt = 1; attempt <= SNAPSHOT_UPSERT_MAX_ATTEMPTS; attempt++) {
      const { error } = await supabase
        .from("model_snapshots")
        .upsert(snapshot, { onConflict: "model_id,snapshot_date" });

      if (!error) {
        return { error: null };
      }

      if (attempt < SNAPSHOT_UPSERT_MAX_ATTEMPTS) {
        await sleep(50 * attempt);
        continue;
      }

      void log.warn("Model snapshot upsert failed after retries", {
        modelId: modelMeta.id,
        modelSlug: modelMeta.slug,
        modelName: modelMeta.name,
        snapshotDate: snapshot.snapshot_date,
        attempts: attempt,
        error: error.message,
      });
      return { error };
    }

    return { error: null };
  }

  for (let i = 0; i < scoredModels.length; i += BATCH) {
    const batch = scoredModels.slice(i, i + BATCH);

    const snapPromises = batch.map((sm) => {
      const m = modelMap.get(sm.id);
      if (!m) return Promise.resolve({ error: null, skipped: true });

      const balRank = balancedRankMap.get(sm.id);

      const signalCoverage = buildSignalCoverage({
        hasBenchmarks: benchmarkMap.has(sm.id),
        hasELO: eloMap.has(sm.id),
        hasDownloads: !!m.hf_downloads,
        hasLikes: !!m.hf_likes,
        hasStars: !!m.github_stars,
        hasNews: (newsMentionMap.get(sm.id) ?? 0) > 0,
        hasPricing: cheapestPriceMap.has(sm.id),
      });
      const sourceCoverage = sourceCoverageMap.get(sm.id) ?? null;
      const snapshot = {
        model_id: sm.id,
        snapshot_date: today,
        quality_score: sm.qualityScore,
        hf_downloads: m.hf_downloads,
        hf_likes: m.hf_likes,
        overall_rank: balRank?.overall ?? null,
        popularity_score: popularityMap.get(sm.id) ?? null,
        adoption_score: adoptionScoreMap.get(sm.id) ?? null,
        economic_footprint_score: economicFootprintMap.get(sm.id) ?? null,
        market_cap_estimate: marketCapMap.get(sm.id) ?? null,
        agent_score: agentScoreMap.get(sm.id) ?? null,
        capability_score: capabilityScoreMap.get(sm.id) ?? null,
        usage_score: usageScoreMap.get(sm.id) ?? null,
        expert_score: expertScoreMap.get(sm.id) ?? null,
        signal_coverage: signalCoverage,
        source_coverage: sourceCoverage,
      };

      return upsertSnapshotWithRetry(snapshot, {
        id: m.id,
        slug: m.slug,
        name: m.name,
      }).then(({ error }) => ({ error, skipped: false }));
    });

    const snapResults = await Promise.all(snapPromises);
    for (const r of snapResults) {
      if (!r.skipped && !r.error) snapshotsCreated++;
      if (!r.skipped && r.error) snapshotErrors++;
    }
  }

  return { updated, errors, snapshotsCreated, snapshotErrors };
}
