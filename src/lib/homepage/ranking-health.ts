import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";

import {
  computeHomepageTopModelScore,
  hasLifecycleWarningLanguage,
  isEfficiencyTierModel,
  isPreviewLikeModel,
  isRecentLeadershipHomepageCandidate,
  releaseAgeDays,
  selectHomepageTopModelIds,
  type HomepageTopModelCandidate,
} from "./top-models";

export interface HomepageRankingHealthModel extends HomepageTopModelCandidate {
  id: string;
  slug: string;
  name: string;
  provider: string;
  status?: string | null;
  is_api_available?: boolean | null;
}

export interface HomepageRankingHealthSummaryRow {
  id: string;
  slug: string | null;
  name: string | null;
  provider: string | null;
  releaseDate: string | null;
  score: number;
}

export interface HomepageRankingHealth {
  healthy: boolean;
  shortlistCount: number;
  shortlist: HomepageRankingHealthSummaryRow[];
  missingRecentLeadership: HomepageRankingHealthSummaryRow[];
  lifecycleRowsInShortlist: HomepageRankingHealthSummaryRow[];
  previewRowsInShortlist: HomepageRankingHealthSummaryRow[];
  staleRowsInShortlist: HomepageRankingHealthSummaryRow[];
}

function summarizeRow(
  model: HomepageRankingHealthModel,
  now: number
): HomepageRankingHealthSummaryRow {
  return {
    id: model.id,
    slug: model.slug ?? null,
    name: model.name ?? null,
    provider: model.provider ?? null,
    releaseDate: model.release_date ?? null,
    score: Number(computeHomepageTopModelScore(model, now).toFixed(2)),
  };
}

export function computeHomepageRankingHealth(
  models: HomepageRankingHealthModel[],
  limit = 10,
  now = Date.now()
): HomepageRankingHealth {
  const activeModels = preferDefaultPublicSurfaceReady(
    dedupePublicModelFamilies(models),
    Math.min(limit, 5)
  );
  const shortlistIds = selectHomepageTopModelIds(activeModels, limit, now);
  const shortlist = shortlistIds
    .map((id) => activeModels.find((model) => model.id === id) ?? null)
    .filter((model): model is HomepageRankingHealthModel => Boolean(model));
  const shortlistIdSet = new Set(shortlist.map((model) => model.id));
  const lowestShortlistScore =
    shortlist.length > 0
      ? Math.min(...shortlist.map((model) => computeHomepageTopModelScore(model, now)))
      : 0;

  const missingRecentLeadership = activeModels
    .filter((model) => !shortlistIdSet.has(model.id))
    .filter((model) => isRecentLeadershipHomepageCandidate(model, now))
    .filter(
      (model) =>
        computeHomepageTopModelScore(model, now) >= lowestShortlistScore - 1
    )
    .sort(
      (left, right) =>
        computeHomepageTopModelScore(right, now) -
        computeHomepageTopModelScore(left, now)
    )
    .slice(0, 5)
    .map((model) => summarizeRow(model, now));

  const lifecycleRowsInShortlist = shortlist
    .filter((model) => hasLifecycleWarningLanguage(model))
    .map((model) => summarizeRow(model, now));
  const previewRowsInShortlist = shortlist
    .filter((model) => isPreviewLikeModel(model) || isEfficiencyTierModel(model))
    .map((model) => summarizeRow(model, now));
  const staleRowsInShortlist = shortlist
    .filter((model) => (releaseAgeDays(model.release_date, now) ?? 0) > 365)
    .map((model) => summarizeRow(model, now));

  return {
    healthy:
      missingRecentLeadership.length === 0 &&
      lifecycleRowsInShortlist.length === 0,
    shortlistCount: shortlist.length,
    shortlist: shortlist.map((model) => summarizeRow(model, now)),
    missingRecentLeadership,
    lifecycleRowsInShortlist,
    previewRowsInShortlist,
    staleRowsInShortlist,
  };
}
