import {
  getCanonicalProviderName,
  getProviderBrand,
} from "@/lib/constants/providers";
import {
  collapsePublicModelFamilies,
  getPublicSurfaceSeriesKey,
} from "@/lib/models/public-families";
import {
  getNewsSignalImportance,
  getNewsSignalType,
  type LaunchRadarItem,
  type NewsPresentationItem,
} from "@/lib/news/presentation";

const RECENT_DEPLOYMENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const SURFACEABLE_DEPLOYMENT_SOURCES = new Set([
  "provider-deployment-signals",
  "ollama-library",
]);

export interface DeploymentSignalSummary {
  title: string;
  summary?: string | null;
  signalType: "api" | "open_source";
  signalLabel: string;
  signalImportance: "high" | "medium" | "low";
  publishedAt: string | null;
  source: string | null;
  relatedProvider: string | null;
}

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

export function isHighSignalDeploymentCandidate<TModel extends HomepageDeploymentModel>(
  model: TModel
) {
  if (getProviderBrand(model.provider ?? "")) return true;

  return (
    Number(model.quality_score ?? 0) >= 50 ||
    Number(model.capability_score ?? 0) >= 50 ||
    Number(model.popularity_score ?? 0) >= 50 ||
    Number(model.adoption_score ?? 0) >= 45
  );
}

export function normalizeDeploymentSignalSummary<
  TModel extends HomepageDeploymentModel,
  TSignal extends DeploymentSignalSummary | LaunchRadarItem,
>(
  model: TModel,
  signal: TSignal
): TSignal {
  const rawTitle = signal.title ?? "";

  if (signal.source === "ollama-library") {
    return {
      ...signal,
      title:
        signal.signalType === "open_source"
          ? `${model.name} now has a verified self-host path`
          : `${model.name} can now run on a cloud server you control`,
      summary:
        signal.summary ??
        "A verified path is available to run this model outside a provider plan.",
    } as TSignal;
  }

  if (
    signal.source === "provider-deployment-signals" ||
    /deployment guide/i.test(rawTitle) ||
    /coding plan/i.test(rawTitle)
  ) {
    return {
      ...signal,
      title:
        signal.signalType === "open_source"
          ? `${model.name} now has an official self-host path`
          : `${model.name} now has an official setup path`,
      summary:
        signal.summary ??
        "The provider now documents a clearer way to start using this model.",
    } as TSignal;
  }

  return signal;
}

export interface HomepageDeploymentSelection<TModel extends HomepageDeploymentModel> {
  model: TModel;
  surfacedAt: string | null;
  title: string;
  summary: string | null;
  source: string | null;
  signalType: "api" | "open_source";
}

