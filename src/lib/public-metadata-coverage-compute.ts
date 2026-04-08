import type { TypedSupabaseClient } from "@/types/database";
import { getPublicSurfaceSeriesKey } from "@/lib/models/public-families";

const PAGE_SIZE = 1000;
const OFFICIAL_PROVIDERS = new Set([
  "OpenAI",
  "Anthropic",
  "Google",
  "xAI",
  "Z.ai",
  "MiniMax",
  "Microsoft",
  "NVIDIA",
  "Meta",
  "Mistral AI",
  "Moonshot AI",
  "Qwen",
  "DeepSeek",
  "Black Forest Labs",
  "Cohere",
  "Amazon",
  "Alibaba",
  "Bytedance",
]);

type ActiveModelPublicMetadataRow = {
  slug: string;
  provider: string;
  name: string;
  category: string | null;
  release_date: string | null;
  is_open_weights: boolean | null;
  license: string | null;
  license_name: string | null;
  context_window: number | null;
};

type CoverageFamilyAggregate = {
  category: string | null;
  release_date: string | null;
  is_open_weights: boolean | null;
  license: string | null;
  license_name: string | null;
  context_window: number | null;
};

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

function needsContextWindow(model: ActiveModelPublicMetadataRow) {
  return model.category === "llm" || model.category === "multimodal";
}

function isPackagingVariantModel(model: ActiveModelPublicMetadataRow) {
  return /(?:^|-)(?:gguf|bf16|fp8|int4|int8|nvfp4|awq)(?:-|$)/i.test(
    model.slug
  );
}

function isReleaseDateWrapperModel(model: ActiveModelPublicMetadataRow) {
  return (
    /(?:^|-)latest$/i.test(model.slug) ||
    /(?:^|-)(?:preview|exp|experimental)(?:-|$)/i.test(model.slug) ||
    /(?:^|-)(?:generate|image|video)-\d{3}(?:$|-)/i.test(model.slug)
  );
}

function needsContextWindowForCoverage(model: ActiveModelPublicMetadataRow) {
  return needsContextWindow(model) && !isPackagingVariantModel(model);
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

function hasOpenWeightLicense(model: ActiveModelPublicMetadataRow) {
  return Boolean(model.license_name || model.license);
}

function hasDiscoveryMetadata(model: ActiveModelPublicMetadataRow) {
  return Boolean(
    model.name?.trim() &&
      model.category &&
      (model.release_date || isReleaseDateWrapperModel(model))
  );
}

function hasCompletePublicMetadata(model: ActiveModelPublicMetadataRow) {
  return (
    hasDiscoveryMetadata(model) &&
    (!Boolean(model.is_open_weights) || hasOpenWeightLicense(model)) &&
    (!needsContextWindowForCoverage(model) || Boolean(model.context_window))
  );
}

export async function computePublicMetadataCoverage(
  supabase: TypedSupabaseClient
) {
  const models = await fetchAllRows<ActiveModelPublicMetadataRow>(
    async (from, to) => {
      const { data, error } = await supabase
        .from("models")
        .select(
          "slug, provider, name, category, release_date, is_open_weights, license, license_name, context_window"
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
    OFFICIAL_PROVIDERS.has(model.provider ?? "")
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
  const completeDiscoveryMetadataCount = models.filter(
    (_, index) => hasDiscoveryMetadata(effectiveModels[index]!)
  ).length;
  const officialCompleteDiscoveryMetadataCount = officialModels.filter(
    hasDiscoveryMetadata
  ).length;
  const completeDiscoveryMetadataPct =
    models.length > 0
      ? Number(
          ((completeDiscoveryMetadataCount / models.length) * 100).toFixed(1)
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

  const providerStats = new Map<
    string,
    {
      total: number;
      complete: number;
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
      missingCategory: 0,
      missingReleaseDate: 0,
      releaseDateExemptAliases: 0,
    };

    stats.total += 1;
    if (hasCompletePublicMetadata(model)) stats.complete += 1;
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
    missingCategoryCount: missingCategory.length,
    missingReleaseDateCount: missingReleaseDate.length,
    releaseDateExemptAliasCount,
    openWeightsMissingLicenseCount: openWeightsMissingLicense.length,
    llmMissingContextWindowCount: llmMissingContextWindow.length,
    official: {
      activeModels: officialModels.length,
      completeDiscoveryMetadataCount: officialCompleteDiscoveryMetadataCount,
      completeDiscoveryMetadataPct: officialCompleteDiscoveryMetadataPct,
      missingCategoryCount: officialMissingCategory.length,
      missingReleaseDateCount: officialMissingReleaseDate.length,
      releaseDateExemptAliasCount: officialReleaseDateExemptAliasCount,
      openWeightsMissingLicenseCount: officialOpenWeightsMissingLicense.length,
      llmMissingContextWindowCount: officialLlmMissingContextWindow.length,
      providers: [...providerStats.entries()]
        .filter(([provider]) => OFFICIAL_PROVIDERS.has(provider))
        .map(([provider, stats]) => ({
          provider,
          total: stats.total,
          complete: stats.complete,
          complete_pct: Number(
            ((stats.complete / Math.max(stats.total, 1)) * 100).toFixed(1)
          ),
          missingCategoryCount: stats.missingCategory,
          missingReleaseDateCount: stats.missingReleaseDate,
          releaseDateExemptAliasCount: stats.releaseDateExemptAliases,
        }))
        .sort(
          (left, right) =>
            left.complete_pct - right.complete_pct || right.total - left.total
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
    },
    providers: [...providerStats.entries()]
      .map(([provider, stats]) => ({
        provider,
        total: stats.total,
        complete: stats.complete,
        complete_pct: Number(
          ((stats.complete / Math.max(stats.total, 1)) * 100).toFixed(1)
        ),
        missingCategoryCount: stats.missingCategory,
        missingReleaseDateCount: stats.missingReleaseDate,
        releaseDateExemptAliasCount: stats.releaseDateExemptAliases,
      }))
      .sort(
        (left, right) =>
          left.complete_pct - right.complete_pct || right.total - left.total
      ),
    recentIncompleteModels,
  };
}
