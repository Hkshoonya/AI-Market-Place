export interface SearchQueryModelRow {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category?: string | null;
  overall_rank?: number | null;
  quality_score?: number | null;
  capability_score?: number | null;
  adoption_score?: number | null;
  popularity_score?: number | null;
  economic_footprint_score?: number | null;
  release_date?: string | null;
  is_open_weights?: boolean | null;
  is_api_available?: boolean | null;
  status?: string | null;
  parameter_count?: number | null;
  description?: string | null;
  short_description?: string | null;
  market_cap_estimate?: number | null;
  context_window?: number | null;
  license?: string | null;
  license_name?: string | null;
  hf_model_id?: string | null;
  website_url?: string | null;
}

export const SEARCH_MODEL_SELECT =
  "id, slug, name, provider, category, overall_rank, quality_score, capability_score, adoption_score, popularity_score, economic_footprint_score, release_date, is_open_weights, is_api_available, status, parameter_count, description, short_description, market_cap_estimate, context_window, license, license_name, hf_model_id, website_url";

type SearchModelsResult = {
  data: SearchQueryModelRow[] | null;
  error: { message: string } | null;
  count?: number | null;
};

type SearchModelsOrderChain = {
  limit: (limit: number) => Promise<SearchModelsResult>;
  range: (from: number, to: number) => Promise<SearchModelsResult>;
};

type SearchModelsFilterChain = {
  textSearch: (column: string, query: string) => SearchModelsFilterChain;
  eq: (column: string, value: string) => SearchModelsFilterChain;
  or: (filter: string) => SearchModelsFilterChain;
  order: (
    column: string,
    options: { ascending: boolean; nullsFirst: boolean }
  ) => SearchModelsOrderChain;
};

type SearchModelsTableQuery = {
  select: (
    columns: string,
    options?: { count?: "exact" }
  ) => SearchModelsFilterChain;
};

function normalizeSearchInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sanitizeVariant(value: string) {
  return value.replace(/,/g, "").trim();
}

function buildSearchVariants(value: string) {
  const normalized = normalizeSearchInput(value);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  return Array.from(
    new Set(
      [
        value,
        tokens.join(" "),
        tokens.join("-"),
        tokens.join(""),
      ]
        .map((variant) => sanitizeVariant(variant))
        .filter((variant) => variant.length >= 2)
    )
  );
}

function buildIlikeOrFilter(fields: string[], variants: string[]) {
  return fields
    .flatMap((field) =>
      variants.map((variant) => `${field}.ilike.%${sanitizeVariant(variant)}%`)
    )
    .join(",");
}

export async function searchModelsWithFallback(
  queryClient: { from: (table: string) => unknown },
  rawQuery: string,
  fetchLimit: number
) {
  const variants = buildSearchVariants(rawQuery);
  const ftsQuery = normalizeSearchInput(rawQuery);
  const ilikeFilter = buildIlikeOrFilter(
    ["name", "slug", "provider", "description", "short_description"],
    variants
  );

  const modelQuery = queryClient.from("models") as SearchModelsTableQuery;
  const modelSelect = modelQuery.select(SEARCH_MODEL_SELECT, {
    count: "exact",
  });

  const ftsChain = modelSelect
    .textSearch("fts", ftsQuery || rawQuery)
    .eq("status", "active")
    .order("popularity_score", { ascending: false, nullsFirst: false });
  const ilikeChain = (queryClient.from("models") as SearchModelsTableQuery)
    .select(SEARCH_MODEL_SELECT, { count: "exact" })
    .eq("status", "active")
    .or(ilikeFilter)
    .order("popularity_score", { ascending: false, nullsFirst: false });

  const [ftsResult, ilikeResult] = await Promise.all([
    "range" in ftsChain && typeof ftsChain.range === "function"
      ? ftsChain.range(0, fetchLimit - 1)
      : ftsChain.limit(fetchLimit),
    "range" in ilikeChain && typeof ilikeChain.range === "function"
      ? ilikeChain.range(0, fetchLimit - 1)
      : ilikeChain.limit(fetchLimit),
  ]);

  if (ilikeResult.error) {
    throw ilikeResult.error;
  }

  const merged = new Map<string, SearchQueryModelRow>();

  if (!ftsResult.error) {
    for (const row of ftsResult.data ?? []) {
      if (typeof row.id === "string") merged.set(row.id, row);
    }
  }

  for (const row of ilikeResult.data ?? []) {
    if (typeof row.id === "string" && !merged.has(row.id)) {
      merged.set(row.id, row);
    }
  }

  return {
    data: [...merged.values()] as SearchQueryModelRow[],
    count: merged.size,
  };
}
