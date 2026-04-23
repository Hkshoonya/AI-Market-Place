import {
  computePublicRankingConfidenceScore,
  hasLeadershipUpgradeLanguage,
  hasLifecycleWarningLanguage,
  isEfficiencyTierModel,
  isPreviewLikeModel,
  releaseAgeDays,
} from "@/lib/models/public-ranking-confidence";

interface SearchableModel {
  slug: string;
  name: string;
  provider?: string | null;
  status?: string | null;
  description?: string | null;
  short_description?: string | null;
  popularity_score?: number | null;
  overall_rank?: number | null;
  quality_score?: number | null;
  capability_score?: number | null;
  adoption_score?: number | null;
  economic_footprint_score?: number | null;
  release_date?: string | null;
  is_open_weights?: boolean | null;
  is_api_available?: boolean | null;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isBroadBrandQuery(rawQuery: string): boolean {
  const query = normalize(rawQuery);
  if (!query) return false;

  const tokens = query.split(/\s+/).filter(Boolean);
  return tokens.length === 1 && !/\d/.test(query) && query.length >= 3;
}

function currentGenerationSearchAdjustment(
  model: SearchableModel,
  rawQuery: string
): number {
  const query = normalize(rawQuery);
  const provider = normalize(model.provider);
  const ageDays = releaseAgeDays(model.release_date);
  const capability = Number(model.capability_score ?? 0);
  const overallRank = Number(model.overall_rank ?? Number.MAX_SAFE_INTEGER);
  let adjustment = 0;

  if (hasLifecycleWarningLanguage(model) || model.status === "deprecated") {
    adjustment -= 160;
  }

  if (isPreviewLikeModel(model)) adjustment -= 24;
  if (isEfficiencyTierModel(model)) adjustment -= 12;

  if (hasLeadershipUpgradeLanguage(model)) {
    if (ageDays != null && ageDays <= 30) adjustment += 140;
    else if (ageDays != null && ageDays <= 120) adjustment += 90;
    else if (ageDays != null && ageDays <= 240) adjustment += 30;
    else adjustment += 12;
  }

  if (provider === query && ageDays != null && ageDays <= 120) {
    adjustment += 18;
  }

  if (isBroadBrandQuery(rawQuery)) {
    const standardCurrentRow =
      !hasLifecycleWarningLanguage(model) &&
      !isPreviewLikeModel(model) &&
      !isEfficiencyTierModel(model);

    if (
      standardCurrentRow &&
      capability >= 80 &&
      overallRank <= 20
    ) {
      adjustment += 150;
    } else if (
      standardCurrentRow &&
      hasLeadershipUpgradeLanguage(model) &&
      ageDays != null &&
      ageDays <= 240
    ) {
      adjustment += 72;
    } else if (
      standardCurrentRow &&
      capability >= 78 &&
      overallRank <= 25
    ) {
      adjustment += 28;
    }

    if (ageDays != null && ageDays > 365 && capability < 72) {
      adjustment -= 18;
    }
  }

  return adjustment;
}

export function getModelSearchRelevance(
  model: SearchableModel,
  rawQuery: string
): number {
  const query = normalize(rawQuery);
  if (!query) return 0;

  const compactQuery = query.replace(/\s+/g, "");
  const name = normalize(model.name);
  const slug = normalize(model.slug);
  const provider = normalize(model.provider);
  const description = normalize(model.description ?? model.short_description);

  let score = 0;

  if (name === query || slug === query) score += 1_000;
  if (name.replace(/\s+/g, "") === compactQuery || slug.replace(/\s+/g, "") === compactQuery) {
    score += 900;
  }

  if (name.startsWith(query) || slug.startsWith(query)) score += 600;
  if (name.includes(query) || slug.includes(query)) score += 400;
  if (provider === query) score += 250;
  if (provider.includes(query)) score += 120;
  if (description.includes(query)) score += 60;

  const popularity = Number(model.popularity_score ?? 0);
  const rankBoost =
    model.overall_rank != null && model.overall_rank > 0
      ? Math.max(0, 80 - model.overall_rank)
      : 0;
  const confidenceBoost = computePublicRankingConfidenceScore(model) * 2;
  const currentGenerationBoost = currentGenerationSearchAdjustment(model, rawQuery);

  return score + popularity + rankBoost + confidenceBoost + currentGenerationBoost;
}

export function rankModelsForSearch<T extends SearchableModel>(
  models: T[],
  rawQuery: string
): T[] {
  return [...models].sort((left, right) => {
    const relevanceDelta =
      getModelSearchRelevance(right, rawQuery) - getModelSearchRelevance(left, rawQuery);
    if (relevanceDelta !== 0) return relevanceDelta;

    const confidenceDelta =
      computePublicRankingConfidenceScore(right) -
      computePublicRankingConfidenceScore(left);
    if (confidenceDelta !== 0) return confidenceDelta;

    const popularityDelta = Number(right.popularity_score ?? 0) - Number(left.popularity_score ?? 0);
    if (popularityDelta !== 0) return popularityDelta;

    const leftRank = left.overall_rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = right.overall_rank ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
}
