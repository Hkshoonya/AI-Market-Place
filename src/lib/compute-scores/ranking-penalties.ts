import {
  hasLeadershipUpgradeLanguage,
  hasLifecycleWarningLanguage,
  isEfficiencyTierModel,
  isPreviewLikeModel,
  releaseAgeDays,
} from "@/lib/models/public-ranking-confidence";
import { getKnownModelMeta } from "@/lib/models/known-model-meta";

export interface RankingPenaltyModel {
  slug?: string | null;
  name?: string | null;
  provider?: string | null;
  status?: string | null;
  description?: string | null;
  short_description?: string | null;
  release_date?: string | null;
  is_open_weights?: boolean | null;
  is_api_available?: boolean | null;
  benchmarkCount?: number | null;
  capabilityRank?: number | null;
}

function isLifecycleReplacementRow(model: RankingPenaltyModel) {
  return hasLifecycleWarningLanguage(model) || model.status === "deprecated" || model.status === "archived";
}

function isCompatibilityRetentionRow(model: RankingPenaltyModel) {
  const knownMeta = getKnownModelMeta(model);
  const haystack = `${model.name ?? ""} ${model.description ?? ""} ${model.short_description ?? ""} ${
    knownMeta?.description ?? ""
  }`.toLowerCase();
  return (
    /retained for compatibility/.test(haystack) ||
    /previous flagship/.test(haystack) ||
    /previous full/.test(haystack) ||
    /recommended replacement/.test(haystack)
  );
}

function isClosedUnavailableRow(model: RankingPenaltyModel) {
  return model.is_api_available === false && !model.is_open_weights;
}

function isRecentLeadershipBonusRow(model: RankingPenaltyModel) {
  const ageDays = releaseAgeDays(model.release_date);
  const benchmarkCount = Number(model.benchmarkCount ?? 0);
  const capabilityRank = Number(model.capabilityRank ?? Number.POSITIVE_INFINITY);

  return (
    ageDays != null &&
    ageDays <= 120 &&
    benchmarkCount >= 4 &&
    capabilityRank <= 20 &&
    hasLeadershipUpgradeLanguage(model) &&
    !isPreviewLikeModel(model) &&
    !isEfficiencyTierModel(model) &&
    !isLifecycleReplacementRow(model) &&
    !isClosedUnavailableRow(model)
  );
}

function isAgingLeadershipDriftRow(model: RankingPenaltyModel) {
  const ageDays = releaseAgeDays(model.release_date);
  const capabilityRank = Number(model.capabilityRank ?? Number.POSITIVE_INFINITY);

  return (
    ageDays != null &&
    ageDays > 240 &&
    capabilityRank > 20 &&
    hasLeadershipUpgradeLanguage(model) &&
    !isRecentLeadershipBonusRow(model) &&
    !isPreviewLikeModel(model) &&
    !isEfficiencyTierModel(model) &&
    !isLifecycleReplacementRow(model) &&
    !isClosedUnavailableRow(model) &&
    !model.is_open_weights
  );
}

function isAgingMidPackCommercialRow(model: RankingPenaltyModel) {
  const ageDays = releaseAgeDays(model.release_date);
  const capabilityRank = Number(model.capabilityRank ?? Number.POSITIVE_INFINITY);

  return (
    ageDays != null &&
    ageDays > 300 &&
    capabilityRank > 25 &&
    !hasLeadershipUpgradeLanguage(model) &&
    !isPreviewLikeModel(model) &&
    !isEfficiencyTierModel(model) &&
    !isLifecycleReplacementRow(model) &&
    !isClosedUnavailableRow(model) &&
    !model.is_open_weights
  );
}

function isRecentMidPackCommercialSurvivor(model: RankingPenaltyModel) {
  const ageDays = releaseAgeDays(model.release_date);
  const capabilityRank = Number(model.capabilityRank ?? Number.POSITIVE_INFINITY);
  const benchmarkCount = Number(model.benchmarkCount ?? 0);

  return (
    ageDays != null &&
    ageDays <= 180 &&
    capabilityRank >= 30 &&
    benchmarkCount > 0 &&
    benchmarkCount <= 4 &&
    !hasLeadershipUpgradeLanguage(model) &&
    !isPreviewLikeModel(model) &&
    !isEfficiencyTierModel(model) &&
    !isLifecycleReplacementRow(model) &&
    !isClosedUnavailableRow(model) &&
    !model.is_open_weights
  );
}

export function computeCapabilityScoreMultiplier(model: RankingPenaltyModel) {
  const ageDays = releaseAgeDays(model.release_date);
  let multiplier = 1;

  if (isPreviewLikeModel(model)) {
    multiplier *= 0.92;
  }

  if (isEfficiencyTierModel(model) && ageDays != null && ageDays > 180) {
    multiplier *= 0.96;
  }

  if (isClosedUnavailableRow(model)) {
    multiplier *= 0.88;
  }

  if (isLifecycleReplacementRow(model)) {
    if (isCompatibilityRetentionRow(model)) {
      if (ageDays != null && ageDays > 365) multiplier *= 0.62;
      else if (ageDays != null && ageDays > 180) multiplier *= 0.66;
      else multiplier *= 0.72;
    } else if (ageDays != null && ageDays > 365) multiplier *= 0.68;
    else if (ageDays != null && ageDays > 180) multiplier *= 0.72;
    else multiplier *= 0.78;
  }

  return Math.max(0.45, Math.min(1, multiplier));
}

export function computeBalancedRankPenalty(model: RankingPenaltyModel, modelCount: number) {
  const ageDays = releaseAgeDays(model.release_date);
  let penalty = 0;

  if (isRecentLeadershipBonusRow(model)) {
    const benchmarkCount = Number(model.benchmarkCount ?? 0);
    penalty -=
      benchmarkCount >= 6
        ? Math.round(modelCount * 0.2)
        : Math.round(modelCount * 0.14);
  }

  if (isPreviewLikeModel(model)) {
    penalty += Math.round(modelCount * 0.03);
  }

  if (isEfficiencyTierModel(model) && ageDays != null && ageDays > 180) {
    penalty += Math.round(modelCount * 0.02);
  }

  if (isClosedUnavailableRow(model)) {
    penalty += Math.round(modelCount * 0.08);
  }

  if (isAgingLeadershipDriftRow(model)) {
    penalty +=
      ageDays != null && ageDays > 365
        ? Math.round(modelCount * 0.08)
        : Math.round(modelCount * 0.05);
  }

  if (isAgingMidPackCommercialRow(model)) {
    penalty +=
      ageDays != null && ageDays > 365
        ? Math.round(modelCount * 0.06)
        : Math.round(modelCount * 0.04);
  }

  if (isRecentMidPackCommercialSurvivor(model)) {
    penalty += Math.round(modelCount * 0.04);
  }

  if (isLifecycleReplacementRow(model)) {
    if (isCompatibilityRetentionRow(model)) {
      if (ageDays != null && ageDays > 365) penalty += Math.round(modelCount * 0.42);
      else if (ageDays != null && ageDays > 180) penalty += Math.round(modelCount * 0.36);
      else penalty += Math.round(modelCount * 0.3);
    } else if (ageDays != null && ageDays > 365) penalty += Math.round(modelCount * 0.32);
    else if (ageDays != null && ageDays > 180) penalty += Math.round(modelCount * 0.26);
    else penalty += Math.round(modelCount * 0.2);
  }

  return penalty;
}
