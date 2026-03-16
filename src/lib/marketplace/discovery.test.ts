import { describe, expect, it } from "vitest";
import {
  filterMarketplaceListings,
  paginateMarketplaceListings,
  sortMarketplaceListings,
} from "./discovery";
import type { MarketplaceListingWithSeller } from "@/types/database";

function makeListing(
  overrides: Partial<MarketplaceListingWithSeller>
): MarketplaceListingWithSeller {
  return {
    id: "listing-1",
    seller_id: "seller-1",
    slug: "listing-1",
    title: "Listing 1",
    description: "Description",
    short_description: "Short description",
    listing_type: "agent",
    status: "active",
    pricing_type: "monthly_subscription",
    price: 29,
    currency: "USD",
    model_id: null,
    tags: [],
    thumbnail_url: null,
    demo_url: null,
    documentation_url: null,
    view_count: 10,
    inquiry_count: 1,
    purchase_count: 0,
    avg_rating: 4.4,
    review_count: 3,
    is_featured: false,
    purchase_mode: "public_purchase_allowed",
    autonomy_mode: "autonomous_allowed",
    content_risk_level: "allow",
    autonomy_risk_level: "allow",
    agent_config: null,
    mcp_manifest: null,
    preview_manifest: null,
    agent_id: null,
    created_at: "2026-03-16T00:00:00Z",
    updated_at: "2026-03-16T00:00:00Z",
    profiles: {
      id: "seller-1",
      display_name: "Seller",
      avatar_url: null,
      username: "seller",
      is_seller: true,
      seller_verified: false,
      seller_rating: 4.4,
      total_sales: 4,
    },
    ...overrides,
  };
}

describe("filterMarketplaceListings", () => {
  it("supports seller id and seller mode independently", () => {
    const human = makeListing({
      id: "human",
      slug: "human",
      seller_id: "seller-human",
    });
    const agent = makeListing({
      id: "agent",
      slug: "agent",
      seller_id: "seller-agent",
      agent_id: "agent-1",
      preview_manifest: { schema_version: "1.0" },
    });

    expect(
      filterMarketplaceListings([human, agent], { sellerId: "seller-human" }).map(
        (listing) => listing.id
      )
    ).toEqual(["human"]);

    expect(
      filterMarketplaceListings([human, agent], { sellerMode: "agent" }).map(
        (listing) => listing.id
      )
    ).toEqual(["agent"]);
  });
});

describe("sortMarketplaceListings", () => {
  it("prefers verified manifest-backed listings for trust sorting", () => {
    const lowTrust = makeListing({
      id: "low-trust",
      slug: "low-trust",
      profiles: {
        id: "seller-low",
        display_name: "Low",
        avatar_url: null,
        username: "low",
        is_seller: true,
        seller_verified: false,
        seller_rating: 4.1,
        total_sales: 1,
      },
      avg_rating: 4.0,
      review_count: 1,
      preview_manifest: null,
    });
    const highTrust = makeListing({
      id: "high-trust",
      slug: "high-trust",
      profiles: {
        id: "seller-high",
        display_name: "High",
        avatar_url: null,
        username: "high",
        is_seller: true,
        seller_verified: true,
        seller_rating: 4.9,
        total_sales: 30,
      },
      avg_rating: 4.9,
      review_count: 18,
      preview_manifest: { schema_version: "1.0" },
    });

    const sorted = sortMarketplaceListings([lowTrust, highTrust], "trust");
    expect(sorted[0]?.id).toBe("high-trust");
  });

  it("prefers autonomous manifest-backed listings for autonomous sorting", () => {
    const manual = makeListing({
      id: "manual",
      slug: "manual",
      autonomy_mode: "manual_only",
      preview_manifest: null,
    });
    const autonomous = makeListing({
      id: "autonomous",
      slug: "autonomous",
      agent_id: "agent-1",
      preview_manifest: { schema_version: "1.0" },
      autonomy_mode: "autonomous_allowed",
    });

    const sorted = sortMarketplaceListings([manual, autonomous], "autonomous");
    expect(sorted[0]?.id).toBe("autonomous");
  });

  it("balances affordability and quality for value sorting", () => {
    const expensive = makeListing({
      id: "expensive",
      slug: "expensive",
      price: 199,
      avg_rating: 4.6,
      review_count: 5,
    });
    const affordable = makeListing({
      id: "affordable",
      slug: "affordable",
      price: 15,
      avg_rating: 4.6,
      review_count: 5,
      preview_manifest: { schema_version: "1.0" },
      profiles: {
        id: "seller-affordable",
        display_name: "Affordable",
        avatar_url: null,
        username: "affordable",
        is_seller: true,
        seller_verified: true,
        seller_rating: 4.6,
        total_sales: 12,
      },
    });

    const sorted = sortMarketplaceListings([expensive, affordable], "value");
    expect(sorted[0]?.id).toBe("affordable");
  });

  it("keeps unknown-price listings at the end for price sorting", () => {
    const priced = makeListing({
      id: "priced",
      slug: "priced",
      price: 59,
    });
    const unknown = makeListing({
      id: "unknown",
      slug: "unknown",
      pricing_type: "contact",
      price: null,
    });

    expect(sortMarketplaceListings([unknown, priced], "price_asc")[1]?.id).toBe(
      "unknown"
    );
    expect(sortMarketplaceListings([unknown, priced], "price_desc")[1]?.id).toBe(
      "unknown"
    );
  });
});

describe("paginateMarketplaceListings", () => {
  it("returns the correct page slice", () => {
    expect(paginateMarketplaceListings([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
  });
});
