import { cache } from "react";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public-server";
import { ModelBaseSchema } from "@/lib/schemas/models";
import { parseQueryResultPartial } from "@/lib/schemas/parse";
import { fetchAllPublicPages } from "@/lib/providers/catalog-queries";
import { getLifecycleStatuses, parseLifecycleFilter } from "./lifecycle";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";
import { CATEGORY_MAP } from "@/lib/constants/categories";
import type { LicenseType, ModelCategory } from "@/types/database";

const PAGE_SIZE = 500;
const MAX_CANDIDATES = 10_000;
const CACHEABLE_LICENSES: readonly LicenseType[] = ["open_source", "commercial", "research_only", "custom"];

export const DirectoryPricingSchema = z.object({
  provider_name: z.string().nullable().optional(),
  input_price_per_million: z.number().nullable(),
  source: z.string().nullable().optional(),
  output_price_per_million: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
});

export const DirectoryCandidateSchema = ModelBaseSchema.pick({
  id: true, slug: true, name: true, provider: true, category: true, status: true,
  description: true, short_description: true, architecture: true,
  parameter_count: true, context_window: true, release_date: true,
  hf_model_id: true, hf_downloads: true, hf_likes: true, hf_trending_score: true,
  website_url: true, license: true, license_name: true, is_open_weights: true,
  is_api_available: true, overall_rank: true, quality_score: true,
  capability_score: true, popularity_score: true, adoption_score: true,
  economic_footprint_score: true, market_cap_estimate: true,
}).extend({ model_pricing: z.array(DirectoryPricingSchema).optional() });

export const DIRECTORY_CANDIDATE_COLUMNS = Object.keys(DirectoryCandidateSchema.shape)
  .filter((column) => column !== "model_pricing").join(",");

export interface DirectoryFilters {
  category: string;
  sort: string;
  query: string;
  openOnly: boolean;
  provider: string;
  params: string;
  apiOnly: boolean;
  license: string;
  lifecycle: ReturnType<typeof parseLifecycleFilter>;
}

// Include every database filter, but not presentation-only page/view parameters.
export function directoryFilterKey(p: Record<string, string | undefined>): string {
  const sort = p.sort ?? "rank";
  return JSON.stringify({
    category: p.category ?? "",
    sort: ["rank", "quality", "downloads", "newest", "price"].includes(sort) ? sort : "rank",
    query: sanitizeFilterValue(p.q ?? ""),
    openOnly: p.open === "true",
    provider: p.provider ?? "",
    params: ["0-10", "10-70", "70-200", "200+"].includes(p.params ?? "") ? p.params! : "",
    apiOnly: p.api === "true",
    license: p.license ?? "",
    lifecycle: parseLifecycleFilter(p.lifecycle),
  } satisfies DirectoryFilters);
}

async function loadCandidatePage(filterKey: string, from: number) {
  const filters = JSON.parse(filterKey) as DirectoryFilters;
  const pricing = "model_pricing(provider_name,input_price_per_million,output_price_per_million,source,currency)";
  let query = createPublicClient().from("models").select(
    filters.sort === "price" ? `${DIRECTORY_CANDIDATE_COLUMNS},${pricing}` : DIRECTORY_CANDIDATE_COLUMNS,
    from === 0 ? { count: "exact" } : undefined
  );
  query = filters.lifecycle === "all"
    ? query.in("status", getLifecycleStatuses("all"))
    : query.eq("status", "active");
  if (filters.category) query = query.eq("category", filters.category as ModelCategory);
  if (filters.openOnly) query = query.eq("is_open_weights", true);
  if (filters.provider) query = query.eq("provider", filters.provider);
  if (filters.apiOnly) query = query.eq("is_api_available", true);
  if (filters.license) query = query.eq("license", filters.license as LicenseType);
  const billion = 1_000_000_000;
  if (filters.params === "0-10") query = query.lt("parameter_count", 10 * billion);
  if (filters.params === "10-70") query = query.gte("parameter_count", 10 * billion).lt("parameter_count", 70 * billion);
  if (filters.params === "70-200") query = query.gte("parameter_count", 70 * billion).lt("parameter_count", 200 * billion);
  if (filters.params === "200+") query = query.gte("parameter_count", 200 * billion);
  if (filters.query) {
    query = query.or(`name.ilike.%${filters.query}%,provider.ilike.%${filters.query}%,description.ilike.%${filters.query}%`);
  }
  const order = filters.sort === "downloads" ? "hf_downloads"
    : filters.sort === "newest" ? "release_date"
    : filters.sort === "quality" ? "quality_score" : "overall_rank";
  const response = await query.order(order, { ascending: order === "overall_rank", nullsFirst: false })
    .order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
  if (response.error || !response.data) {
    throw new Error("Unable to load the complete models directory");
  }
  return {
    data: parseQueryResultPartial(response, DirectoryCandidateSchema, "DirectoryCandidates"),
    count: response.count,
    fetched: response.data.length,
  };
}

// Cache small pages rather than the whole catalogue. Never cache auth clients.
const readCandidatePage = unstable_cache(loadCandidatePage,
  ["public-model-directory-candidates-v1"], { revalidate: 300 });

export const getDirectoryCandidates = cache(async (filterKey: string) => {
  const filters = JSON.parse(filterKey) as DirectoryFilters;
  // Only finite filter combinations enter the persistent public cache.
  const unboundedFilter = filters.query || filters.provider ||
    (filters.category && !Object.hasOwn(CATEGORY_MAP, filters.category)) ||
    (filters.license && !CACHEABLE_LICENSES.includes(filters.license as LicenseType));
  const readPage = unboundedFilter ? loadCandidatePage : readCandidatePage;
  const first = await readPage(filterKey, 0);
  const data = [...first.data];
  const rowsToLoad = Math.min(first.count ?? first.fetched, MAX_CANDIDATES);
  // Limit simultaneous reads on the small database instead of a nine-query burst.
  for (let from = PAGE_SIZE; from < rowsToLoad; from += PAGE_SIZE * 2) {
    const starts = [from, from + PAGE_SIZE].filter((start) => start < rowsToLoad);
    const pages = await Promise.all(starts.map((start) => readPage(filterKey, start)));
    for (const page of pages) data.push(...page.data);
  }
  return { data, count: first.count };
});

export const getDirectoryDeployments = cache(async () => {
  const supabase = createPublicClient();
  // Public availability is small enough to read once. Thousands of UUIDs in an
  // IN URL produced HTTP 414, and an unpaginated read would lose rows after 1000.
  const { data } = await fetchAllPublicPages((from, to) => supabase
    .from("model_deployments")
    .select("id,model_id,platform_id,pricing_model,price_per_unit,unit_description,free_tier,one_click,status")
    .eq("status", "available").order("id", { ascending: true }).range(from, to),
  "directory-available-deployments-v1");
  return data;
});
