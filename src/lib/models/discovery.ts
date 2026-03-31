import { getProviderBrand } from "@/lib/constants/providers";

interface DiscoverySignals {
  popularity_score?: number | null;
  adoption_score?: number | null;
  economic_footprint_score?: number | null;
  quality_score?: number | null;
  capability_score?: number | null;
  hf_downloads?: number | null;
  hf_likes?: number | null;
  hf_trending_score?: number | null;
  release_date?: string | null;
  created_at?: string | null;
  provider?: string | null;
  recent_signal_score?: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function computeCommunitySignal(model: DiscoverySignals): number {
  const downloads = Math.log10((model.hf_downloads ?? 0) + 1) * 12;
  const likes = Math.log10((model.hf_likes ?? 0) + 1) * 18;
  const trending = clamp(model.hf_trending_score ?? 0, 0, 500) / 5;
  return clamp(downloads + likes + trending, 0, 100);
}

function computeRecencyBoost(releaseDate: string | null | undefined, now = new Date()): number {
  if (!releaseDate) return 0;
  const release = Date.parse(releaseDate);
  if (!Number.isFinite(release)) return 0;
  const ageDays = (now.getTime() - release) / (1000 * 60 * 60 * 24);
  return clamp(100 - ageDays * 1.2, 0, 100);
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getDiscoveryReleaseTimestamp<
  T extends { release_date?: string | null; created_at?: string | null; provider?: string | null }
>(model: T): number {
  const releaseTimestamp = toTimestamp(model.release_date);
  if (releaseTimestamp > 0) return releaseTimestamp;

  if (!getProviderBrand(model.provider ?? "")) return 0;
  return toTimestamp(model.created_at);
}

export function computeTrendingDiscoveryScore(model: DiscoverySignals, now = new Date()): number {
  const community = computeCommunitySignal(model);
  const recency = computeRecencyBoost(model.release_date, now);

  return Math.round(
    clamp(
      (model.popularity_score ?? 0) * 0.28 +
        (model.adoption_score ?? 0) * 0.2 +
        (model.economic_footprint_score ?? 0) * 0.16 +
        (model.quality_score ?? 0) * 0.12 +
        community * 0.09 +
        recency * 0.15,
      0,
      100
    ) * 10
  ) / 10;
}

export function computePopularDiscoveryScore(model: DiscoverySignals): number {
  const community = computeCommunitySignal(model);

  return Math.round(
    clamp(
      (model.popularity_score ?? 0) * 0.45 +
        (model.adoption_score ?? 0) * 0.25 +
        (model.economic_footprint_score ?? 0) * 0.2 +
        community * 0.1,
      0,
      100
    ) * 10
  ) / 10;
}

export function isHighSignalRecentCandidate(model: DiscoverySignals): boolean {
  const hasOfficialReleaseDate = Boolean(model.release_date);
  const hasRecentSignal = Number(model.recent_signal_score ?? 0) > 0;
  const hasMeaningfulScores =
    Number(model.quality_score ?? 0) > 0 || Number(model.capability_score ?? 0) > 0;

  return hasOfficialReleaseDate || hasRecentSignal || hasMeaningfulScores;
}

export function computeRecentReleaseDiscoveryScore(
  model: DiscoverySignals,
  now = new Date()
): number {
  const recentTimestamp = getDiscoveryReleaseTimestamp(model);
  const recency = recentTimestamp
    ? computeRecencyBoost(new Date(recentTimestamp).toISOString(), now)
    : 0;
  const providerBonus = getProviderBrand(model.provider ?? "") ? 18 : 0;
  const signalBonus = clamp(Number(model.recent_signal_score ?? 0) * 12, 0, 36);
  const capability = clamp(Number(model.capability_score ?? 0), 0, 100) * 0.18;
  const quality = clamp(Number(model.quality_score ?? 0), 0, 100) * 0.16;
  const adoption = clamp(Number(model.adoption_score ?? 0), 0, 100) * 0.12;
  const penalty = !model.release_date && !Number(model.recent_signal_score ?? 0) ? 20 : 0;

  return recency + providerBonus + signalBonus + capability + quality + adoption - penalty;
}

export function sortByReleaseDate<T extends { release_date?: string | null; quality_score?: number | null }>(
  models: T[]
): T[] {
  return [...models].sort((left, right) => {
    const releaseDelta =
      getDiscoveryReleaseTimestamp(right as T & DiscoverySignals) -
      getDiscoveryReleaseTimestamp(left as T & DiscoverySignals);

    if (releaseDelta !== 0) return releaseDelta;
    return Number(right.quality_score ?? 0) - Number(left.quality_score ?? 0);
  });
}

export function sortRecentReleaseCandidates<
  T extends {
    release_date?: string | null;
    created_at?: string | null;
    quality_score?: number | null;
    capability_score?: number | null;
    adoption_score?: number | null;
    economic_footprint_score?: number | null;
    provider?: string | null;
    recent_signal_score?: number | null;
  }
>(models: T[]): T[] {
  return [...models].sort((left, right) => {
    const scoreDelta =
      computeRecentReleaseDiscoveryScore(right) - computeRecentReleaseDiscoveryScore(left);
    if (scoreDelta !== 0) return scoreDelta;

    const releaseDelta = getDiscoveryReleaseTimestamp(right) - getDiscoveryReleaseTimestamp(left);
    if (releaseDelta !== 0) return releaseDelta;

    return Number(right.quality_score ?? 0) - Number(left.quality_score ?? 0);
  });
}

export function sortByDiscoveryScore<T>(
  models: T[],
  scorer: (model: T) => number
): T[] {
  return [...models].sort((left, right) => scorer(right) - scorer(left));
}
