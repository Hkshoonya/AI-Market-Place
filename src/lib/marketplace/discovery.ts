import type { MarketplaceListingWithSeller } from "@/types/database";
import type { MarketplaceSortOption } from "@/lib/constants/marketplace";

export interface MarketplaceDiscoveryFilters {
  autonomy?: string | null;
  contract?: string | null;
  sellerId?: string | null;
  sellerMode?: string | null;
}

type DiscoveryListing = Pick<
  MarketplaceListingWithSeller,
  | "seller_id"
  | "price"
  | "pricing_type"
  | "avg_rating"
  | "review_count"
  | "view_count"
  | "inquiry_count"
  | "purchase_count"
  | "created_at"
  | "is_featured"
  | "purchase_mode"
  | "autonomy_mode"
  | "preview_manifest"
  | "mcp_manifest"
  | "agent_config"
  | "agent_id"
> & {
  profiles?: Pick<
    NonNullable<MarketplaceListingWithSeller["profiles"]>,
    "seller_verified" | "total_sales"
  > | null;
};

function hasManifest(listing: DiscoveryListing): boolean {
  return Boolean(
    listing.preview_manifest ||
      listing.mcp_manifest ||
      (listing.agent_config && typeof listing.agent_config === "object")
  );
}

function getTrustScore(listing: DiscoveryListing): number {
  let score = 0;

  score += listing.profiles?.seller_verified ? 28 : 8;
  score += Math.min(listing.profiles?.total_sales ?? 0, 200) * 0.15;
  score += (listing.avg_rating ?? 0) * 16;
  score += Math.min(listing.review_count, 40) * 0.7;
  score += hasManifest(listing) ? 8 : 0;
  score += listing.is_featured ? 4 : 0;

  switch (listing.purchase_mode) {
    case "purchase_blocked":
      score -= 40;
      break;
    case "manual_review_required":
      score -= 6;
      break;
    default:
      score += 10;
      break;
  }

  switch (listing.autonomy_mode) {
    case "autonomous_allowed":
      score += 6;
      break;
    case "restricted":
      score += 2;
      break;
    case "autonomous_blocked":
      score -= 4;
      break;
    default:
      break;
  }

  return score;
}

function getAutonomyScore(listing: DiscoveryListing): number {
  let score = 0;

  switch (listing.autonomy_mode) {
    case "autonomous_allowed":
      score += 75;
      break;
    case "restricted":
      score += 48;
      break;
    case "manual_only":
      score += 16;
      break;
    case "autonomous_blocked":
      score -= 24;
      break;
    default:
      score += 12;
      break;
  }

  score += hasManifest(listing) ? 24 : 0;
  score += listing.agent_id ? 10 : 0;
  score += listing.profiles?.seller_verified ? 6 : 0;
  score += listing.purchase_mode === "public_purchase_allowed" ? 5 : 0;

  return score;
}

function getAffordabilityScore(listing: DiscoveryListing): number {
  if (listing.pricing_type === "free") return 42;
  if (listing.pricing_type === "contact") return 6;

  const price = listing.price ?? Number.POSITIVE_INFINITY;

  switch (listing.pricing_type) {
    case "monthly_subscription":
      if (price <= 15) return 32;
      if (price <= 30) return 25;
      if (price <= 60) return 18;
      if (price <= 120) return 10;
      return 2;
    case "per_token":
      if (price <= 3) return 34;
      if (price <= 10) return 26;
      if (price <= 20) return 16;
      if (price <= 40) return 8;
      return 2;
    case "per_request":
      if (price <= 0.01) return 34;
      if (price <= 0.05) return 24;
      if (price <= 0.25) return 14;
      return 4;
    case "one_time":
    default:
      if (price <= 25) return 28;
      if (price <= 75) return 20;
      if (price <= 200) return 12;
      if (price <= 500) return 6;
      return 2;
  }
}

