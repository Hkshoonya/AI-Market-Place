import {
  hasLifecycleWarningLanguage,
  isEfficiencyTierModel,
  isPreviewLikeModel,
  releaseAgeDays,
} from "@/lib/models/public-ranking-confidence";

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
}

function isLifecycleReplacementRow(model: RankingPenaltyModel) {
  return hasLifecycleWarningLanguage(model) || model.status === "deprecated" || model.status === "archived";
}

function isClosedUnavailableRow(model: RankingPenaltyModel) {
  return model.is_api_available === false && !model.is_open_weights;
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
    if (ageDays != null && ageDays > 365) multiplier *= 0.68;
    else if (ageDays != null && ageDays > 180) multiplier *= 0.72;
    else multiplier *= 0.78;
  }

  return Math.max(0.45, Math.min(1, multiplier));
}

export function computeBalancedRankPenalty(model: RankingPenaltyModel, modelCount: number) {
  const ageDays = releaseAgeDays(model.release_date);
  let penalty = 0;

  if (isPreviewLikeModel(model)) {
    penalty += Math.round(modelCount * 0.03);
  }

  if (isEfficiencyTierModel(model) && ageDays != null && ageDays > 180) {
    penalty += Math.round(modelCount * 0.02);
  }

  if (isClosedUnavailableRow(model)) {
    penalty += Math.round(modelCount * 0.08);
  }

  if (isLifecycleReplacementRow(model)) {
    if (ageDays != null && ageDays > 365) penalty += Math.round(modelCount * 0.32);
    else if (ageDays != null && ageDays > 180) penalty += Math.round(modelCount * 0.26);
    else penalty += Math.round(modelCount * 0.2);
  }

  return penalty;
}
