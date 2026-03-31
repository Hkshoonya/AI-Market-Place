import { getNewsSignalType } from "@/lib/news/presentation";
import { getCanonicalProviderName, getProviderBrand } from "@/lib/constants/providers";

const RECENT_LAUNCH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const RECENT_MODEL_RELEASE_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;
const SURFACEABLE_SOURCES = new Set(["provider-blog", "x-twitter"]);

export interface HomepageLaunchModel {
  id: string;
  provider?: string | null;
  release_date?: string | null;
  created_at?: string | null;
  quality_score?: number | null;
  capability_score?: number | null;
  adoption_score?: number | null;
  economic_footprint_score?: number | null;
}

export interface HomepageLaunchNewsItem {
  source?: string | null;
  published_at?: string | null;
  related_provider?: string | null;
  related_model_ids?: string[] | null;
  metadata?: Record<string, unknown> | null;
  category?: string | null;
}

export interface HomepageLaunchSelection<TModel extends HomepageLaunchModel> {
  model: TModel;
  surfacedAt: string | null;
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isRecent(timestamp: number, now: number) {
  return timestamp > 0 && now - timestamp <= RECENT_LAUNCH_WINDOW_MS;
}

function getLaunchTimestamp<TModel extends HomepageLaunchModel>(model: TModel): number {
  const releaseTimestamp = toTimestamp(model.release_date);
  if (releaseTimestamp > 0) return releaseTimestamp;

  if (!getProviderBrand(model.provider ?? "")) return 0;
  return toTimestamp(model.created_at);
}

function isSurfaceableRecentModel<TModel extends HomepageLaunchModel>(model: TModel, now: number) {
  const timestamp = getLaunchTimestamp(model);
  return timestamp > 0 && now - timestamp <= RECENT_MODEL_RELEASE_WINDOW_MS;
}

function hasMeaningfulModelSignals<TModel extends HomepageLaunchModel>(model: TModel) {
  return Number(model.quality_score ?? 0) > 0 || Number(model.capability_score ?? 0) > 0;
}

function getSourceBonus(source: string | null | undefined) {
  if (source === "provider-blog") return 1_000;
  if (source === "x-twitter") return 500;
  return 0;
}

function providersMatch(
  modelProvider: string | null | undefined,
  relatedProvider: string | null | undefined
) {
  if (!relatedProvider) return true;
  if (!modelProvider) return false;
  return getCanonicalProviderName(modelProvider) === getCanonicalProviderName(relatedProvider);
}

export function buildHomepageLaunchSelections<TModel extends HomepageLaunchModel>(
  models: TModel[],
  newsItems: HomepageLaunchNewsItem[],
  limit: number,
  now = Date.now()
): HomepageLaunchSelection<TModel>[] {
  if (limit <= 0) return [];

  const modelsById = new Map(models.map((model) => [model.id, model]));
  const selectedById = new Map<
    string,
    { score: number; model: TModel; surfacedAt: string | null }
  >();

  for (const item of newsItems) {
    const source = item.source ?? null;
    if (!SURFACEABLE_SOURCES.has(source ?? "")) continue;

    const publishedAt = item.published_at ?? null;
    const publishedTimestamp = toTimestamp(publishedAt);
    if (!isRecent(publishedTimestamp, now)) continue;

    const signalType = getNewsSignalType(item);
    const signalScore =
      signalType === "launch" || signalType === "open_source" || signalType === "api"
        ? 2_000
        : 0;

    for (const modelId of item.related_model_ids ?? []) {
      const model = modelsById.get(modelId);
      if (!model) continue;
      if (!isSurfaceableRecentModel(model, now)) continue;
      if (!providersMatch(model.provider, item.related_provider)) continue;

      const score = publishedTimestamp + getSourceBonus(source) + signalScore;
      const existing = selectedById.get(modelId);
      if (!existing || score > existing.score) {
        selectedById.set(modelId, {
          score,
          model,
          surfacedAt: publishedAt,
        });
      }
    }
  }

  const prioritized = [...selectedById.values()]
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return getLaunchTimestamp(right.model) - getLaunchTimestamp(left.model);
    })
    .map((entry) => ({
      model: entry.model,
      surfacedAt: entry.surfacedAt,
    }));

  if (prioritized.length >= limit) {
    return prioritized.slice(0, limit);
  }

  const usedIds = new Set(prioritized.map((entry) => entry.model.id));
  const fallback = [...models]
    .filter((model) => !usedIds.has(model.id))
    .filter((model) => isSurfaceableRecentModel(model, now))
    .filter((model) => Boolean(model.release_date) || hasMeaningfulModelSignals(model))
    .sort((left, right) => getLaunchTimestamp(right) - getLaunchTimestamp(left))
    .sort((left, right) => {
      const leftKnown = getProviderBrand(left.provider ?? "") ? 1 : 0;
      const rightKnown = getProviderBrand(right.provider ?? "") ? 1 : 0;
      if (rightKnown !== leftKnown) return rightKnown - leftKnown;
      return getLaunchTimestamp(right) - getLaunchTimestamp(left);
    })
    .slice(0, limit - prioritized.length)
    .map((model) => ({
      model,
      surfacedAt: model.release_date ?? model.created_at ?? null,
    }));

  return [...prioritized, ...fallback];
}
