export type LeaderboardLens =
  | "capability"
  | "popularity"
  | "adoption"
  | "economic"
  | "value"
  | "usage"
  | "expert"
  | "balanced";

export interface LeaderboardLensModel {
  slug: string;
  overall_rank: number | null;
  capability_rank: number | null;
  popularity_rank: number | null;
  adoption_rank: number | null;
  economic_footprint_rank: number | null;
  balanced_rank: number | null;
  capability_score: number | null;
  popularity_score: number | null;
  adoption_score: number | null;
  economic_footprint_score: number | null;
  value_score: number | null;
  usage_score: number | null;
  expert_score: number | null;
}

export function getLeaderboardLensRank(
  model: LeaderboardLensModel,
  lens: LeaderboardLens
): number {
  switch (lens) {
    case "capability":
      return model.capability_rank ?? Number.MAX_SAFE_INTEGER;
    case "popularity":
      return model.popularity_rank ?? Number.MAX_SAFE_INTEGER;
    case "adoption":
      return model.adoption_rank ?? Number.MAX_SAFE_INTEGER;
    case "economic":
      return model.economic_footprint_rank ?? Number.MAX_SAFE_INTEGER;
    case "balanced":
      return model.balanced_rank ?? Number.MAX_SAFE_INTEGER;
    case "value":
    case "usage":
    case "expert":
      return model.overall_rank ?? Number.MAX_SAFE_INTEGER;
  }
}

export function getLeaderboardLensScore(
  model: LeaderboardLensModel,
  lens: LeaderboardLens
): number {
  switch (lens) {
    case "capability":
      return model.capability_score ?? Number.NEGATIVE_INFINITY;
    case "popularity":
      return model.popularity_score ?? Number.NEGATIVE_INFINITY;
    case "adoption":
      return model.adoption_score ?? Number.NEGATIVE_INFINITY;
    case "economic":
      return model.economic_footprint_score ?? Number.NEGATIVE_INFINITY;
    case "value":
      return model.value_score ?? Number.NEGATIVE_INFINITY;
    case "usage":
      return model.usage_score ?? Number.NEGATIVE_INFINITY;
    case "expert":
      return model.expert_score ?? Number.NEGATIVE_INFINITY;
    case "balanced":
      return model.capability_score ?? Number.NEGATIVE_INFINITY;
  }
}

export function sortModelsForLens<T extends LeaderboardLensModel>(
  models: T[],
  lens: LeaderboardLens
): T[] {
  return [...models].sort((left, right) => {
    const rankDelta = getLeaderboardLensRank(left, lens) - getLeaderboardLensRank(right, lens);
    if (rankDelta !== 0) return rankDelta;

    const scoreDelta = getLeaderboardLensScore(right, lens) - getLeaderboardLensScore(left, lens);
    if (scoreDelta !== 0) return scoreDelta;

    return (left.overall_rank ?? Number.MAX_SAFE_INTEGER) - (right.overall_rank ?? Number.MAX_SAFE_INTEGER);
  });
}
