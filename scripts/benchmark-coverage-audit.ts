import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { isBenchmarkExpectedModel } from "../src/lib/data-sources/shared/benchmark-coverage";

dotenv.config({ path: ".env.local" });
dotenv.config();

type ProviderCoverage = {
  total: number;
  scored: number;
  evidenced: number;
  covered: number;
};

const PAGE_SIZE = 1000;
const RECENT_RELEASE_CUTOFF = Date.parse("2025-12-01T00:00:00.000Z");
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

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: Error | null }>
) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const [models, benchmarkRows, benchmarkNewsRows] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("models")
        .select("id, slug, name, provider, category, release_date")
        .eq("status", "active")
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase.from("benchmark_scores").select("model_id").range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("model_news")
        .select("related_model_ids")
        .eq("category", "benchmark")
        .range(from, to)
    ),
  ]);

  const scoredModelIds = new Set(benchmarkRows.map((row) => row.model_id));
  const evidencedModelIds = new Set<string>();

  for (const row of benchmarkNewsRows) {
    for (const modelId of row.related_model_ids ?? []) {
      evidencedModelIds.add(modelId);
    }
  }

  const providerStats = new Map<string, ProviderCoverage>();
  const recentSparseModels: Array<{
    slug: string;
    provider: string;
    category: string | null;
    release_date: string | null;
  }> = [];
  const recentSparseOfficialModels: Array<{
    slug: string;
    provider: string;
    category: string | null;
    release_date: string | null;
  }> = [];
  const recentSparseBenchmarkExpectedOfficialModels: Array<{
    slug: string;
    provider: string;
    category: string | null;
    release_date: string | null;
  }> = [];

  for (const model of models) {
    const provider = model.provider ?? "Unknown";
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
      Date.parse(model.release_date) >= RECENT_RELEASE_CUTOFF
    ) {
      const entry = {
        slug: model.slug,
        provider,
        category: model.category,
        release_date: model.release_date,
      };
      recentSparseModels.push(entry);
      if (OFFICIAL_PROVIDERS.has(provider)) {
        recentSparseOfficialModels.push(entry);
        if (isBenchmarkExpectedModel({ ...entry, provider })) {
          recentSparseBenchmarkExpectedOfficialModels.push(entry);
        }
      }
    }

    providerStats.set(provider, stats);
  }

  const providers = [...providerStats.entries()]
    .map(([provider, stats]) => ({
      provider,
      ...stats,
      coverage_pct: Number(
        ((stats.covered / Math.max(stats.total, 1)) * 100).toFixed(1)
      ),
    }))
    .sort((left, right) => right.total - left.total);
  const officialProviders = providers
    .filter((provider) => OFFICIAL_PROVIDERS.has(provider.provider))
    .sort(
      (left, right) =>
        left.coverage_pct - right.coverage_pct || right.total - left.total
    );

  const recentSparse = recentSparseModels
    .sort(
      (left, right) =>
        Date.parse(right.release_date ?? "0") - Date.parse(left.release_date ?? "0")
    )
    .slice(0, 40);
  const recentSparseOfficial = recentSparseOfficialModels
    .sort(
      (left, right) =>
        Date.parse(right.release_date ?? "0") - Date.parse(left.release_date ?? "0")
    )
    .slice(0, 40);
  const recentSparseBenchmarkExpectedOfficial =
    recentSparseBenchmarkExpectedOfficialModels
      .sort(
        (left, right) =>
          Date.parse(right.release_date ?? "0") - Date.parse(left.release_date ?? "0")
      )
      .slice(0, 40);

  console.log(
    JSON.stringify(
      {
        totals: {
          active_models: models.length,
          with_scores: scoredModelIds.size,
          with_benchmark_news: evidencedModelIds.size,
        },
        providers: providers.slice(0, 20),
        official_providers: officialProviders,
        recent_sparse: recentSparse,
        recent_sparse_official: recentSparseOfficial,
        recent_sparse_benchmark_expected_official:
          recentSparseBenchmarkExpectedOfficial,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
