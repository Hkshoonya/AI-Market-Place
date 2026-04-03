import { getNewsSignalType } from "@/lib/news/presentation";
import { getCanonicalProviderName, getProviderBrand } from "@/lib/constants/providers";
import { collapsePublicModelFamilies } from "@/lib/models/public-families";
import { limitProviderBurst } from "@/lib/homepage/deployments";

const RECENT_LAUNCH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const RECENT_MODEL_RELEASE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const SURFACEABLE_SOURCES = new Set(["provider-blog", "x-twitter"]);

export interface HomepageLaunchModel {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category?: string | null;
  is_open_weights?: boolean | null;
  overall_rank?: number | null;
  release_date?: string | null;
  created_at?: string | null;
  quality_score?: number | null;
  capability_score?: number | null;
  adoption_score?: number | null;
  economic_footprint_score?: number | null;
  popularity_score?: number | null;
  hf_downloads?: number | null;
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

function canCollapseLaunchFamilies<TModel extends HomepageLaunchModel>(models: TModel[]) {
  return models.every(
    (model) =>
      typeof model.slug === "string" &&
      model.slug.length > 0 &&
      typeof model.name === "string" &&
      model.name.length > 0 &&
      typeof model.provider === "string" &&
      model.provider.length > 0
  );
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

function getLaunchSurfacePenalty<TModel extends HomepageLaunchModel>(model: TModel) {
  const category = String(model.category ?? "").toLowerCase();
  const slug = String(model.slug ?? "").toLowerCase();
  const name = String(model.name ?? "").toLowerCase();
  let penalty = 0;

  if (["speech_audio", "embeddings", "image_generation", "video_generation"].includes(category)) {
    penalty += 2_000;
  }

  if (/\b(?:transcribe|tts|speech|audio|ocr|embedding|embed)\b/.test(`${slug} ${name}`)) {
    penalty += 1_500;
  }

  return penalty;
}

function isSpecializedHomepageLaunch<TModel extends HomepageLaunchModel>(model: TModel) {
  const category = String(model.category ?? "").toLowerCase();
  const haystack = `${String(model.slug ?? "").toLowerCase()} ${String(model.name ?? "").toLowerCase()}`;

  if (["speech_audio", "embeddings", "image_generation", "video_generation"].includes(category)) {
    return true;
  }

  return /\b(?:transcribe|tts|speech|audio|ocr|embedding|embed)\b/.test(haystack);
}

function providersMatch(
  modelProvider: string | null | undefined,
  relatedProvider: string | null | undefined
) {
  if (!relatedProvider) return true;
  if (!modelProvider) return false;
  return getCanonicalProviderName(modelProvider) === getCanonicalProviderName(relatedProvider);
}

function compareLaunchSelections<TModel extends HomepageLaunchModel>(
  left: { score: number; model: TModel; surfacedAt: string | null },
  right: { score: number; model: TModel; surfacedAt: string | null }
) {
  const leftSpecialized = isSpecializedHomepageLaunch(left.model);
  const rightSpecialized = isSpecializedHomepageLaunch(right.model);
  if (leftSpecialized !== rightSpecialized) return Number(leftSpecialized) - Number(rightSpecialized);

  const leftPenalty = getLaunchSurfacePenalty(left.model);
  const rightPenalty = getLaunchSurfacePenalty(right.model);
  if (leftPenalty !== rightPenalty) return leftPenalty - rightPenalty;

  if (right.score !== left.score) return right.score - left.score;

  const launchDelta = getLaunchTimestamp(right.model) - getLaunchTimestamp(left.model);
  if (launchDelta !== 0) return launchDelta;

  return Number(right.model.quality_score ?? 0) - Number(left.model.quality_score ?? 0);
}

export function buildHomepageLaunchSelections<TModel extends HomepageLaunchModel>(
  models: TModel[],
  newsItems: HomepageLaunchNewsItem[],
  limit: number,
  now = Date.now()
): HomepageLaunchSelection<TModel>[] {
  if (limit <= 0) return [];
  const useFamilyCollapse = canCollapseLaunchFamilies(models);
  const fullModelFamilies = useFamilyCollapse ? collapsePublicModelFamilies(models) : [];
  const familyKeyById = new Map(
    fullModelFamilies.flatMap((family) =>
      family.variants.map((variant) => [variant.id, family.familyKey] as const)
    )
  );

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
    const signalScore = signalType === "launch" ? 2_000 : 0;

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

  const prioritized = useFamilyCollapse
    ? collapsePublicModelFamilies([...selectedById.values()].map((entry) => entry.model))
        .map((family) => {
          const bestSelection = family.variants
            .map((variant) => selectedById.get(variant.id) ?? null)
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
            .sort(compareLaunchSelections)[0];

          return bestSelection ?? null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort(compareLaunchSelections)
        .map((entry) => ({
          model: entry.model,
          surfacedAt: entry.surfacedAt,
        }))
    : [...selectedById.values()]
        .sort(compareLaunchSelections)
        .map((entry) => ({
          model: entry.model,
          surfacedAt: entry.surfacedAt,
        }));

  if (prioritized.length >= limit) {
    return limitProviderBurst(
      prioritized.map((entry) => ({
        ...entry,
        provider: entry.model.provider,
      })),
      limit
    ).map(({ provider: _provider, ...entry }) => entry);
  }

  const usedIds = new Set(prioritized.map((entry) => entry.model.id));
  const usedFamilyKeys = useFamilyCollapse
    ? new Set(
        prioritized
          .map((entry) => familyKeyById.get(entry.model.id) ?? null)
          .filter((familyKey): familyKey is string => Boolean(familyKey))
      )
    : new Set<string>();
  const fallbackCandidates = [...models]
    .filter((model) => !usedIds.has(model.id))
    .filter((model) => !usedFamilyKeys.has(familyKeyById.get(model.id) ?? ""))
    .filter((model) => isSurfaceableRecentModel(model, now))
    .filter((model) => Boolean(model.release_date) || hasMeaningfulModelSignals(model));

  const fallback = (useFamilyCollapse
    ? collapsePublicModelFamilies(fallbackCandidates)
        .map((family) => family.representative)
    : fallbackCandidates)
    .sort((left, right) => {
      const leftSpecialized = isSpecializedHomepageLaunch(left);
      const rightSpecialized = isSpecializedHomepageLaunch(right);
      if (leftSpecialized !== rightSpecialized) return Number(leftSpecialized) - Number(rightSpecialized);

      const leftPenalty = getLaunchSurfacePenalty(left);
      const rightPenalty = getLaunchSurfacePenalty(right);
      if (leftPenalty !== rightPenalty) return leftPenalty - rightPenalty;

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

  return limitProviderBurst(
    [...prioritized, ...fallback].map((entry) => ({
      ...entry,
      provider: entry.model.provider,
    })),
    limit
  ).map(({ provider: _provider, ...entry }) => entry);
}
