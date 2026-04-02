import { getCanonicalProviderName } from "@/lib/constants/providers";
import { collapsePublicModelFamilies } from "@/lib/models/public-families";
import { getNewsSignalType, type NewsPresentationItem } from "@/lib/news/presentation";

const RECENT_DEPLOYMENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const SURFACEABLE_DEPLOYMENT_SOURCES = new Set([
  "provider-deployment-signals",
  "ollama-library",
]);

export interface HomepageDeploymentModel {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category?: string | null;
  overall_rank?: number | null;
  quality_score?: number | null;
  capability_score?: number | null;
  popularity_score?: number | null;
  adoption_score?: number | null;
  economic_footprint_score?: number | null;
  hf_downloads?: number | null;
}

export interface HomepageDeploymentSelection<TModel extends HomepageDeploymentModel> {
  model: TModel;
  surfacedAt: string | null;
  title: string;
  summary: string | null;
  source: string | null;
  signalType: "api" | "open_source";
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function providersMatch(
  modelProvider: string | null | undefined,
  relatedProvider: string | null | undefined
) {
  if (!relatedProvider) return true;
  if (!modelProvider) return false;
  return getCanonicalProviderName(modelProvider) === getCanonicalProviderName(relatedProvider);
}

function getSourceBonus(source: string | null | undefined) {
  if (source === "ollama-library") return 700;
  if (source === "provider-deployment-signals") return 500;
  return 0;
}

function getSignalBonus(signalType: "api" | "open_source") {
  return signalType === "open_source" ? 1_200 : 900;
}

function compareDeploymentSelections<TModel extends HomepageDeploymentModel>(
  left: { score: number; selection: HomepageDeploymentSelection<TModel> },
  right: { score: number; selection: HomepageDeploymentSelection<TModel> }
) {
  if (right.score !== left.score) return right.score - left.score;

  const publishedDelta =
    toTimestamp(right.selection.surfacedAt) - toTimestamp(left.selection.surfacedAt);
  if (publishedDelta !== 0) return publishedDelta;

  const rightOpenSource = right.selection.signalType === "open_source" ? 1 : 0;
  const leftOpenSource = left.selection.signalType === "open_source" ? 1 : 0;
  if (rightOpenSource !== leftOpenSource) return rightOpenSource - leftOpenSource;

  return (
    Number(right.selection.model.quality_score ?? 0) -
    Number(left.selection.model.quality_score ?? 0)
  );
}

export function buildHomepageDeploymentSelections<TModel extends HomepageDeploymentModel>(
  models: TModel[],
  newsItems: NewsPresentationItem[],
  limit: number,
  now = Date.now()
): HomepageDeploymentSelection<TModel>[] {
  if (limit <= 0) return [];

  const modelsById = new Map(models.map((model) => [model.id, model]));
  const selectedById = new Map<
    string,
    { score: number; selection: HomepageDeploymentSelection<TModel> }
  >();

  for (const item of newsItems) {
    const source = item.source ?? null;
    if (!SURFACEABLE_DEPLOYMENT_SOURCES.has(source ?? "")) continue;

    const signalType = getNewsSignalType(item);
    if (signalType !== "api" && signalType !== "open_source") continue;

    const publishedAt = item.published_at ?? null;
    const publishedTimestamp = toTimestamp(publishedAt);
    if (publishedTimestamp <= 0 || now - publishedTimestamp > RECENT_DEPLOYMENT_WINDOW_MS) {
      continue;
    }

    for (const modelId of item.related_model_ids ?? []) {
      const model = modelsById.get(modelId);
      if (!model) continue;
      if (!providersMatch(model.provider, item.related_provider)) continue;

      const score =
        publishedTimestamp + getSourceBonus(source) + getSignalBonus(signalType);
      const selection: HomepageDeploymentSelection<TModel> = {
        model,
        surfacedAt: publishedAt,
        title: item.title ?? "New deployment path available",
        summary: item.summary ?? null,
        source,
        signalType,
      };
      const existing = selectedById.get(modelId);
      if (!existing || score > existing.score) {
        selectedById.set(modelId, { score, selection });
      }
    }
  }

  return collapsePublicModelFamilies(
    [...selectedById.values()].map((entry) => entry.selection.model)
  )
    .map((family) => {
      const bestSelection = family.variants
        .map((variant) => {
          const selection = selectedById.get(variant.id);
          return selection ?? null;
        })
        .filter((selection): selection is NonNullable<typeof selection> => Boolean(selection))
        .sort(compareDeploymentSelections)[0];

      return bestSelection ?? null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort(compareDeploymentSelections)
    .slice(0, limit)
    .map((entry) => entry.selection);
}
