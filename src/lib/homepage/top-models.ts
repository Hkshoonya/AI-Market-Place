interface HomepageTopModelCandidate {
  id: string;
  capability_score?: number | null;
  adoption_score?: number | null;
  economic_footprint_score?: number | null;
  quality_score?: number | null;
  popularity_score?: number | null;
}

function numeric(value: number | null | undefined): number {
  return value == null || !Number.isFinite(Number(value)) ? 0 : Number(value);
}

export function computeHomepageTopModelScore(model: HomepageTopModelCandidate): number {
  return (
    numeric(model.economic_footprint_score) * 0.38 +
    numeric(model.adoption_score) * 0.27 +
    numeric(model.capability_score) * 0.18 +
    numeric(model.quality_score) * 0.12 +
    numeric(model.popularity_score) * 0.05
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

      const economicDelta = numeric(right.economic_footprint_score) - numeric(left.economic_footprint_score);
      if (economicDelta !== 0) return economicDelta;

      return numeric(right.adoption_score) - numeric(left.adoption_score);
    })
    .slice(0, limit)
    .map((model) => model.id);
}
