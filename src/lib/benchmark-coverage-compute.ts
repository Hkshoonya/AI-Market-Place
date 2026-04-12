import { getCanonicalProviderName } from "./constants/providers";
import { isBenchmarkMetadataCoverageCandidate } from "./benchmark-metadata-coverage-compute";
import { OFFICIAL_PROVIDERS } from "./models/public-source-trust";
import type { TypedSupabaseClient } from "@/types/database";

type ProviderCoverage = {
  provider: string;
  total: number;
  scored: number;
  evidenced: number;
  covered: number;
  coverage_pct: number;
};

type SparseCoverageEntry = {
  slug: string;
  provider: string;
  category: string | null;
  release_date: string | null;
};

const PAGE_SIZE = 1000;
const RECENT_RELEASE_CUTOFF = Date.parse("2025-12-01T00:00:00.000Z");

type ModelCoverageRow = {
  id: string;
  slug: string;
  provider: string;
  category: string | null;
  hf_model_id: string | null;
  website_url: string | null;
  release_date: string | null;
};

type ModelIdRow = {
  model_id: string;
};

type BenchmarkNewsRow = {
  related_model_ids: string[] | null;
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

export async function computeBenchmarkCoverage(
  supabase: TypedSupabaseClient
) {
  const [models, benchmarkRows, benchmarkNewsRows] = await Promise.all([
    fetchAllRows<ModelCoverageRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("models")
        .select("id, slug, provider, category, hf_model_id, website_url, release_date")
        .eq("status", "active")
        .range(from, to);

      if (error) {
        throw new Error(`Failed to fetch models for benchmark coverage: ${error.message}`);
      }

      return (data ?? []) as ModelCoverageRow[];
    }),
    fetchAllRows<ModelIdRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("benchmark_scores")
        .select("model_id")
        .range(from, to);

      if (error) {
        throw new Error(`Failed to fetch benchmark score coverage: ${error.message}`);
      }

      return (data ?? []) as ModelIdRow[];
    }),
    fetchAllRows<BenchmarkNewsRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("model_news")
        .select("related_model_ids")
        .eq("category", "benchmark")
        .range(from, to);

      if (error) {
        throw new Error(`Failed to fetch benchmark news coverage: ${error.message}`);
      }

      return (data ?? []) as BenchmarkNewsRow[];
    }),
  ]);

  const scoredModelIds = new Set(benchmarkRows.map((row) => row.model_id));
  const evidencedModelIds = new Set<string>();

  for (const row of benchmarkNewsRows) {
    for (const modelId of row.related_model_ids ?? []) {
      evidencedModelIds.add(modelId);
    }
  }

  const providerStats = new Map<
    string,
    { total: number; scored: number; evidenced: number; covered: number }
  >();
  const recentSparseBenchmarkExpectedOfficial: SparseCoverageEntry[] = [];

  for (const model of models) {
    const provider = getCanonicalProviderName(model.provider ?? "Unknown");
    const stats = providerStats.get(provider) ?? {
      total: 0,
      scored: 0,
      evidenced: 0,
      covered: 0,
    };

    stats.total += 1;

    const hasScore = scoredModelIds.has(model.id);
    const hasEvidence = evidencedModelIds.has(model.id);

    if (hasScore) stats.scored += 1;
    if (hasEvidence) stats.evidenced += 1;
    if (hasScore || hasEvidence) {
      stats.covered += 1;
    } else if (
      model.release_date &&
      Date.parse(model.release_date) >= RECENT_RELEASE_CUTOFF &&
      isBenchmarkMetadataCoverageCandidate(model)
    ) {
      recentSparseBenchmarkExpectedOfficial.push({
        slug: model.slug,
        provider,
        category: model.category,
        release_date: model.release_date,
      });
    }

    providerStats.set(provider, stats);
  }

  const providers: ProviderCoverage[] = [...providerStats.entries()]
    .map(([provider, stats]) => ({
      provider,
      ...stats,
      coverage_pct: Number(
        ((stats.covered / Math.max(stats.total, 1)) * 100).toFixed(1)
      ),
    }))
    .sort((left, right) => right.total - left.total);

  const officialProviders = providers
    .filter((provider) =>
      OFFICIAL_PROVIDERS.has(getCanonicalProviderName(provider.provider))
    )
    .sort(
      (left, right) =>
        left.coverage_pct - right.coverage_pct || right.total - left.total
    );

  const coveredModelCount = models.filter(
    (model) => scoredModelIds.has(model.id) || evidencedModelIds.has(model.id)
  ).length;

  return {
    totals: {
      active_models: models.length,
      with_scores: scoredModelIds.size,
      with_benchmark_news: evidencedModelIds.size,
      covered_models: coveredModelCount,
      coverage_pct: Number(
        ((coveredModelCount / Math.max(models.length, 1)) * 100).toFixed(1)
      ),
    },
    official_providers: officialProviders,
    recent_sparse_benchmark_expected_official: recentSparseBenchmarkExpectedOfficial
      .sort(
        (left, right) =>
          Date.parse(right.release_date ?? "0") - Date.parse(left.release_date ?? "0")
      )
      .slice(0, 40),
  };
}
