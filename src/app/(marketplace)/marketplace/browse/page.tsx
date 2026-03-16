import { createPublicClient } from "@/lib/supabase/public-server";
import { parseQueryResult } from "@/lib/schemas/parse";
import { MarketplaceListingSchema } from "@/lib/schemas/marketplace";
import { MarketplaceFilterBar } from "@/components/marketplace/filter-bar";
import { ListingsGrid } from "@/components/marketplace/listings-grid";
import { Pagination } from "@/components/models/pagination";
import {
  LISTING_TYPE_MAP,
  type MarketplaceSortOption,
} from "@/lib/constants/marketplace";
import { enrichListingsWithProfiles } from "@/lib/marketplace/enrich-listings";
import {
  filterMarketplaceListings,
  paginateMarketplaceListings,
  sortMarketplaceListings,
} from "@/lib/marketplace/discovery";
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
  const sort = (searchParams.sort as MarketplaceSortOption) || "trust";
  const page = parseInt(searchParams.page || "1");
  const search = searchParams.q || "";
  const autonomy = searchParams.autonomy || "";
  const contract = searchParams.contract || "";
  const sellerParam = searchParams.seller || "";
  const sellerMode =
    searchParams.seller_mode || (sellerParam === "agent" ? "agent" : "");
  const seller = sellerParam === "agent" ? "" : sellerParam;

  const supabase = createPublicClient();

  let query = supabase
    .from("marketplace_listings")
    .select("*")
    .eq("status", "active");

  if (type) query = query.eq("listing_type", type as import("@/types/database").ListingType);
  if (search) query = query.textSearch("fts", search);
  if (autonomy === "ready") query = query.eq("autonomy_mode", "autonomous_allowed");
  if (seller) query = query.eq("seller_id", seller);
  if (sellerMode === "agent") query = query.not("agent_id", "is", null);
  if (sellerMode === "human") query = query.is("agent_id", null);
  if (contract === "manifest") {
    query = query.or("preview_manifest.not.is.null,mcp_manifest.not.is.null,agent_config.not.is.null");
  }

  const browseResponse = await query;

  // Enrich with seller profiles (no FK constraint exists, so fetch separately)
  const rawData = parseQueryResult(browseResponse, MarketplaceListingSchema, "MarketplaceBrowse");
  const enriched = await enrichListingsWithProfiles(supabase, rawData);
  const filtered = filterMarketplaceListings(
    enriched as import("@/types/database").MarketplaceListingWithSeller[],
    {
      autonomy,
      contract,
      sellerId: seller,
      sellerMode,
    }
  );
  const sorted = sortMarketplaceListings(filtered, sort);
  const totalCount = sorted.length;
  const data = paginateMarketplaceListings(sorted, page, ITEMS_PER_PAGE);

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
          Discover AI models, APIs, datasets, and more, with dedicated filters for autonomous-ready and manifest-backed listings, plus trust-first marketplace ranking.
        </p>
      )}

      <MarketplaceFilterBar totalCount={totalCount} />

      <div className="mt-6">
        <ListingsGrid listings={data as import("@/types/database").MarketplaceListingWithSeller[]} />
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
