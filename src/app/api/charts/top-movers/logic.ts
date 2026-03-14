export interface SnapshotRow {
  model_id: string;
  overall_rank: number | null;
  quality_score: number | null;
}

export interface ModelSummaryRow {
  id: string;
  name: string | null;
  slug: string | null;
  provider: string | null;
  category: string | null;
}

export interface TopMoverItem {
  name: string;
  slug: string;
  provider: string;
  category: string;
  rankChange: number;
  scoreChange: number;
  currentRank: number;
  currentScore: number;
}

export interface TopMoversPayload {
  risers: TopMoverItem[];
  fallers: TopMoverItem[];
  asOf: string;
}

export interface TopMoversDataClient {
  fetchSnapshotsForDate(date: string): Promise<SnapshotRow[]>;
  fetchLatestSnapshotDate(beforeDate?: string): Promise<string | null>;
  fetchModels(modelIds: string[]): Promise<ModelSummaryRow[]>;
}

interface BuildTopMoversOptions {
  today: string;
  yesterday: string;
  limit: number;
}

export async function buildTopMoversPayload(
  client: TopMoversDataClient,
  options: BuildTopMoversOptions
): Promise<TopMoversPayload> {
  let currentSnapshots = await client.fetchSnapshotsForDate(options.today);
  let previousSnapshots = await client.fetchSnapshotsForDate(options.yesterday);
  let asOf = options.today;

  if (currentSnapshots.length === 0 || previousSnapshots.length === 0) {
    const latestDate = await client.fetchLatestSnapshotDate();
    if (!latestDate) {
      return { risers: [], fallers: [], asOf: options.today };
    }

    const previousDate = await client.fetchLatestSnapshotDate(latestDate);
    if (!previousDate) {
      return { risers: [], fallers: [], asOf: latestDate };
    }

    currentSnapshots = await client.fetchSnapshotsForDate(latestDate);
    previousSnapshots = await client.fetchSnapshotsForDate(previousDate);
    asOf = latestDate;
  }

  if (currentSnapshots.length === 0 || previousSnapshots.length === 0) {
    return { risers: [], fallers: [], asOf };
  }

  const previousByModel = new Map(
    previousSnapshots.map((snapshot) => [snapshot.model_id, snapshot])
  );

  const deltas: Array<{
    modelId: string;
    rankChange: number;
    scoreChange: number;
    currentRank: number;
    currentScore: number;
  }> = [];

  for (const snapshot of currentSnapshots) {
    if (snapshot.overall_rank == null) continue;

    const previous = previousByModel.get(snapshot.model_id);
    if (!previous || previous.overall_rank == null) continue;

    deltas.push({
      modelId: snapshot.model_id,
      rankChange: previous.overall_rank - snapshot.overall_rank,
      scoreChange: (snapshot.quality_score ?? 0) - (previous.quality_score ?? 0),
      currentRank: snapshot.overall_rank,
      currentScore: snapshot.quality_score ?? 0,
    });
  }

  const risers = deltas
    .filter((item) => item.rankChange > 0)
    .sort((a, b) => b.rankChange - a.rankChange)
    .slice(0, options.limit);

  const fallers = deltas
    .filter((item) => item.rankChange < 0)
    .sort((a, b) => a.rankChange - b.rankChange)
    .slice(0, options.limit);

  const modelIds = [...new Set([...risers, ...fallers].map((item) => item.modelId))];
  const models = await client.fetchModels(modelIds);
  const modelById = new Map(models.map((model) => [model.id, model]));

  const formatItems = (
    items: Array<{
      modelId: string;
      rankChange: number;
      scoreChange: number;
      currentRank: number;
      currentScore: number;
    }>
  ): TopMoverItem[] =>
    items.map((item) => {
      const model = modelById.get(item.modelId);
      return {
        name: model?.name ?? "Unknown",
        slug: model?.slug ?? "",
        provider: model?.provider ?? "",
        category: model?.category ?? "",
        rankChange: item.rankChange,
        scoreChange: Math.round(item.scoreChange * 10) / 10,
        currentRank: item.currentRank,
        currentScore: item.currentScore,
      };
    });

  return {
    risers: formatItems(risers),
    fallers: formatItems(fallers),
    asOf,
  };
}
