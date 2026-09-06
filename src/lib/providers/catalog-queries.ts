import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public-server";

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

type PublicPage<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

// Supabase caps each response. Callers must supply a stable, unique ordering.
export async function fetchAllPublicPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PublicPage<T>>,
  cacheKey?: string
): Promise<{ data: T[]; error: null }> {
  const loadPage = async (from: number, to: number) => {
    const result = await fetchPage(from, to);
    if (result.error || !result.data) {
      throw new Error("Unable to load the complete public provider catalog");
    }
    return result.data;
  };
  // Only public queries use this helper. Keys must include every closed-over filter.
  const readPage = cacheKey
    ? unstable_cache(loadPage, ["public-provider-catalog-v1", cacheKey], { revalidate: 300 })
    : loadPage;
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const data = await readPage(from, from + PAGE_SIZE - 1);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return { data: rows, error: null };
  }
  throw new Error("Public provider catalog exceeded its pagination safety limit");
}

// Share the provider lookup between metadata and page rendering in one request.
export const getActiveProviderNames = cache(async () => {
  const supabase = createPublicClient();
  const { data } = await fetchAllPublicPages((from, to) =>
    supabase.from("models").select("provider").eq("status", "active")
      .order("id").range(from, to),
    "active-provider-names"
  );
  return [...new Set(data.map((row) => row.provider))];
});