function getSignalPublishedAt(
  item: DeploymentSignalSummary | LaunchRadarItem
) {
  return "publishedAt" in item ? item.publishedAt : item.published_at;
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

export function getDeploymentSignalSourcePriority(source: string | null | undefined) {
  if (source === "provider-deployment-signals") return 2;
  if (source === "ollama-library") return 1;
  return 0;
}

function getSourceBonus(source: string | null | undefined) {
  if (source === "provider-deployment-signals") return 700;
  if (source === "ollama-library") return 500;
  return 0;
}

export function getDeploymentSignalTypePriority(signalType: "api" | "open_source") {
  return signalType === "open_source" ? 2 : 1;
}

function getSignalBonus(signalType: "api" | "open_source") {
  return signalType === "open_source" ? 1_200 : 900;
}

export function isSurfaceableDeploymentSignal(item: NewsPresentationItem) {
  const source = item.source ?? null;
  if (!SURFACEABLE_DEPLOYMENT_SOURCES.has(source ?? "")) return false;

  const signalType = getNewsSignalType(item);
  return signalType === "api" || signalType === "open_source";
}

function normalizeDeploymentCopy<TModel extends HomepageDeploymentModel>(
  model: TModel,
  item: NewsPresentationItem,
  signalType: "api" | "open_source"
) {
  if (item.source === "ollama-library") {
    return {
      title:
        signalType === "open_source"
          ? `${model.name} can now run outside a provider plan`
          : `${model.name} can now run on a cloud server you control`,
      summary:
        "A new verified path is available to run this model yourself instead of depending only on a provider subscription.",
    };
  }

  const rawTitle = item.title?.trim() ?? "";
  if (
    item.source === "provider-deployment-signals" ||
    /deployment guide/i.test(rawTitle) ||
    /coding plan/i.test(rawTitle)
  ) {
    return {
      title:
        signalType === "open_source"
          ? `${model.name} now has an official self-host path`
          : `${model.name} now has an official setup path`,
      summary:
        item.summary?.trim() ??
        "The provider now documents a clearer way to start using this model.",
    };
  }

  return {
    title: item.title ?? "New way to use this model",
    summary: item.summary ?? null,
  };
}

export function compareDeploymentSignalSummaries(
  left: DeploymentSignalSummary | LaunchRadarItem,
  right: DeploymentSignalSummary | LaunchRadarItem
) {
  const publishedDelta =
    toTimestamp(getSignalPublishedAt(right)) - toTimestamp(getSignalPublishedAt(left));
  if (publishedDelta !== 0) return publishedDelta;

  const sourceDelta =
    getDeploymentSignalSourcePriority(right.source) -
    getDeploymentSignalSourcePriority(left.source);
  if (sourceDelta !== 0) return sourceDelta;

  const typeDelta =
    getDeploymentSignalTypePriority(right.signalType as "api" | "open_source") -
    getDeploymentSignalTypePriority(left.signalType as "api" | "open_source");
  if (typeDelta !== 0) return typeDelta;

  const importanceWeight = { high: 3, medium: 2, low: 1 } as const;
  return importanceWeight[right.signalImportance] - importanceWeight[left.signalImportance];
}

export function buildDirectDeploymentSignals(
  items: NewsPresentationItem[]
) {
  const selected = new Map<string, DeploymentSignalSummary>();

  for (const item of items) {
    if (!isSurfaceableDeploymentSignal(item)) continue;

    const signalType = getNewsSignalType(item) as "api" | "open_source";
    const summary: DeploymentSignalSummary = {
      title: item.title ?? "Recent usage update",
      signalType,
      signalLabel: signalType === "open_source" ? "Open Source" : "API",
      signalImportance: getNewsSignalImportance(item),
      publishedAt: item.published_at ?? null,
      source: item.source ?? null,
      relatedProvider: item.related_provider ?? null,
    };

    for (const modelId of item.related_model_ids ?? []) {
      const existing = selected.get(modelId);
      if (!existing || compareDeploymentSignalSummaries(existing, summary) > 0) {
        selected.set(modelId, summary);
      }
    }
  }

  return selected;
}

function compareDeploymentSelections<TModel extends HomepageDeploymentModel>(
  left: { score: number; selection: HomepageDeploymentSelection<TModel> },
  right: { score: number; selection: HomepageDeploymentSelection<TModel> }
) {
  const rightTrustedProvider = getProviderBrand(right.selection.model.provider ?? "") ? 1 : 0;
  const leftTrustedProvider = getProviderBrand(left.selection.model.provider ?? "") ? 1 : 0;
  if (rightTrustedProvider !== leftTrustedProvider) {
    return rightTrustedProvider - leftTrustedProvider;
  }

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
  const selectedById = new Map<string, { score: number; selection: HomepageDeploymentSelection<TModel> }>();

  for (const item of newsItems) {
    if (!isSurfaceableDeploymentSignal(item)) continue;

    const signalType = getNewsSignalType(item) as "api" | "open_source";
    const publishedAt = item.published_at ?? null;
    const publishedTimestamp = toTimestamp(publishedAt);
    if (publishedTimestamp <= 0 || now - publishedTimestamp > RECENT_DEPLOYMENT_WINDOW_MS) {
      continue;
    }

    for (const modelId of item.related_model_ids ?? []) {
      const model = modelsById.get(modelId);
      if (!model) continue;
      if (!providersMatch(model.provider, item.related_provider)) continue;
      if (!isHighSignalDeploymentCandidate(model)) continue;

      const score =
        publishedTimestamp +
        getSourceBonus(item.source) +
        getSignalBonus(signalType) +
        (getProviderBrand(model.provider ?? "") ? 2_000 : 0);
      const copy = normalizeDeploymentCopy(model, item, signalType);
      const selection: HomepageDeploymentSelection<TModel> = {
        model,
        surfacedAt: publishedAt,
        title: copy.title,
        summary: copy.summary,
        source: item.source ?? null,
        signalType,
      };
      const existing = selectedById.get(modelId);
      if (!existing || compareDeploymentSelections(existing, { score, selection }) > 0) {
        selectedById.set(modelId, { score, selection });
      }
    }
  }

  const collapsedEntries = collapsePublicModelFamilies(
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
    .sort(compareDeploymentSelections);

  const surfacedEntries: typeof collapsedEntries = [];
  const surfacedIndexBySeries = new Map<string, number>();

  for (const entry of collapsedEntries) {
    const seriesKey = getPublicSurfaceSeriesKey(entry.selection.model);
    const existingIndex = surfacedIndexBySeries.get(seriesKey);
    if (existingIndex == null) {
      surfacedIndexBySeries.set(seriesKey, surfacedEntries.length);
      surfacedEntries.push(entry);
      continue;
    }

    const existing = surfacedEntries[existingIndex];
    if (!existing) continue;

    const existingTrustedProvider = getProviderBrand(existing.selection.model.provider ?? "") ? 1 : 0;
    const nextTrustedProvider = getProviderBrand(entry.selection.model.provider ?? "") ? 1 : 0;

    if (
      nextTrustedProvider > existingTrustedProvider ||
      (nextTrustedProvider === existingTrustedProvider &&
        compareDeploymentSelections(existing, entry) > 0)
    ) {
      surfacedEntries[existingIndex] = entry;
    }
  }

  return surfacedEntries
    .sort(compareDeploymentSelections)
    .slice(0, limit)
    .map((entry) => entry.selection);
}
