import Link from "next/link";
import { ArrowRight, Gavel, ShoppingBag, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryCards } from "@/components/marketplace/category-cards";
import { ListingsGrid } from "@/components/marketplace/listings-grid";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseQueryResult } from "@/lib/schemas/parse";
import { MarketplaceListingSchema } from "@/lib/schemas/marketplace";
import { enrichListingsWithProfiles, PROFILE_FIELDS_CARD } from "@/lib/marketplace/enrich-listings";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Marketplace",
  description: "Buy and sell AI models, APIs, datasets, and fine-tuned models.",
};

export const revalidate = 3600;

export default async function MarketplacePage() {
  const supabase = await createClient();

  // Fetch type counts
  const listingTypeResponse = await supabase
    .from("marketplace_listings")
    .select("listing_type")
    .eq("status", "active");

  const ListingTypeSchema = z.object({ listing_type: z.string() });
  const allListings = parseQueryResult(listingTypeResponse, ListingTypeSchema, "MarketplaceListingType");

  const counts: Record<string, number> = {};
  for (const l of allListings) {
    counts[l.listing_type] = (counts[l.listing_type] || 0) + 1;
  }

  // Fetch featured listings (up to 6)
  // NOTE: is_featured column may not exist yet — order by created_at only
  // When migration adds the column, re-enable: .order("is_featured", { ascending: false })
  const featuredResponse = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(6);

  const rawFeatured = parseQueryResult(featuredResponse, MarketplaceListingSchema, "MarketplaceFeatured");

  // Enrich with seller profiles (no FK constraint exists, so fetch separately)
  const featured = await enrichListingsWithProfiles(
    supabase,
    rawFeatured,
    PROFILE_FIELDS_CARD
  );

  const totalCount = allListings?.length || 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <ShoppingBag className="h-6 w-6 text-neon" />
              <h1 className="text-2xl font-bold">AI Marketplace</h1>
            </div>
            <p className="mt-2 text-muted-foreground">
              Buy and sell AI models, APIs, datasets, and more.{" "}
              <span className="text-foreground font-medium">{totalCount}</span> listings available.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/marketplace/auctions">
                <Gavel className="mr-2 h-4 w-4" />
                Auctions
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/marketplace/browse">
                Browse All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button className="bg-neon text-background font-semibold hover:bg-neon/90" asChild>
              <Link href="/sell">
                Start Selling
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Category Cards */}
      <CategoryCards counts={counts} />

      {/* Featured Listings */}
      <div className="mt-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-neon" />
            <h2 className="text-xl font-bold">Featured Listings</h2>
          </div>
          <Button variant="ghost" size="sm" className="text-neon" asChild>
            <Link href="/marketplace/browse">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-6">
          <ListingsGrid listings={featured as import("@/types/database").MarketplaceListingWithSeller[]} />
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-xl border border-neon/20 bg-gradient-to-r from-neon/5 via-neon/10 to-neon/5 p-8 text-center md:flex md:items-center md:justify-between md:text-left">
        <div>
          <h2 className="text-xl font-bold">Have an AI model to sell?</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Join AI creators selling their models, APIs, and datasets on AI Market Cap.
          </p>
        </div>
        <Button className="mt-4 bg-neon text-background font-semibold hover:bg-neon/90 md:mt-0" asChild>
          <Link href="/sell">
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
