import type { TypedSupabaseClient } from "@/types/database";

const PAGE_SIZE = 1000;

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

function hasOpenWeightLicense(model: ActiveModelPublicMetadataRow) {
  return Boolean(model.license_name || model.license);
}

function hasDiscoveryMetadata(model: ActiveModelPublicMetadataRow) {
  return Boolean(model.name?.trim() && model.category && model.release_date);
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

  const missingCategory = models.filter((model) => !model.category);
  const missingReleaseDate = models.filter((model) => !model.release_date);
  const openWeightsMissingLicense = models.filter(
    (model) => Boolean(model.is_open_weights) && !hasOpenWeightLicense(model)
  );
  const llmMissingContextWindow = models.filter(
    (model) => needsContextWindow(model) && !model.context_window
  );
  const completeDiscoveryMetadataCount = models.filter(
    hasDiscoveryMetadata
  ).length;
  const completeDiscoveryMetadataPct =
    models.length > 0
      ? Number(
          ((completeDiscoveryMetadataCount / models.length) * 100).toFixed(1)
        )
      : 100;

  const recentIncompleteModels = models
    .filter(
      (model) =>
        !hasDiscoveryMetadata(model) ||
        (Boolean(model.is_open_weights) && !hasOpenWeightLicense(model)) ||
        (needsContextWindow(model) && !model.context_window)
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

  return {
    activeModels: models.length,
    completeDiscoveryMetadataCount,
    completeDiscoveryMetadataPct,
    missingCategoryCount: missingCategory.length,
    missingReleaseDateCount: missingReleaseDate.length,
    openWeightsMissingLicenseCount: openWeightsMissingLicense.length,
    llmMissingContextWindowCount: llmMissingContextWindow.length,
    recentIncompleteModels,
  };
}
