interface SearchableModel {
  slug: string;
  name: string;
  provider?: string | null;
  description?: string | null;
  short_description?: string | null;
  popularity_score?: number | null;
  overall_rank?: number | null;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

  return score + popularity + rankBoost;
}

export function rankModelsForSearch<T extends SearchableModel>(
  models: T[],
  rawQuery: string
): T[] {
  return [...models].sort((left, right) => {
    const relevanceDelta =
      getModelSearchRelevance(right, rawQuery) - getModelSearchRelevance(left, rawQuery);
    if (relevanceDelta !== 0) return relevanceDelta;

    const popularityDelta = Number(right.popularity_score ?? 0) - Number(left.popularity_score ?? 0);
    if (popularityDelta !== 0) return popularityDelta;

    const leftRank = left.overall_rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = right.overall_rank ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
}
