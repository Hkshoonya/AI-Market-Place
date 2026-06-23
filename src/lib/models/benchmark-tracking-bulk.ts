import {
  getBenchmarkTrackingSummary,
  type BenchmarkTrackingSummary,
} from "@/lib/models/benchmark-status";
import { isTrustedStructuredBenchmarkSource } from "@/lib/models/benchmark-score-trust";
import { getNewsSignalType } from "@/lib/news/presentation";
import { systemLog } from "@/lib/logging";

const MODEL_ID_QUERY_CHUNK_SIZE = 100;
const BENCHMARK_NEWS_ROWS_PER_CHUNK = 500;

type TrackingQueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

type TrackingQuery = PromiseLike<TrackingQueryResult>;

type TrackingQueryBuilder = {
  in?: (column: string, values: string[]) => TrackingQuery;
  eq?: (column: string, value: string) => TrackingQueryBuilder;
  overlaps?: (column: string, values: string[]) => TrackingQueryBuilder;
  order?: (
    column: string,
    options: { ascending: boolean }
  ) => TrackingQueryBuilder;
  limit?: (count: number) => TrackingQuery;
};

type QueryClient = {
  from: (table: string) => {
    select: (columns: string) => TrackingQueryBuilder;
  };
};

type BenchmarkTrackingModel = {
  id: string;
  slug: string;
  provider: string;
  category: string | null;
};

type QueryResultRow = unknown;

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function resolveTrackingQuery(
  source: string,
  query: TrackingQuery
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

async function resolveTrackingQueries(source: string, queries: TrackingQuery[]) {
  const rows = await Promise.all(
    queries.map((query) => resolveTrackingQuery(source, query))
  );
  return rows.flat();
}

function buildModelIdQueries(
  queryClient: QueryClient,
  table: string,
  columns: string,
  ids: string[]
) {
  return chunkValues(ids, MODEL_ID_QUERY_CHUNK_SIZE).map((chunk) => {
    const query = queryClient.from(table).select(columns).in?.("model_id", chunk);
    return query ?? Promise.resolve({ data: [], error: null });
  });
}

function buildBenchmarkNewsQueries(queryClient: QueryClient, ids: string[]) {
  return chunkValues(ids, MODEL_ID_QUERY_CHUNK_SIZE).map((chunk) => {
    const query = queryClient
      .from("model_news")
      .select("id, title, source, category, related_model_ids, metadata, published_at");
    const benchmarkQuery = query.eq?.("category", "benchmark") ?? query;
    const overlapQuery = benchmarkQuery.overlaps?.("related_model_ids", chunk);
    const orderedQuery =
      overlapQuery?.order?.("published_at", { ascending: false }) ?? overlapQuery;
    const limitedQuery = orderedQuery?.limit?.(BENCHMARK_NEWS_ROWS_PER_CHUNK);

    return limitedQuery ?? Promise.resolve({ data: [], error: null });
  });
}

function dedupeRowsById(rows: QueryResultRow[]) {
  const deduped = new Map<string, QueryResultRow>();
  const withoutIds: QueryResultRow[] = [];

  for (const row of rows) {
    const id =
      row && typeof row === "object" && "id" in row && typeof row.id === "string"
        ? row.id
        : null;

    if (!id) {
      withoutIds.push(row);
      continue;
    }

    deduped.set(id, row);
  }

  return [...deduped.values(), ...withoutIds];
}

export async function buildBenchmarkTrackingSummaryMap(
  queryClient: QueryClient,
  models: BenchmarkTrackingModel[]
) {
  const ids = models.map((model) => model.id);
  const idSet = new Set(ids);
  const summaries = new Map<string, BenchmarkTrackingSummary>();

  if (ids.length === 0) {
    return summaries;
  }

  const [scoreRows, arenaRows, benchmarkNewsRows] = await Promise.all([
    resolveTrackingQueries(
      "benchmark scores",
      buildModelIdQueries(queryClient, "benchmark_scores", "model_id, source", ids)
    ),
    resolveTrackingQueries(
      "arena ratings",
      buildModelIdQueries(queryClient, "elo_ratings", "model_id", ids)
    ),
    resolveTrackingQueries(
      "benchmark news",
      buildBenchmarkNewsQueries(queryClient, ids)
    ),
  ]);

  const trustedScoreCounts = new Map<string, number>();
  for (const row of scoreRows) {
    const modelId =
      row && typeof row === "object" && "model_id" in row && typeof row.model_id === "string"
        ? row.model_id
        : null;
    if (!modelId) continue;
    const source =
      row && typeof row === "object" && "source" in row && typeof row.source === "string"
        ? row.source
        : null;
    if (!isTrustedStructuredBenchmarkSource(source)) continue;
    trustedScoreCounts.set(modelId, (trustedScoreCounts.get(modelId) ?? 0) + 1);
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
  for (const row of dedupeRowsById(benchmarkNewsRows)) {
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
      if (!idSet.has(modelId)) continue;
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
        trustedBenchmarkScoreCount: trustedScoreCounts.get(model.id) ?? 0,
        benchmarkEvidenceCount: benchmarkEvidenceCounts.get(model.id) ?? 0,
        arenaSignalCount: arenaCounts.get(model.id) ?? 0,
      })
    );
  }

  return summaries;
}
