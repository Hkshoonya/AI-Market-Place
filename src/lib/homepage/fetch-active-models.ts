const PAGE_SIZE = 1000;

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
  "benchmark_scores(source)",
  "elo_ratings(elo_score, arena_name)",
].join(", ");

type HomepageActiveModelRow = Record<string, unknown>;

interface HomepageModelsPageQuery {
  eq: (column: string, value: string) => HomepageModelsPageQuery;
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

export async function fetchAllHomepageActiveModels(
  supabase: HomepageModelsClient
): Promise<HomepageActiveModelRow[]> {
  const rows: HomepageActiveModelRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("models")
      .select(HOMEPAGE_ACTIVE_MODELS_SELECT)
      .eq("status", "active")
      .range(from, to);

    if (error) {
      throw new Error(
        `Failed to fetch homepage active models: ${error.message ?? "unknown error"}`
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
