import { createClient } from "@/lib/supabase/server";
import { MarketplaceFilterBar } from "@/components/marketplace/filter-bar";
import { ListingsGrid } from "@/components/marketplace/listings-grid";
import { Pagination } from "@/components/models/pagination";
import { LISTING_TYPE_MAP } from "@/lib/constants/marketplace";
import { enrichListingsWithProfiles } from "@/lib/marketplace/enrich-listings";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 18;

export async function generateMetadata(props: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const type = searchParams.type || "";
  const search = searchParams.q || "";

  const typeConfig = type
    ? LISTING_TYPE_MAP[type as keyof typeof LISTING_TYPE_MAP]
    : null;

  if (search) {
    return {
      title: `Search: "${search}" - Marketplace`,
      description: `Search results for "${search}" on the AI Market Cap marketplace.`,
    };
  }

  if (typeConfig) {
    return {
      title: `${typeConfig.label} - AI Marketplace`,
      description: `Browse ${typeConfig.label.toLowerCase()} listings. ${typeConfig.description} on AI Market Cap.`,
      openGraph: {
        title: `${typeConfig.label} - AI Marketplace`,
        description: `Browse ${typeConfig.label.toLowerCase()} on the AI Market Cap marketplace.`,
      },
    };
  }

  return {
    title: "Browse Marketplace",
    description:
      "Browse AI models, APIs, datasets, and more on the AI Marketplace.",
  };
}

export default async function BrowsePage(props: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const type = searchParams.type || "";
  const sort = searchParams.sort || "newest";
  const page = parseInt(searchParams.page || "1");
  const search = searchParams.q || "";

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("marketplace_listings")
    .select("*", { count: "exact" })
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
  query = query.order(sortConfig.column, {
    ascending: sortConfig.ascending,
    nullsFirst: false,
  });

  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;
  query = query.range(from, to);

  const { data: rawData, count } = await query;
  const totalCount = count || 0;

  // Enrich with seller profiles (no FK constraint exists, so fetch separately)
  // Cast to any — shape is compatible with MarketplaceListingWithSeller
  const data = await enrichListingsWithProfiles(supabase as any, rawData || []) as any[];

  const typeConfig = type
    ? LISTING_TYPE_MAP[type as keyof typeof LISTING_TYPE_MAP]
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">
        {search
          ? `Search: "${search}"`
          : typeConfig
            ? typeConfig.label
            : "Browse Marketplace"}
      </h1>
      {typeConfig && (
        <p className="mb-6 text-sm text-muted-foreground">
          {typeConfig.description}
        </p>
      )}
      {!typeConfig && !search && (
        <p className="mb-6 text-sm text-muted-foreground">
          Discover AI models, APIs, datasets, and more.
        </p>
      )}

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
