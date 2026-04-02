interface HomepageTopModelCandidate {
  id: string;
  overall_rank?: number | null;
  capability_score?: number | null;
  adoption_score?: number | null;
  economic_footprint_score?: number | null;
  quality_score?: number | null;
  popularity_score?: number | null;
  release_date?: string | null;
}

function numeric(value: number | null | undefined): number {
  return value == null || !Number.isFinite(Number(value)) ? 0 : Number(value);
}

function rankSignal(overallRank: number | null | undefined): number {
  if (overallRank == null || !Number.isFinite(Number(overallRank))) return 0;

  const boundedRank = Math.max(1, Math.min(100, Number(overallRank)));
  return 101 - boundedRank;
}

function releaseFreshnessSignal(
  releaseDate: string | null | undefined,
  now = Date.now()
): number {
  if (!releaseDate) return 45;

  const timestamp = Date.parse(releaseDate);
  if (!Number.isFinite(timestamp)) return 45;

  const ageDays = Math.max(0, (now - timestamp) / (24 * 60 * 60 * 1000));

  if (ageDays <= 120) return 100;
  if (ageDays <= 240) return 85;
  if (ageDays <= 365) return 70;
  if (ageDays <= 540) return 45;
  return 20;
}

export function computeHomepageTopModelScore(
  model: HomepageTopModelCandidate,
  now = Date.now()
): number {
  return (
    numeric(model.capability_score) * 0.26 +
    numeric(model.quality_score) * 0.22 +
    numeric(model.adoption_score) * 0.17 +
    numeric(model.popularity_score) * 0.10 +
    numeric(model.economic_footprint_score) * 0.09 +
    rankSignal(model.overall_rank) * 0.08 +
    releaseFreshnessSignal(model.release_date, now) * 0.08
  );
}

export function selectHomepageTopModelIds<
  T extends HomepageTopModelCandidate
>(models: T[], limit: number, now = Date.now()): string[] {
  return [...models]
    .filter((model) => {
      return (
        model.economic_footprint_score != null ||
        model.adoption_score != null ||
        model.capability_score != null
      );
    })
    .sort((left, right) => {
      const scoreDelta =
        computeHomepageTopModelScore(right, now) - computeHomepageTopModelScore(left, now);
      if (scoreDelta !== 0) return scoreDelta;

      const rankDelta = rankSignal(right.overall_rank) - rankSignal(left.overall_rank);
      if (rankDelta !== 0) return rankDelta;

      return numeric(right.capability_score) - numeric(left.capability_score);
    })
    .slice(0, limit)
    .map((model) => model.id);
}
