interface HomepageTopModelCandidate {
  id: string;
  overall_rank?: number | null;
  capability_score?: number | null;
  adoption_score?: number | null;
  economic_footprint_score?: number | null;
  quality_score?: number | null;
  popularity_score?: number | null;
}

function numeric(value: number | null | undefined): number {
  return value == null || !Number.isFinite(Number(value)) ? 0 : Number(value);
}

function rankSignal(overallRank: number | null | undefined): number {
  if (overallRank == null || !Number.isFinite(Number(overallRank))) return 0;

  const boundedRank = Math.max(1, Math.min(100, Number(overallRank)));
  return 101 - boundedRank;
}

export function computeHomepageTopModelScore(model: HomepageTopModelCandidate): number {
  return (
    numeric(model.capability_score) * 0.28 +
    numeric(model.quality_score) * 0.22 +
    numeric(model.adoption_score) * 0.18 +
    numeric(model.popularity_score) * 0.12 +
    numeric(model.economic_footprint_score) * 0.10 +
    rankSignal(model.overall_rank) * 0.10
  );
}

export function selectHomepageTopModelIds<
  T extends HomepageTopModelCandidate
>(models: T[], limit: number): string[] {
  return [...models]
    .filter((model) => {
      return (
        model.economic_footprint_score != null ||
        model.adoption_score != null ||
        model.capability_score != null
      );
    })
    .sort((left, right) => {
      const scoreDelta = computeHomepageTopModelScore(right) - computeHomepageTopModelScore(left);
      if (scoreDelta !== 0) return scoreDelta;

      const rankDelta = rankSignal(right.overall_rank) - rankSignal(left.overall_rank);
      if (rankDelta !== 0) return rankDelta;

      return numeric(right.capability_score) - numeric(left.capability_score);
    })
    .slice(0, limit)
    .map((model) => model.id);
}
