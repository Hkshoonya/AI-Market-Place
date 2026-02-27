import { createClient } from "@/lib/supabase/server";
import { MarketplaceFilterBar } from "@/components/marketplace/filter-bar";
import { ListingsGrid } from "@/components/marketplace/listings-grid";
import { Pagination } from "@/components/models/pagination";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Marketplace",
  description: "Browse AI models, APIs, datasets, and more on the AI Marketplace.",
};

export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 18;

export default async function BrowsePage(props: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const type = searchParams.type || "";
  const sort = searchParams.sort || "newest";
  const page = parseInt(searchParams.page || "1");
  const search = searchParams.q || "";

  const supabase = await createClient();

  let query = (supabase as any)
    .from("marketplace_listings")
    .select("*, profiles!marketplace_listings_seller_id_fkey(id, display_name, avatar_url, username, is_seller, seller_verified, seller_rating, total_sales)", { count: "exact" })
    .eq("status", "active");

  if (type) query = query.eq("listing_type", type);
  if (search) query = query.textSearch("fts", search);

  const sortMap: Record<string, { column: string; ascending: boolean }> = {
    newest: { column: "created_at", ascending: false },
    price_asc: { column: "price", ascending: true },
    price_desc: { column: "price", ascending: false },
    rating: { column: "avg_rating", ascending: false },
    popular: { column: "view_count", ascending: false },
  };

  const sortConfig = sortMap[sort] || sortMap.newest;
  query = query.order(sortConfig.column, { ascending: sortConfig.ascending, nullsFirst: false });

  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;
  query = query.range(from, to);

  const { data, count } = await query;
  const totalCount = count || 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Browse Marketplace</h1>

      <MarketplaceFilterBar totalCount={totalCount} />

      <div className="mt-6">
        <ListingsGrid listings={data || []} />
      </div>

      {totalCount > ITEMS_PER_PAGE && (
        <div className="mt-8">
          <Pagination
            totalCount={totalCount}
            pageSize={ITEMS_PER_PAGE}
            basePath="/marketplace/browse"
          />
        </div>
      )}
    </div>
  );
}
