import { selectHomepageActiveModelCandidates } from "@/lib/homepage/fetch-active-models";
import {
  isRecentLeadershipHomepageCandidate,
  type HomepageTopModelCandidate,
} from "@/lib/homepage/top-models";
import { MODEL_PUBLIC_RANKING_FIELDS } from "@/lib/models/public-ranking-inputs";
import { isRecentLeadershipPublicRankingCandidate } from "@/lib/models/public-ranking-confidence";

export const RANKING_HEALTH_MODEL_CANDIDATE_LIMIT = 600;

type RankingHealthCandidate = HomepageTopModelCandidate & { id: string };

function hasPositiveRankingSignal(model: RankingHealthCandidate) {
  return MODEL_PUBLIC_RANKING_FIELDS.some((field) => {
    const value = (model as unknown as Record<string, unknown>)[field];
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  });
}

export function selectRankingHealthModelCandidates<
  T extends RankingHealthCandidate,
>(
  models: T[],
  limit = RANKING_HEALTH_MODEL_CANDIDATE_LIMIT,
  now = Date.now()
): T[] {
  const preferredIds = models
    .filter(
      (model) =>
        hasPositiveRankingSignal(model) ||
        isRecentLeadershipHomepageCandidate(model, now) ||
        isRecentLeadershipPublicRankingCandidate(model, now)
    )
    .map((model) => model.id);

  return selectHomepageActiveModelCandidates(models, limit, {
    preferredIds,
    now,
  });
}
