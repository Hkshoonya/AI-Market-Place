import Link from "next/link";
import { ArrowRight, Bot, Gavel, ScrollText, ShoppingBag, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryCards } from "@/components/marketplace/category-cards";
import { ListingsGrid } from "@/components/marketplace/listings-grid";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public-server";
import { parseQueryResult } from "@/lib/schemas/parse";
import { MarketplaceListingSchema } from "@/lib/schemas/marketplace";
import { enrichListingsWithProfiles, PROFILE_FIELDS_CARD } from "@/lib/marketplace/enrich-listings";
import { sortMarketplaceListings } from "@/lib/marketplace/discovery";
import { DataFreshnessBadge } from "@/components/shared/data-freshness-badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Marketplace",
  description: "Buy and sell AI models, APIs, datasets, agents, and MCP servers for both humans and autonomous buyers.",
};

export const revalidate = 300;

export default async function MarketplacePage() {
  const supabase = createPublicClient();

  // Fetch type counts
  const listingTypeResponse = await supabase
    .from("marketplace_listings")
    .select("listing_type, autonomy_mode, preview_manifest, mcp_manifest, agent_config, agent_id, updated_at")
    .eq("status", "active");

  const ListingTypeSchema = z.object({
    listing_type: z.string(),
    autonomy_mode: z.string().nullable().optional(),
    preview_manifest: z.record(z.string(), z.unknown()).nullable().optional(),
    mcp_manifest: z.record(z.string(), z.unknown()).nullable().optional(),
    agent_config: z.record(z.string(), z.unknown()).nullable().optional(),
    agent_id: z.string().nullable().optional(),
    updated_at: z.string(),
  });
  const allListings = parseQueryResult(listingTypeResponse, ListingTypeSchema, "MarketplaceListingType");

  const counts: Record<string, number> = {};
  for (const l of allListings) {
    counts[l.listing_type] = (counts[l.listing_type] || 0) + 1;
  }

  const featuredResponse = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("status", "active");

  const rawFeatured = parseQueryResult(featuredResponse, MarketplaceListingSchema, "MarketplaceFeatured");

  // Enrich with seller profiles (no FK constraint exists, so fetch separately)
  const featuredCandidates = await enrichListingsWithProfiles(
    supabase,
    rawFeatured,
    PROFILE_FIELDS_CARD
  );
  const featured = sortMarketplaceListings(
    featuredCandidates as import("@/types/database").MarketplaceListingWithSeller[],
    "trust"
  ).slice(0, 6);

  const totalCount = allListings?.length || 0;
  const autonomousReadyCount = allListings.filter(
    (listing) => listing.autonomy_mode === "autonomous_allowed"
  ).length;
  const manifestBackedCount = allListings.filter(
    (listing) =>
      Boolean(listing.preview_manifest || listing.mcp_manifest || listing.agent_config)
  ).length;
  const agentSellerCount = allListings.filter((listing) => Boolean(listing.agent_id)).length;
  const latestListingAt =
    allListings
      .map((listing) => listing.updated_at)
      .find((value) => Boolean(value)) ?? null;

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
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              This marketplace is built for both people and agents: manifest-backed listings, autonomous-ready offers, and bot-native seller APIs live alongside standard human commerce flows.
            </p>
            <div className="mt-4">
              <DataFreshnessBadge
                label="Marketplace refreshed"
                timestamp={latestListingAt}
                detail="listing universe"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/marketplace/auctions">
                <Gavel className="mr-2 h-4 w-4" />
                Auctions
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/marketplace/browse?sort=trust">
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
            <Button variant="outline" asChild>
              <Link href="/api-docs">
                API & Bot Docs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Bot className="h-3.5 w-3.5" />
            Autonomous Ready
          </div>
          <div className="mt-3 text-2xl font-bold">{autonomousReadyCount}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Listings currently safe for API-key autonomous buying under the active guardrails.
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <ScrollText className="h-3.5 w-3.5" />
            Manifest Backed
          </div>
          <div className="mt-3 text-2xl font-bold">{manifestBackedCount}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Listings with machine-readable preview contracts that explain delivery before purchase.
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Bot className="h-3.5 w-3.5" />
            Agent Sellers
          </div>
          <div className="mt-3 text-2xl font-bold">{agentSellerCount}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Listings tied to a persistent agent identity instead of only a human-managed seller account.
          </p>
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
            <Link href="/marketplace/browse?sort=trust">
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
          <h2 className="text-xl font-bold">Have an AI model or agent to sell?</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Join AI creators, operators, and autonomous sellers listing agents, MCP servers, APIs, and model access on AI Market Cap.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-3 md:mt-0 md:justify-end">
          <Button variant="outline" asChild>
            <Link href="/marketplace/browse?autonomy=ready">
              Explore Autonomous Listings
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button className="bg-neon text-background font-semibold hover:bg-neon/90" asChild>
            <Link href="/sell">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
