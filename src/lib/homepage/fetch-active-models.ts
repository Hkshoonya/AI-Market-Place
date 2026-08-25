const PAGE_SIZE = 1000;
export const HOMEPAGE_ACTIVE_MODEL_CANDIDATE_LIMIT = 1000;

export const HOMEPAGE_ACTIVE_MODELS_SELECT = [
  "id",
  "slug",
  "name",
  "provider",
  "category",
  "status",
  "is_api_available",
  "overall_rank",
  "quality_score",
  "capability_score",
  "capability_rank",
  "popularity_score",
  "popularity_rank",
  "adoption_score",
  "adoption_rank",
  "economic_footprint_score",
  "economic_footprint_rank",
  "market_cap_estimate",
  "agent_score",
  "hf_downloads",
  "hf_likes",
  "hf_trending_score",
  "release_date",
  "created_at",
  "parameter_count",
  "short_description",
  "description",
  "context_window",
  "is_open_weights",
  "license",
  "license_name",
].join(", ");

export const RANKING_HEALTH_ACTIVE_MODELS_SELECT = [
  HOMEPAGE_ACTIVE_MODELS_SELECT,
  "benchmark_scores(source)",
  "elo_ratings(id)",
].join(", ");

export type HomepageActiveModelRow = Record<string, unknown>;

interface HomepageCandidateRow {
  id: string;
  overall_rank?: unknown;
  quality_score?: unknown;
  capability_score?: unknown;
  adoption_score?: unknown;
  economic_footprint_score?: unknown;
  popularity_score?: unknown;
  hf_downloads?: unknown;
  release_date?: unknown;
  is_api_available?: unknown;
  description?: unknown;
  short_description?: unknown;
  is_open_weights?: unknown;
  context_window?: unknown;
  parameter_count?: unknown;
}

interface HomepageCandidateOptions {
  preferredIds?: Iterable<string>;
  now?: number;
}

function finiteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function candidatePriority(
  model: HomepageCandidateRow,
  preferredIds: Set<string>,
  now: number
) {
  const id = typeof model.id === "string" ? model.id : "";
  const overallRank = finiteNumber(model.overall_rank);
  const quality = finiteNumber(model.quality_score);
  const capability = finiteNumber(model.capability_score);
  const adoption = finiteNumber(model.adoption_score);
  const economic = finiteNumber(model.economic_footprint_score);
  const popularity = finiteNumber(model.popularity_score);
  const downloads = finiteNumber(model.hf_downloads);
  const releaseTimestamp =
    typeof model.release_date === "string"
      ? Date.parse(model.release_date)
      : Number.NaN;
  const releaseAgeDays = Number.isFinite(releaseTimestamp)
    ? Math.max(0, (now - releaseTimestamp) / 86_400_000)
    : Number.POSITIVE_INFINITY;

  let priority = 0;
  if (preferredIds.has(id)) priority += 10_000_000;
  if (overallRank > 0) priority += 5_000_000 - Math.min(overallRank, 10_000) * 100;
  priority += (quality + capability + adoption + economic + popularity) * 2_000;
  if (model.is_api_available === true) priority += 800_000;
  if (
    typeof model.description === "string" &&
    model.description.trim().length > 0
  ) {
    priority += 500_000;
  }
  if (
    typeof model.short_description === "string" &&
    model.short_description.trim().length > 0
  ) {
    priority += 250_000;
  }
  if (model.is_open_weights === true) priority += 75_000;
  if (finiteNumber(model.context_window) > 0) priority += 50_000;
  if (finiteNumber(model.parameter_count) > 0) priority += 50_000;
  if (releaseAgeDays <= 730) priority += Math.max(0, 730 - releaseAgeDays) * 500;
  if (downloads > 0) priority += Math.log10(downloads + 1) * 10_000;

  return priority;
}

export function selectHomepageActiveModelCandidates<T extends HomepageCandidateRow>(
  models: T[],
  limit = HOMEPAGE_ACTIVE_MODEL_CANDIDATE_LIMIT,
  options: HomepageCandidateOptions = {}
): T[] {
  if (limit <= 0) return [];
  if (models.length <= limit) return models;

  const preferredIds = new Set(options.preferredIds ?? []);
  const now = options.now ?? Date.now();

  return [...models]
    .sort((left, right) => {
      const priorityDifference =
        candidatePriority(right, preferredIds, now) -
        candidatePriority(left, preferredIds, now);
      if (priorityDifference !== 0) return priorityDifference;

      return String(left.id ?? "").localeCompare(String(right.id ?? ""));
    })
    .slice(0, limit);
}

interface HomepageModelsPageQuery {
  eq: (column: string, value: string) => HomepageModelsPageQuery;
  order: (
    column: string,
    options: { ascending: boolean }
  ) => HomepageModelsPageQuery;
  range: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: HomepageActiveModelRow[] | null;
    error: { message?: string } | null;
  }>;
}

interface HomepageModelsClient {
  from: (table: "models") => {
    select: (columns: string) => HomepageModelsPageQuery;
  };
}

async function fetchAllActiveModels(
  supabase: HomepageModelsClient,
  columns: string,
  surface: "homepage" | "ranking health"
): Promise<HomepageActiveModelRow[]> {
  const rows: HomepageActiveModelRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("models")
      .select(columns)
      .eq("status", "active")
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(
        `Failed to fetch ${surface} active models: ${error.message ?? "unknown error"}`
      );
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

export async function fetchAllHomepageActiveModels(
  supabase: HomepageModelsClient
): Promise<HomepageActiveModelRow[]> {
  return fetchAllActiveModels(
    supabase,
    HOMEPAGE_ACTIVE_MODELS_SELECT,
    "homepage"
  );
}

export async function fetchAllRankingHealthActiveModels(
  supabase: HomepageModelsClient
): Promise<HomepageActiveModelRow[]> {
  return fetchAllActiveModels(
    supabase,
    RANKING_HEALTH_ACTIVE_MODELS_SELECT,
    "ranking health"
  );
}
