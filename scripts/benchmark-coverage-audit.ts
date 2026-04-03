import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });
dotenv.config();

type ProviderCoverage = {
  total: number;
  scored: number;
  evidenced: number;
  covered: number;
};

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

  const [
    { data: models, error: modelsError },
    { data: benchmarkRows, error: benchmarkError },
    { data: benchmarkNewsRows, error: benchmarkNewsError },
  ] = await Promise.all([
    supabase
      .from("models")
      .select("id, slug, name, provider, category, release_date")
      .eq("status", "active"),
    supabase.from("benchmark_scores").select("model_id"),
    supabase
      .from("model_news")
      .select("related_model_ids")
      .eq("category", "benchmark"),
  ]);

  if (modelsError) throw modelsError;
  if (benchmarkError) throw benchmarkError;
  if (benchmarkNewsError) throw benchmarkNewsError;

  const scoredModelIds = new Set((benchmarkRows ?? []).map((row) => row.model_id));
  const evidencedModelIds = new Set<string>();

  for (const row of benchmarkNewsRows ?? []) {
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

  for (const model of models ?? []) {
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
      Date.parse(model.release_date) >= Date.parse("2025-12-01T00:00:00.000Z")
    ) {
      recentSparseModels.push({
        slug: model.slug,
        provider,
        category: model.category,
        release_date: model.release_date,
      });
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

  const recentSparse = recentSparseModels
    .sort(
      (left, right) =>
        Date.parse(right.release_date ?? "0") - Date.parse(left.release_date ?? "0")
    )
    .slice(0, 40);

  console.log(
    JSON.stringify(
      {
        totals: {
          active_models: (models ?? []).length,
          with_scores: scoredModelIds.size,
          with_benchmark_news: evidencedModelIds.size,
        },
        providers: providers.slice(0, 20),
        recent_sparse: recentSparse,
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
