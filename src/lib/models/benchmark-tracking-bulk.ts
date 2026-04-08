import {
  getBenchmarkTrackingSummary,
  type BenchmarkTrackingSummary,
} from "@/lib/models/benchmark-status";
import { getNewsSignalType } from "@/lib/news/presentation";

type QueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      in?: (column: string, values: string[]) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      overlaps?: (column: string, values: string[]) => {
        order: (column: string, options: { ascending: boolean }) => {
          limit: (count: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        };
      };
    };
  };
};

type BenchmarkTrackingModel = {
  id: string;
  slug: string;
  provider: string;
  category: string | null;
};

export async function buildBenchmarkTrackingSummaryMap(
  queryClient: QueryClient,
  models: BenchmarkTrackingModel[]
) {
  const ids = models.map((model) => model.id);
  const summaries = new Map<string, BenchmarkTrackingSummary>();

  if (ids.length === 0) {
    return summaries;
  }

  const [scoresResult, arenaResult, benchmarkNewsResult] = await Promise.all([
    queryClient.from("benchmark_scores").select("model_id").in?.("model_id", ids) ??
      Promise.resolve({ data: [], error: null }),
    queryClient.from("elo_ratings").select("model_id").in?.("model_id", ids) ??
      Promise.resolve({ data: [], error: null }),
    queryClient
      .from("model_news")
      .select("id, title, source, category, related_model_ids, metadata, published_at")
      .overlaps?.("related_model_ids", ids)
      .order("published_at", { ascending: false })
      .limit(500) ?? Promise.resolve({ data: [], error: null }),
  ]);

  if (scoresResult.error) {
    throw new Error(`Failed to fetch benchmark scores: ${scoresResult.error.message}`);
  }
  if (arenaResult.error) {
    throw new Error(`Failed to fetch arena ratings: ${arenaResult.error.message}`);
  }
  if (benchmarkNewsResult.error) {
    throw new Error(`Failed to fetch benchmark news: ${benchmarkNewsResult.error.message}`);
  }

  const scoreCounts = new Map<string, number>();
  for (const row of scoresResult.data ?? []) {
    const modelId =
      row && typeof row === "object" && "model_id" in row && typeof row.model_id === "string"
        ? row.model_id
        : null;
    if (!modelId) continue;
    scoreCounts.set(modelId, (scoreCounts.get(modelId) ?? 0) + 1);
  }

  const arenaCounts = new Map<string, number>();
  for (const row of arenaResult.data ?? []) {
    const modelId =
      row && typeof row === "object" && "model_id" in row && typeof row.model_id === "string"
        ? row.model_id
        : null;
    if (!modelId) continue;
    arenaCounts.set(modelId, (arenaCounts.get(modelId) ?? 0) + 1);
  }

  const benchmarkEvidenceCounts = new Map<string, number>();
  for (const row of benchmarkNewsResult.data ?? []) {
    if (!row || typeof row !== "object") continue;
    const signalType = getNewsSignalType({
      id: "id" in row && typeof row.id === "string" ? row.id : null,
      title: "title" in row && typeof row.title === "string" ? row.title : null,
      source: "source" in row && typeof row.source === "string" ? row.source : null,
      category: "category" in row && typeof row.category === "string" ? row.category : null,
      published_at:
        "published_at" in row && typeof row.published_at === "string"
          ? row.published_at
          : null,
      related_model_ids:
        "related_model_ids" in row && Array.isArray(row.related_model_ids)
          ? row.related_model_ids.filter((value): value is string => typeof value === "string")
          : null,
      metadata:
        "metadata" in row && row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : null,
    });

    if (signalType !== "benchmark") continue;

    const relatedModelIds =
      "related_model_ids" in row && Array.isArray(row.related_model_ids)
        ? row.related_model_ids.filter((value): value is string => typeof value === "string")
        : [];
    for (const modelId of relatedModelIds) {
      if (!ids.includes(modelId)) continue;
      benchmarkEvidenceCounts.set(
        modelId,
        (benchmarkEvidenceCounts.get(modelId) ?? 0) + 1
      );
    }
  }

  for (const model of models) {
    summaries.set(
      model.id,
      getBenchmarkTrackingSummary({
        slug: model.slug,
        provider: model.provider,
        category: model.category,
        benchmarkScoreCount: scoreCounts.get(model.id) ?? 0,
        benchmarkEvidenceCount: benchmarkEvidenceCounts.get(model.id) ?? 0,
        arenaSignalCount: arenaCounts.get(model.id) ?? 0,
      })
    );
  }

  return summaries;
}
