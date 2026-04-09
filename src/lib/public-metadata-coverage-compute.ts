import type { TypedSupabaseClient } from "@/types/database";
import { getPublicSurfaceSeriesKey } from "@/lib/models/public-families";
import { hasPublicRankingInputs } from "@/lib/models/public-ranking-inputs";
import {
  getDefaultPublicSurfaceReadinessBlockers,
  hasCompletePublicMetadata,
  hasDiscoveryMetadata,
  hasOpenWeightLicense,
  isDefaultPublicSurfaceReady,
  needsContextWindowForCoverage,
  type PublicSurfaceReadinessBlocker,
  isReleaseDateWrapperModel,
} from "@/lib/models/public-surface-readiness";
import {
  getPublicSourceTrustTier,
  isLowTrustPublicSourceTier,
  type PublicSourceTrustTier,
} from "@/lib/models/public-source-trust";

const PAGE_SIZE = 1000;

type ActiveModelPublicMetadataRow = {
  slug: string;
  provider: string;
  hf_model_id?: string | null;
  website_url?: string | null;
  name: string;
  category: string | null;
  release_date: string | null;
  is_open_weights: boolean | null;
  license: string | null;
  license_name: string | null;
  context_window: number | null;
  overall_rank?: number | null;
  quality_score?: number | null;
  capability_score?: number | null;
  adoption_score?: number | null;
  popularity_score?: number | null;
  economic_footprint_score?: number | null;
  hf_downloads?: number | null;
  hf_likes?: number | null;
  hf_trending_score?: number | null;
};

type CoverageFamilyAggregate = {
  category: string | null;
  release_date: string | null;
  is_open_weights: boolean | null;
  license: string | null;
  license_name: string | null;
  context_window: number | null;
};

type NotReadyRow = {
  slug: string;
  provider: string;
  category: string | null;
  release_date: string | null;
  reasons: PublicSurfaceReadinessBlocker[];
};

type RankingContaminationRow = {
  slug: string;
  provider: string;
  category: string | null;
  release_date: string | null;
  reasons: PublicSurfaceReadinessBlocker[];
};

type TrustTierRow = {
  slug: string;
  provider: string;
  category: string | null;
  release_date: string | null;
  trust_tier: PublicSourceTrustTier;
};

type TrustTierCounts = Record<PublicSourceTrustTier, number>;

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>
) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const page = await fetchPage(from, to);
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function buildCoverageFamilyMap(models: ActiveModelPublicMetadataRow[]) {
  const families = new Map<string, CoverageFamilyAggregate>();

  for (const model of models) {
    const familyKey = `${model.provider}::${getPublicSurfaceSeriesKey(model)}`;
    const existing = families.get(familyKey);
    if (!existing) {
      families.set(familyKey, {
        category: model.category,
        release_date: model.release_date,
        is_open_weights: model.is_open_weights,
        license: model.license,
        license_name: model.license_name,
        context_window: model.context_window,
      });
      continue;
    }

    existing.category = existing.category ?? model.category;
    existing.release_date = existing.release_date ?? model.release_date;
    existing.is_open_weights =
      existing.is_open_weights ?? model.is_open_weights ?? null;
    existing.license = existing.license ?? model.license;
    existing.license_name = existing.license_name ?? model.license_name;
    existing.context_window =
      existing.context_window ?? model.context_window ?? null;
  }

  return families;
}

function applyFamilyCoverageFallback(
  model: ActiveModelPublicMetadataRow,
  families: Map<string, CoverageFamilyAggregate>
): ActiveModelPublicMetadataRow {
  const family = families.get(
    `${model.provider}::${getPublicSurfaceSeriesKey(model)}`
  );

  if (!family) return model;

  return {
    ...model,
    category: model.category ?? family.category,
    release_date: model.release_date ?? family.release_date,
    is_open_weights: model.is_open_weights ?? family.is_open_weights,
    license: model.license ?? family.license,
    license_name: model.license_name ?? family.license_name,
    context_window: model.context_window ?? family.context_window,
  };
}

