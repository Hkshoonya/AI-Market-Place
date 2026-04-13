import {
  getTrustedBenchmarkHfUrl,
  getTrustedBenchmarkWebsiteUrl,
  isBenchmarkExpectedModel,
} from "@/lib/data-sources/shared/benchmark-coverage";
import { getCanonicalProviderName } from "@/lib/constants/providers";
import {
  getPublicSourceTrustTier,
  OFFICIAL_PROVIDERS,
} from "@/lib/models/public-source-trust";
import { getTrustedStructuredBenchmarkModelIds } from "@/lib/models/benchmark-score-trust";
import type { TypedSupabaseClient } from "@/types/database";

const PAGE_SIZE = 1000;

export type BenchmarkMetadataCoverageModel = {
  id: string;
  slug: string;
  provider: string;
  category: string | null;
  hf_model_id: string | null;
  website_url: string | null;
  release_date: string | null;
};

export function isBenchmarkMetadataCoverageCandidate(
  model: BenchmarkMetadataCoverageModel
) {
  if (!isBenchmarkExpectedModel(model)) {
    return false;
  }

  if (getPublicSourceTrustTier(model) === "wrapper") {
    return false;
  }

  return OFFICIAL_PROVIDERS.has(getCanonicalProviderName(model.provider));
}

type BenchmarkScoreCoverageRow = {
  model_id: string | null;
  source?: string | null;
};

type BenchmarkNewsCoverageRow = {
  related_model_ids: string[] | null;
};

function orderBy<T extends { order?: (column: string, options: { ascending: boolean }) => T }>(
  query: T,
  column: string
) {
  return typeof query.order === "function"
    ? query.order(column, { ascending: true })
    : query;
}

export function buildBenchmarkEvidenceModelIds(
  benchmarkRows: BenchmarkScoreCoverageRow[],
  benchmarkNewsRows: BenchmarkNewsCoverageRow[]
) {
  const modelIds = getTrustedStructuredBenchmarkModelIds(benchmarkRows);

  for (const row of benchmarkNewsRows) {
    for (const modelId of row.related_model_ids ?? []) {
      if (typeof modelId === "string") {
        modelIds.add(modelId);
      }
    }
  }

  return modelIds;
}

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
  const [models, benchmarkRows, benchmarkNewsRows] = await Promise.all([
    fetchAllRows<BenchmarkMetadataCoverageModel>(async (from, to) => {
      const query = supabase
        .from("models")
        .select(
          "id, slug, provider, category, hf_model_id, website_url, release_date"
        )
        .eq("status", "active");
      const { data, error } = await orderBy(query, "id").range(from, to);

      if (error) {
        throw new Error(
          `Failed to fetch models for benchmark metadata coverage: ${error.message}`
        );
      }

      return (data ?? []) as BenchmarkMetadataCoverageModel[];
    }),
    fetchAllRows<BenchmarkScoreCoverageRow>(async (from, to) => {
      const query = supabase
        .from("benchmark_scores")
        .select("model_id, source");
      const { data, error } = await orderBy(query, "model_id").range(from, to);

      if (error) {
        throw new Error(
          `Failed to fetch benchmark scores for metadata coverage: ${error.message}`
        );
      }

      return (data ?? []) as BenchmarkScoreCoverageRow[];
    }),
    fetchAllRows<BenchmarkNewsCoverageRow>(async (from, to) => {
      const query = supabase
        .from("model_news")
        .select("related_model_ids")
        .eq("category", "benchmark");
      const { data, error } = await orderBy(query, "id").range(from, to);

      if (error) {
        throw new Error(
          `Failed to fetch benchmark news for metadata coverage: ${error.message}`
        );
      }

      return (data ?? []) as BenchmarkNewsCoverageRow[];
    }),
  ]);

  const benchmarkEvidenceModelIds = buildBenchmarkEvidenceModelIds(
    benchmarkRows,
    benchmarkNewsRows
  );
  const benchmarkExpectedModels = models.filter((model) =>
    isBenchmarkMetadataCoverageCandidate(model)
  );
  const hasTrustedBenchmarkUpdatePath = (
    model: BenchmarkMetadataCoverageModel
  ) =>
    benchmarkEvidenceModelIds.has(model.id) ||
    Boolean(getTrustedBenchmarkHfUrl(model)) ||
    Boolean(getTrustedBenchmarkWebsiteUrl(model));
  const missingTrustedLocatorRows = benchmarkExpectedModels.filter(
    (model) => !hasTrustedBenchmarkUpdatePath(model)
  );

  const withTrustedHfLocator = benchmarkExpectedModels.filter((model) =>
    Boolean(getTrustedBenchmarkHfUrl(model))
  ).length;
  const withTrustedWebsiteLocator = benchmarkExpectedModels.filter((model) =>
    Boolean(getTrustedBenchmarkWebsiteUrl(model))
  ).length;
  const missingTrustedLocatorCount = missingTrustedLocatorRows.length;
  const withAnyTrustedBenchmarkLocator = benchmarkExpectedModels.filter(
    hasTrustedBenchmarkUpdatePath
  ).length;
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
