import {
  getTrustedBenchmarkHfUrl,
  getTrustedBenchmarkWebsiteUrl,
  isBenchmarkExpectedModel,
} from "@/lib/data-sources/shared/benchmark-coverage";
import type { TypedSupabaseClient } from "@/types/database";

const PAGE_SIZE = 1000;

type ActiveModelMetadataRow = {
  slug: string;
  provider: string;
  category: string | null;
  hf_model_id: string | null;
  website_url: string | null;
  release_date: string | null;
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

export async function computeBenchmarkMetadataCoverage(
  supabase: TypedSupabaseClient
) {
  const models = await fetchAllRows<ActiveModelMetadataRow>(async (from, to) => {
    const { data, error } = await supabase
      .from("models")
      .select("slug, provider, category, hf_model_id, website_url, release_date")
      .eq("status", "active")
      .range(from, to);

    if (error) {
      throw new Error(
        `Failed to fetch models for benchmark metadata coverage: ${error.message}`
      );
    }

    return (data ?? []) as ActiveModelMetadataRow[];
  });

  const benchmarkExpectedModels = models.filter((model) =>
    isBenchmarkExpectedModel(model)
  );
  const missingTrustedLocatorRows = benchmarkExpectedModels.filter(
    (model) =>
      !getTrustedBenchmarkHfUrl(model) && !getTrustedBenchmarkWebsiteUrl(model)
  );

  const withTrustedHfLocator = benchmarkExpectedModels.filter((model) =>
    Boolean(getTrustedBenchmarkHfUrl(model))
  ).length;
  const withTrustedWebsiteLocator = benchmarkExpectedModels.filter((model) =>
    Boolean(getTrustedBenchmarkWebsiteUrl(model))
  ).length;
  const missingTrustedLocatorCount = missingTrustedLocatorRows.length;
  const withAnyTrustedBenchmarkLocator =
    benchmarkExpectedModels.length - missingTrustedLocatorCount;
  const trustedLocatorCoveragePct =
    benchmarkExpectedModels.length > 0
      ? Number(
          (
            (withAnyTrustedBenchmarkLocator / benchmarkExpectedModels.length) *
            100
          ).toFixed(1)
        )
      : 100;

  return {
    benchmarkExpectedModels: benchmarkExpectedModels.length,
    withTrustedHfLocator,
    withTrustedWebsiteLocator,
    withAnyTrustedBenchmarkLocator,
    missingTrustedLocatorCount,
    trustedLocatorCoveragePct,
    recentMissingTrustedLocators: missingTrustedLocatorRows
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
  };
}
