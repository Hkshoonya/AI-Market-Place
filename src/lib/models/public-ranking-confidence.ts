import { hasDiscoveryMetadata, type PublicSurfaceReadinessModel } from "@/lib/models/public-surface-readiness";

export interface PublicRankingConfidenceModel extends PublicSurfaceReadinessModel {
  benchmark_scores?: unknown;
  elo_ratings?: unknown;
}

function numeric(value: number | null | undefined): number {
  return value == null || !Number.isFinite(Number(value)) ? 0 : Number(value);
}

function listCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function releaseAgeDays(releaseDate: string | null | undefined): number | null {
  if (!releaseDate) return null;

  const timestamp = Date.parse(releaseDate);
  if (!Number.isFinite(timestamp)) return null;

  return Math.max(0, (Date.now() - timestamp) / (24 * 60 * 60 * 1000));
}

function isPreviewLikeModel(model: Pick<PublicRankingConfidenceModel, "slug" | "name">) {
  const haystack = `${model.slug ?? ""} ${model.name ?? ""}`.toLowerCase();
  return /\b(preview|beta|experimental|alpha|test)\b/.test(haystack);
}

function isEfficiencyTierModel(model: Pick<PublicRankingConfidenceModel, "slug" | "name">) {
  const haystack = `${model.slug ?? ""} ${model.name ?? ""}`.toLowerCase();
  return /\b(flash|mini|nano|instant|lite)\b/.test(haystack);
}

function coreScoreConfidence(model: PublicRankingConfidenceModel) {
  const capability = numeric(model.capability_score);
  const quality = numeric(model.quality_score);

  if (capability >= 84 || quality >= 84) return 18;
  if (capability >= 80 && quality >= 66) return 15;
  if (capability >= 76 && quality >= 58) return 12;
  if (capability >= 72 && quality >= 72) return 12;
  if (capability >= 68 || quality >= 68) return 7;
  return 0;
}

function tractionConfidence(model: PublicRankingConfidenceModel) {
  let score = 0;

  const adoption = numeric(model.adoption_score);
  const economic = numeric(model.economic_footprint_score);
  const popularity = numeric(model.popularity_score);
  const overallRank = numeric(model.overall_rank);

  if (adoption >= 65) score += 8;
  else if (adoption >= 50) score += 5;
  else if (adoption >= 35) score += 2;

  if (economic >= 60) score += 8;
  else if (economic >= 45) score += 5;
  else if (economic >= 30) score += 2;

  if (popularity >= 70) score += 5;
  else if (popularity >= 55) score += 3;
  else if (popularity >= 40) score += 1;

  if (overallRank > 0 && overallRank <= 10) score += 8;
  else if (overallRank > 0 && overallRank <= 25) score += 5;
  else if (overallRank > 0 && overallRank <= 50) score += 3;
  else if (overallRank > 0 && overallRank <= 100) score += 1;

  return score;
}

function benchmarkConfidence(model: PublicRankingConfidenceModel) {
  const benchmarkCount = listCount(model.benchmark_scores);
  const arenaCount = listCount(model.elo_ratings);

  if (benchmarkCount > 0) return 16;
  if (arenaCount > 0) return 6;
  return 0;
}

function freshnessAdjustment(model: PublicRankingConfidenceModel) {
  const ageDays = releaseAgeDays(model.release_date);
  let adjustment = 0;

  if (ageDays != null) {
    if (ageDays > 540) adjustment -= 7;
    else if (ageDays > 365) adjustment -= 4;
    else if (ageDays > 270) adjustment -= 2;
  }

  if (isPreviewLikeModel(model)) adjustment -= 6;

  if (isEfficiencyTierModel(model)) {
    adjustment -= ageDays != null && ageDays > 240 ? 5 : 2;
  }

  return adjustment;
}

export function computePublicRankingConfidenceScore(
  model: PublicRankingConfidenceModel
) {
  let score =
    coreScoreConfidence(model) +
    tractionConfidence(model) +
    benchmarkConfidence(model) +
    freshnessAdjustment(model);

  if (!hasDiscoveryMetadata(model)) {
    score -= 5;
  }

  return score;
}

export type PublicRankingConfidenceTier = "high" | "medium" | "low";

export function getPublicRankingConfidenceTier(
  model: PublicRankingConfidenceModel
): PublicRankingConfidenceTier {
  const score = computePublicRankingConfidenceScore(model);
  if (score >= 28) return "high";
  if (score >= 14) return "medium";
  return "low";
}

export function selectPublicRankingPool<T extends PublicRankingConfidenceModel>(
  models: T[],
  minimumCount: number
) {
  const highConfidence = models.filter(
    (model) => getPublicRankingConfidenceTier(model) === "high"
  );
  if (highConfidence.length >= minimumCount) {
    return highConfidence;
  }

  const mediumOrHighConfidence = models.filter((model) => {
    const tier = getPublicRankingConfidenceTier(model);
    return tier === "high" || tier === "medium";
  });
  if (mediumOrHighConfidence.length >= minimumCount) {
    return mediumOrHighConfidence;
  }

  return models;
}