function getValueScore(listing: DiscoveryListing): number {
  let score = 0;

  score += getAffordabilityScore(listing);
  score += (listing.avg_rating ?? 0) * 12;
  score += Math.min(listing.review_count, 30) * 0.5;
  score += hasManifest(listing) ? 8 : 0;
  score += listing.profiles?.seller_verified ? 6 : 0;
  score += listing.autonomy_mode === "autonomous_allowed" ? 6 : 0;
  score += Math.min(listing.view_count, 1_000) / 100;
  score += Math.min(listing.purchase_count, 100) * 0.4;

  return score;
}

function comparePrices(
  a: DiscoveryListing,
  b: DiscoveryListing,
  direction: "asc" | "desc"
): number {
  if (a.price == null && b.price == null) return 0;
  if (a.price == null) return 1;
  if (b.price == null) return -1;

  return direction === "asc" ? a.price - b.price : b.price - a.price;
}

function compareDatesDesc(a: DiscoveryListing, b: DiscoveryListing): number {
  return (
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function sortByScore(
  listings: MarketplaceListingWithSeller[],
  score: (listing: DiscoveryListing) => number
): MarketplaceListingWithSeller[] {
  return [...listings].sort((a, b) => {
    const difference = score(b) - score(a);
    if (difference !== 0) return difference;

    if ((b.avg_rating ?? 0) !== (a.avg_rating ?? 0)) {
      return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
    }

    return compareDatesDesc(a, b);
  });
}

export function filterMarketplaceListings(
  listings: MarketplaceListingWithSeller[],
  filters: MarketplaceDiscoveryFilters
): MarketplaceListingWithSeller[] {
  return listings.filter((listing) => {
    if (filters.autonomy === "ready" && listing.autonomy_mode !== "autonomous_allowed") {
      return false;
    }

    if (filters.contract === "manifest" && !hasManifest(listing)) {
      return false;
    }

    if (filters.sellerId && listing.seller_id !== filters.sellerId) {
      return false;
    }

    if (filters.sellerMode === "agent" && !listing.agent_id) {
      return false;
    }

    if (filters.sellerMode === "human" && listing.agent_id) {
      return false;
    }

    return true;
  });
}

export function sortMarketplaceListings(
  listings: MarketplaceListingWithSeller[],
  sort: MarketplaceSortOption
): MarketplaceListingWithSeller[] {
  switch (sort) {
    case "price_asc":
      return [...listings].sort((a, b) => {
        const difference = comparePrices(a, b, "asc");
        if (difference !== 0) return difference;
        return compareDatesDesc(a, b);
      });
    case "price_desc":
      return [...listings].sort((a, b) => {
        const difference = comparePrices(a, b, "desc");
        if (difference !== 0) return difference;
        return compareDatesDesc(a, b);
      });
    case "rating":
      return [...listings].sort((a, b) => {
        const ratingDifference = (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
        if (ratingDifference !== 0) return ratingDifference;

        const reviewDifference = b.review_count - a.review_count;
        if (reviewDifference !== 0) return reviewDifference;

        return compareDatesDesc(a, b);
      });
    case "popular":
      return [...listings].sort((a, b) => {
        const popularityA =
          a.view_count + a.inquiry_count * 4 + a.purchase_count * 10;
        const popularityB =
          b.view_count + b.inquiry_count * 4 + b.purchase_count * 10;
        if (popularityB !== popularityA) return popularityB - popularityA;
        return compareDatesDesc(a, b);
      });
    case "trust":
      return sortByScore(listings, getTrustScore);
    case "autonomous":
      return sortByScore(listings, getAutonomyScore);
    case "value":
      return sortByScore(listings, getValueScore);
    case "newest":
    default:
      return [...listings].sort(compareDatesDesc);
  }
}

export function paginateMarketplaceListings<T>(
  listings: T[],
  page: number,
  limit: number
): T[] {
  const from = Math.max(0, (page - 1) * limit);
  return listings.slice(from, from + limit);
}
