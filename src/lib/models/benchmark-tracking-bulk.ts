import {
  getBenchmarkTrackingSummary,
  type BenchmarkTrackingSummary,
} from "@/lib/models/benchmark-status";
import { getNewsSignalType } from "@/lib/news/presentation";
import { systemLog } from "@/lib/logging";

type QueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      in?: (
        column: string,
        values: string[]
      ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
      overlaps?: (column: string, values: string[]) => {
        order: (column: string, options: { ascending: boolean }) => {
          limit: (
            count: number
          ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
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

type QueryResultRow = unknown;

async function resolveTrackingQuery(
  source: string,
  query: PromiseLike<{ data: QueryResultRow[] | null; error: { message: string } | null }>
) {
  try {
    const result = await query;
    if (result.error) {
      void systemLog.warn("benchmark-tracking", `Failed to fetch ${source}`, {
        error: result.error.message,
      });
      return [] as QueryResultRow[];
    }

    return result.data ?? [];
  } catch (error) {
    void systemLog.warn("benchmark-tracking", `Failed to fetch ${source}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return [] as QueryResultRow[];
  }
}

export async function buildBenchmarkTrackingSummaryMap(
  queryClient: QueryClient,
  models: BenchmarkTrackingModel[]
) {
  const ids = models.map((model) => model.id);
  const summaries = new Map<string, BenchmarkTrackingSummary>();

  if (ids.length === 0) {
    return summaries;
  }

  const [scoreRows, arenaRows, benchmarkNewsRows] = await Promise.all([
    resolveTrackingQuery(
      "benchmark scores",
      queryClient.from("benchmark_scores").select("model_id").in?.("model_id", ids) ??
        Promise.resolve({ data: [], error: null })
    ),
    resolveTrackingQuery(
      "arena ratings",
      queryClient.from("elo_ratings").select("model_id").in?.("model_id", ids) ??
        Promise.resolve({ data: [], error: null })
    ),
    resolveTrackingQuery(
      "benchmark news",
      queryClient
        .from("model_news")
        .select("id, title, source, category, related_model_ids, metadata, published_at")
        .overlaps?.("related_model_ids", ids)
        .order("published_at", { ascending: false })
        .limit(500) ?? Promise.resolve({ data: [], error: null })
    ),
  ]);

  const scoreCounts = new Map<string, number>();
  for (const row of scoreRows) {
    const modelId =
      row && typeof row === "object" && "model_id" in row && typeof row.model_id === "string"
        ? row.model_id
        : null;
    if (!modelId) continue;
    scoreCounts.set(modelId, (scoreCounts.get(modelId) ?? 0) + 1);
  }

  const arenaCounts = new Map<string, number>();
  for (const row of arenaRows) {
    const modelId =
      row && typeof row === "object" && "model_id" in row && typeof row.model_id === "string"
        ? row.model_id
        : null;
    if (!modelId) continue;
    arenaCounts.set(modelId, (arenaCounts.get(modelId) ?? 0) + 1);
  }

  const benchmarkEvidenceCounts = new Map<string, number>();
  for (const row of benchmarkNewsRows) {
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
