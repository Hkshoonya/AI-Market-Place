import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";

import {
  computePublicRankingConfidenceScore,
  getPublicRankingConfidenceTier,
  hasLifecycleWarningLanguage,
  isEfficiencyTierModel,
  isPreviewLikeModel,
  isRecentLeadershipPublicRankingCandidate,
  releaseAgeDays,
  selectPublicRankingPool,
  type PublicRankingConfidenceModel,
} from "./public-ranking-confidence";

export interface PublicRankingHealthModel extends PublicRankingConfidenceModel {
  id: string;
  slug: string;
  name: string;
  provider: string;
  overall_rank?: number | null;
}

export interface PublicRankingHealthSummaryRow {
  id: string;
  slug: string;
  name: string;
  provider: string;
  releaseDate: string | null;
  overallRank: number | null;
  confidenceScore: number;
  confidenceTier: ReturnType<typeof getPublicRankingConfidenceTier>;
}

export interface PublicRankingHealth {
  healthy: boolean;
  poolCount: number;
  pool: PublicRankingHealthSummaryRow[];
  missingRecentLeadership: PublicRankingHealthSummaryRow[];
  lifecycleRowsInPool: PublicRankingHealthSummaryRow[];
  previewRowsInPool: PublicRankingHealthSummaryRow[];
  staleRowsInPool: PublicRankingHealthSummaryRow[];
}

function summarizeRow(model: PublicRankingHealthModel): PublicRankingHealthSummaryRow {
  return {
    id: model.id,
    slug: model.slug,
    name: model.name,
    provider: model.provider,
    releaseDate: model.release_date ?? null,
    overallRank: model.overall_rank ?? null,
    confidenceScore: Number(computePublicRankingConfidenceScore(model).toFixed(2)),
    confidenceTier: getPublicRankingConfidenceTier(model),
  };
}

export function computePublicRankingHealth(
  models: PublicRankingHealthModel[],
  minimumCount = 10
): PublicRankingHealth {
  const deduped = preferDefaultPublicSurfaceReady(
    dedupePublicModelFamilies(models),
    Math.min(minimumCount, 10)
  );
  const pool = selectPublicRankingPool(deduped, Math.min(minimumCount, 10));
  const poolIdSet = new Set(pool.map((model) => model.id));
  const weakestPoolScore =
    pool.length > 0
      ? Math.min(...pool.map((model) => computePublicRankingConfidenceScore(model)))
      : 0;

  const missingRecentLeadership = deduped
    .filter((model) => !poolIdSet.has(model.id))
    .filter((model) => isRecentLeadershipPublicRankingCandidate(model))
    .filter(
      (model) =>
        computePublicRankingConfidenceScore(model) >= weakestPoolScore - 4
    )
    .sort(
      (left, right) =>
        computePublicRankingConfidenceScore(right) -
        computePublicRankingConfidenceScore(left)
    )
    .slice(0, 10)
    .map((model) => summarizeRow(model));

  const lifecycleRowsInPool = pool
    .filter((model) => hasLifecycleWarningLanguage(model))
    .map((model) => summarizeRow(model));
  const previewRowsInPool = pool
    .filter((model) => isPreviewLikeModel(model) || isEfficiencyTierModel(model))
    .map((model) => summarizeRow(model));
  const staleRowsInPool = pool
    .filter((model) => (releaseAgeDays(model.release_date) ?? 0) > 365)
    .map((model) => summarizeRow(model));

  return {
    healthy:
      missingRecentLeadership.length === 0 &&
      lifecycleRowsInPool.length === 0 &&
      previewRowsInPool.length === 0,
    poolCount: pool.length,
    pool: pool.map((model) => summarizeRow(model)),
    missingRecentLeadership,
    lifecycleRowsInPool,
    previewRowsInPool,
    staleRowsInPool,
  };
}
