import { dedupePublicModelFamilies, getPublicSurfaceSeriesKey } from "@/lib/models/public-families";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";
import { selectPublicRankingPool } from "@/lib/models/public-ranking-confidence";
import { rankModelsForSearch } from "@/lib/models/search-ranking";

interface SearchSurfaceModel {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category?: string | null;
  overall_rank?: number | null;
  quality_score?: number | null;
  capability_score?: number | null;
  adoption_score?: number | null;
  popularity_score?: number | null;
  economic_footprint_score?: number | null;
  release_date?: string | null;
  is_open_weights?: boolean | null;
  is_api_available?: boolean | null;
  status?: string | null;
  description?: string | null;
  short_description?: string | null;
}

function normalizeSearchInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function queryRequestsExplicitVariant(value: string) {
  return /\b(preview|beta|alpha|experimental)\b/.test(normalizeSearchInput(value));
}

export function collapseSearchSurfaceSeries<T extends SearchSurfaceModel>(
  models: T[],
  limit: number
) {
  const selected: T[] = [];
  const seenSeries = new Set<string>();

  for (const model of models) {
    const key = getPublicSurfaceSeriesKey(model);
    if (seenSeries.has(key)) continue;
    seenSeries.add(key);
    selected.push(model);
    if (selected.length >= limit) break;
  }

  return selected;
}

export function prepareSearchSurfaceModels<T extends SearchSurfaceModel>(
  models: T[],
  rawQuery: string,
  limit: number
) {
  const explicitVariantQuery = queryRequestsExplicitVariant(rawQuery);
  const searchCandidates = explicitVariantQuery
    ? models
    : dedupePublicModelFamilies(models);
  const rankedModels = rankModelsForSearch(searchCandidates, rawQuery);
  const confidenceRankedModels = explicitVariantQuery
    ? rankedModels
    : selectPublicRankingPool(rankedModels, Math.min(limit, 5));

  return collapseSearchSurfaceSeries(
    preferDefaultPublicSurfaceReady(confidenceRankedModels, Math.min(limit, 3)),
    limit
  );
}
