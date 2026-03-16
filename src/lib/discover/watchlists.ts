interface WatchlistProfileLike {
  display_name?: string | null;
  username?: string | null;
}

interface WatchlistItemLike {
  id: string;
}

export interface DiscoverWatchlistLike {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
  watchlist_items?: WatchlistItemLike[] | null;
  profiles?: WatchlistProfileLike | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeFreshnessScore(updatedAt: string, now = new Date()) {
  const timestamp = parseTimestamp(updatedAt);
  if (!timestamp) return 0;

  const ageHours = Math.max(0, (now.getTime() - timestamp) / 3_600_000);

  if (ageHours <= 24) return 42;
  if (ageHours <= 72) return 30;
  if (ageHours <= 168) return 18;
  if (ageHours <= 720) return 6;
  return -8;
}

function computeCurationScore(watchlist: DiscoverWatchlistLike) {
  const itemCount = watchlist.watchlist_items?.length ?? 0;
  const descriptionLength = watchlist.description?.trim().length ?? 0;
  const hasNamedCurator = Boolean(
    watchlist.profiles?.display_name?.trim() || watchlist.profiles?.username?.trim()
  );

  let score = 0;
  score += clamp(itemCount, 0, 16) * 1.6;
  score += descriptionLength >= 140 ? 12 : descriptionLength >= 50 ? 7 : descriptionLength > 0 ? 3 : 0;
  score += hasNamedCurator ? 6 : 0;

  if (itemCount >= 8) score += 5;
  if (itemCount >= 16) score += 4;

  return score;
}

export function computeWatchlistDiscoveryScore(
  watchlist: DiscoverWatchlistLike,
  now = new Date()
) {
  const freshness = computeFreshnessScore(watchlist.updated_at, now);
  const curation = computeCurationScore(watchlist);
  const agePenalty = parseTimestamp(watchlist.created_at) ? 0 : 4;

  return Math.round((freshness + curation - agePenalty) * 10) / 10;
}

export function sortWatchlistsForDiscovery<T extends DiscoverWatchlistLike>(
  watchlists: T[],
  now = new Date()
) {
  return [...watchlists].sort((left, right) => {
    const scoreDifference =
      computeWatchlistDiscoveryScore(right, now) - computeWatchlistDiscoveryScore(left, now);
    if (scoreDifference !== 0) return scoreDifference;

    const updatedDifference = parseTimestamp(right.updated_at) - parseTimestamp(left.updated_at);
    if (updatedDifference !== 0) return updatedDifference;

    return (right.watchlist_items?.length ?? 0) - (left.watchlist_items?.length ?? 0);
  });
}