function computeBlockerCounts(models: ActiveModelPublicMetadataRow[]) {
  const counts = new Map<PublicSurfaceReadinessBlocker, number>();

  for (const model of models) {
    for (const blocker of getDefaultPublicSurfaceReadinessBlockers(model)) {
      counts.set(blocker, (counts.get(blocker) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function buildRecentNotReadyRows(models: ActiveModelPublicMetadataRow[]): NotReadyRow[] {
  return models
    .map((model) => ({
      slug: model.slug,
      provider: model.provider,
      category: model.category,
      release_date: model.release_date,
      reasons: getDefaultPublicSurfaceReadinessBlockers(model),
    }))
    .filter((model) => model.reasons.length > 0)
    .sort(
      (left, right) =>
        Date.parse(right.release_date ?? "0") - Date.parse(left.release_date ?? "0")
    )
    .slice(0, 10);
}

function buildRecentRankingContaminationRows(
  models: ActiveModelPublicMetadataRow[]
): RankingContaminationRow[] {
  return models
    .map((model) => ({
      slug: model.slug,
      provider: model.provider,
      category: model.category,
      release_date: model.release_date,
      reasons: getDefaultPublicSurfaceReadinessBlockers(model),
    }))
    .filter((model) => model.reasons.length > 0)
    .sort(
      (left, right) =>
        Date.parse(right.release_date ?? "0") - Date.parse(left.release_date ?? "0")
    )
    .slice(0, 10);
}

function buildTrustTierCounts(
  models: ActiveModelPublicMetadataRow[]
): TrustTierCounts {
  const counts: TrustTierCounts = {
    official: 0,
    trusted_catalog: 0,
    community: 0,
    wrapper: 0,
  };

  for (const model of models) {
    counts[getPublicSourceTrustTier(model)] += 1;
  }

  return counts;
}

function buildRecentLowTrustRows(models: ActiveModelPublicMetadataRow[]): TrustTierRow[] {
  return models
    .map((model) => ({
      slug: model.slug,
      provider: model.provider,
      category: model.category,
      release_date: model.release_date,
      trust_tier: getPublicSourceTrustTier(model),
    }))
    .filter((model) => isLowTrustPublicSourceTier(model.trust_tier))
    .sort(
      (left, right) =>
        Date.parse(right.release_date ?? "0") - Date.parse(left.release_date ?? "0")
    )
    .slice(0, 10);
}

export async function computePublicMetadataCoverage(
  supabase: TypedSupabaseClient
) {
  const models = await fetchAllRows<ActiveModelPublicMetadataRow>(
    async (from, to) => {
        const { data, error } = await supabase
        .from("models")
        .select(
          "slug, provider, hf_model_id, website_url, name, category, release_date, is_open_weights, license, license_name, context_window, overall_rank, quality_score, capability_score, adoption_score, popularity_score, economic_footprint_score, hf_downloads, hf_likes, hf_trending_score"
        )
        .eq("status", "active")
        .range(from, to);

      if (error) {
        throw new Error(
          `Failed to fetch models for public metadata coverage: ${error.message}`
        );
      }

      return (data ?? []) as ActiveModelPublicMetadataRow[];
    }
  );

  const familyCoverage = buildCoverageFamilyMap(models);
  const effectiveModels = models.map((model) =>
    applyFamilyCoverageFallback(model, familyCoverage)
  );

  const missingCategory = effectiveModels.filter((model) => !model.category);
  const missingReleaseDate = effectiveModels.filter(
    (model) => !isReleaseDateWrapperModel(model) && !model.release_date
  );
  const releaseDateExemptAliasCount = effectiveModels.filter(
    isReleaseDateWrapperModel
  ).length;
  const openWeightsMissingLicense = effectiveModels.filter(
    (model) => Boolean(model.is_open_weights) && !hasOpenWeightLicense(model)
  );
  const llmMissingContextWindow = effectiveModels.filter(
    (model) => needsContextWindowForCoverage(model) && !model.context_window
  );
  const officialModels = effectiveModels.filter((model) =>
    getPublicSourceTrustTier(model) === "official"
  );
  const officialMissingCategory = officialModels.filter((model) => !model.category);
  const officialMissingReleaseDate = officialModels.filter(
    (model) => !isReleaseDateWrapperModel(model) && !model.release_date
  );
  const officialReleaseDateExemptAliasCount = officialModels.filter(
    isReleaseDateWrapperModel
  ).length;
  const officialOpenWeightsMissingLicense = officialModels.filter(
    (model) => Boolean(model.is_open_weights) && !hasOpenWeightLicense(model)
  );
  const officialLlmMissingContextWindow = officialModels.filter(
    (model) => needsContextWindowForCoverage(model) && !model.context_window
  );
  const rankingContaminationModels = effectiveModels.filter(
    (model) =>
      !isDefaultPublicSurfaceReady(model) && hasPublicRankingInputs(model)
  );
  const officialRankingContaminationModels = officialModels.filter(
    (model) =>
      !isDefaultPublicSurfaceReady(model) && hasPublicRankingInputs(model)
  );
  const trustTierCounts = buildTrustTierCounts(effectiveModels);
  const lowTrustActiveModels = effectiveModels.filter((model) =>
    isLowTrustPublicSourceTier(getPublicSourceTrustTier(model))
  );
  const lowTrustReadyModels = effectiveModels.filter(
    (model) =>
      isLowTrustPublicSourceTier(getPublicSourceTrustTier(model)) &&
      isDefaultPublicSurfaceReady(model)
  );
  const completeDiscoveryMetadataCount = models.filter(
    (_, index) => hasDiscoveryMetadata(effectiveModels[index]!)
  ).length;
  const defaultPublicSurfaceReadyCount = effectiveModels.filter(
    isDefaultPublicSurfaceReady
  ).length;
  const officialCompleteDiscoveryMetadataCount = officialModels.filter(
    hasDiscoveryMetadata
  ).length;
  const officialDefaultPublicSurfaceReadyCount = officialModels.filter(
    isDefaultPublicSurfaceReady
  ).length;
  const completeDiscoveryMetadataPct =
    models.length > 0
      ? Number(
          ((completeDiscoveryMetadataCount / models.length) * 100).toFixed(1)
        )
      : 100;
  const defaultPublicSurfaceReadyPct =
    models.length > 0
      ? Number(
          ((defaultPublicSurfaceReadyCount / models.length) * 100).toFixed(1)
        )
      : 100;
  const officialCompleteDiscoveryMetadataPct =
    officialModels.length > 0
      ? Number(
          (
            (officialCompleteDiscoveryMetadataCount / officialModels.length) *
            100
          ).toFixed(1)
        )
      : 100;
  const officialDefaultPublicSurfaceReadyPct =
    officialModels.length > 0
      ? Number(
          (
            (officialDefaultPublicSurfaceReadyCount / officialModels.length) *
            100
          ).toFixed(1)
        )
      : 100;
  const topReadinessBlockers = computeBlockerCounts(effectiveModels);
  const officialTopReadinessBlockers = computeBlockerCounts(officialModels);

  const recentIncompleteModels = effectiveModels
    .filter(
      (model) =>
        !hasDiscoveryMetadata(model) ||
        (Boolean(model.is_open_weights) && !hasOpenWeightLicense(model)) ||
          (needsContextWindowForCoverage(model) && !model.context_window)
    )
    .sort(
      (left, right) =>
        Date.parse(right.release_date ?? "0") - Date.parse(left.release_date ?? "0")
    )
    .slice(0, 10)
    .map((model) => ({
      slug: model.slug,
      provider: model.provider,
        category: model.category,
        release_date: model.release_date,
    }));
  const recentNotReadyModels = buildRecentNotReadyRows(effectiveModels);
  const recentRankingContaminationModels = buildRecentRankingContaminationRows(
    rankingContaminationModels
  );
  const recentLowTrustModels = buildRecentLowTrustRows(effectiveModels);

  const providerStats = new Map<
    string,
    {
      total: number;
      complete: number;
      ready: number;
      missingCategory: number;
      missingReleaseDate: number;
      releaseDateExemptAliases: number;
    }
  >();

  for (const model of effectiveModels) {
    const provider = model.provider ?? "Unknown";
    const stats = providerStats.get(provider) ?? {
      total: 0,
      complete: 0,
      ready: 0,
      missingCategory: 0,
      missingReleaseDate: 0,
      releaseDateExemptAliases: 0,
    };

    stats.total += 1;
    if (hasCompletePublicMetadata(model)) stats.complete += 1;
    if (isDefaultPublicSurfaceReady(model)) stats.ready += 1;
    if (!model.category) stats.missingCategory += 1;
    if (isReleaseDateWrapperModel(model)) {
      stats.releaseDateExemptAliases += 1;
    } else if (!model.release_date) {
      stats.missingReleaseDate += 1;
    }

    providerStats.set(provider, stats);
  }

  return {
    activeModels: models.length,
    completeDiscoveryMetadataCount,
    completeDiscoveryMetadataPct,
    defaultPublicSurfaceReadyCount,
    defaultPublicSurfaceReadyPct,
    topReadinessBlockers,
    missingCategoryCount: missingCategory.length,
    missingReleaseDateCount: missingReleaseDate.length,
    releaseDateExemptAliasCount,
    openWeightsMissingLicenseCount: openWeightsMissingLicense.length,
    llmMissingContextWindowCount: llmMissingContextWindow.length,
    rankingContaminationCount: rankingContaminationModels.length,
    trustTierCounts,
    lowTrustActiveCount: lowTrustActiveModels.length,
    lowTrustReadyCount: lowTrustReadyModels.length,
    official: {
      activeModels: officialModels.length,
      completeDiscoveryMetadataCount: officialCompleteDiscoveryMetadataCount,
      completeDiscoveryMetadataPct: officialCompleteDiscoveryMetadataPct,
      defaultPublicSurfaceReadyCount: officialDefaultPublicSurfaceReadyCount,
      defaultPublicSurfaceReadyPct: officialDefaultPublicSurfaceReadyPct,
      topReadinessBlockers: officialTopReadinessBlockers,
      missingCategoryCount: officialMissingCategory.length,
      missingReleaseDateCount: officialMissingReleaseDate.length,
      releaseDateExemptAliasCount: officialReleaseDateExemptAliasCount,
      openWeightsMissingLicenseCount: officialOpenWeightsMissingLicense.length,
      llmMissingContextWindowCount: officialLlmMissingContextWindow.length,
      rankingContaminationCount: officialRankingContaminationModels.length,
      providers: [...providerStats.entries()]
        .filter(
          ([provider]) => getPublicSourceTrustTier({ provider }) === "official"
        )
        .map(([provider, stats]) => ({
          provider,
          total: stats.total,
          complete: stats.complete,
          ready: stats.ready,
          complete_pct: Number(
            ((stats.complete / Math.max(stats.total, 1)) * 100).toFixed(1)
          ),
          ready_pct: Number(
            ((stats.ready / Math.max(stats.total, 1)) * 100).toFixed(1)
          ),
          missingCategoryCount: stats.missingCategory,
          missingReleaseDateCount: stats.missingReleaseDate,
          releaseDateExemptAliasCount: stats.releaseDateExemptAliases,
        }))
        .sort(
          (left, right) =>
            left.ready_pct - right.ready_pct ||
            left.complete_pct - right.complete_pct ||
            right.total - left.total
        ),
      recentIncompleteModels: officialModels
        .filter(
          (model) =>
            !hasDiscoveryMetadata(model) ||
            (Boolean(model.is_open_weights) && !hasOpenWeightLicense(model)) ||
            (needsContextWindowForCoverage(model) && !model.context_window)
        )
        .sort(
          (left, right) =>
            Date.parse(right.release_date ?? "0") -
            Date.parse(left.release_date ?? "0")
        )
        .slice(0, 10)
        .map((model) => ({
          slug: model.slug,
          provider: model.provider,
          category: model.category,
          release_date: model.release_date,
        })),
      recentNotReadyModels: buildRecentNotReadyRows(officialModels),
      recentRankingContaminationModels:
        buildRecentRankingContaminationRows(officialRankingContaminationModels),
    },
    providers: [...providerStats.entries()]
      .map(([provider, stats]) => ({
        provider,
        total: stats.total,
        complete: stats.complete,
        ready: stats.ready,
        complete_pct: Number(
          ((stats.complete / Math.max(stats.total, 1)) * 100).toFixed(1)
        ),
        ready_pct: Number(
          ((stats.ready / Math.max(stats.total, 1)) * 100).toFixed(1)
        ),
        missingCategoryCount: stats.missingCategory,
        missingReleaseDateCount: stats.missingReleaseDate,
        releaseDateExemptAliasCount: stats.releaseDateExemptAliases,
      }))
      .sort(
        (left, right) =>
          left.ready_pct - right.ready_pct ||
          left.complete_pct - right.complete_pct ||
          right.total - left.total
      ),
    recentIncompleteModels,
    recentNotReadyModels,
    recentRankingContaminationModels,
    recentLowTrustModels,
  };
}
