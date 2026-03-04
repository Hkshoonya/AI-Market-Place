"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Gavel,
  TrendingDown,
  Layers,
  Clock,
  ArrowRight,
  Package,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface Auction {
  id: string;
  listing_id: string;
  auction_type: "english" | "dutch" | "batch";
  status: "active" | "upcoming" | "ended" | "cancelled";
  start_price: number;
  current_price: number | null;
  floor_price: number | null;
  price_decrement: number | null;
  decrement_interval_seconds: number | null;
  bid_increment: number | null;
  bid_count: number;
  starts_at: string;
  ends_at: string;
  created_at: string;
  listing?: {
    id: string;
    title: string;
    slug: string;
    short_description?: string;
    listing_type: string;
    thumbnail_url?: string;
  };
  seller?: {
    display_name: string;
    username: string;
    seller_verified: boolean;
  };
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const AUCTION_TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "english", label: "English", icon: Gavel },
  { value: "dutch", label: "Dutch", icon: TrendingDown },
  { value: "batch", label: "Batch", icon: Layers },
] as const;

const SORT_OPTIONS = [
  { value: "ending_soon", label: "Ending Soon" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price Low-High" },
  { value: "price_desc", label: "Price High-Low" },
] as const;

type AuctionTypeFilter = (typeof AUCTION_TYPE_TABS)[number]["value"];
type SortOption = (typeof SORT_OPTIONS)[number]["value"];

const TYPE_BADGE_STYLES: Record<string, string> = {
  english: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  dutch: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  batch: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  upcoming: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  ended: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function calculateDutchPrice(auction: Auction): number {
  const elapsed =
    (Date.now() - new Date(auction.starts_at).getTime()) / 1000;
  const intervals = Math.floor(
    elapsed / (auction.decrement_interval_seconds || 60)
  );
  const drop = intervals * (auction.price_decrement || 0);
  return Math.max(auction.start_price - drop, auction.floor_price || 0);
}

function formatTimeRemaining(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getDisplayPrice(auction: Auction): number {
  if (auction.auction_type === "dutch" && auction.status === "active") {
    return calculateDutchPrice(auction);
  }
  return auction.current_price ?? auction.start_price;
}

// ────────────────────────────────────────────────────────────
// Auction Card
// ────────────────────────────────────────────────────────────

function AuctionCard({
  auction,
  dutchPrice,
}: {
  auction: Auction;
  dutchPrice?: number;
}) {
  const price =
    auction.auction_type === "dutch" && dutchPrice != null
      ? dutchPrice
      : getDisplayPrice(auction);

  const startPrice = auction.start_price;
  const priceChanged = Math.abs(price - startPrice) > 0.001;
  const timeStr = formatTimeRemaining(auction.ends_at);
  const isEnded = auction.status === "ended" || timeStr === "Ended";
  const isUpcoming = auction.status === "upcoming";

  const actionLabel =
    auction.auction_type === "english"
      ? "Bid Now"
      : auction.auction_type === "dutch"
        ? "Accept Price"
        : "View";

  return (
    <Link href={`/marketplace/auctions/${auction.id}`}>
      <Card className="group h-full cursor-pointer border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon">
        <CardContent className="p-5">
          {/* Top row: type + status badges */}
          <div className="flex items-center justify-between gap-2">
            <Badge
              variant="outline"
              className={cn("text-[11px]", TYPE_BADGE_STYLES[auction.auction_type])}
            >
              {auction.auction_type === "english" && (
                <Gavel className="mr-1 h-3 w-3" />
              )}
              {auction.auction_type === "dutch" && (
                <TrendingDown className="mr-1 h-3 w-3" />
              )}
              {auction.auction_type === "batch" && (
                <Layers className="mr-1 h-3 w-3" />
              )}
              {auction.auction_type.charAt(0).toUpperCase() +
                auction.auction_type.slice(1)}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                STATUS_BADGE_STYLES[auction.status] ||
                  STATUS_BADGE_STYLES.ended
              )}
            >
              {auction.status.charAt(0).toUpperCase() +
                auction.status.slice(1)}
            </Badge>
          </div>

          {/* Title */}
          <h3 className="mt-3 text-sm font-semibold group-hover:text-neon transition-colors line-clamp-2">
            {auction.listing?.title || "Untitled Auction"}
          </h3>

          {/* Seller */}
          {auction.seller && (
            <p className="mt-1 text-xs text-muted-foreground">
              by {auction.seller.display_name}
              {auction.seller.seller_verified && (
                <span className="ml-1 text-neon" title="Verified Seller">
                  &#10003;
                </span>
              )}
            </p>
          )}

          {/* Price section */}
          <div className="mt-4 space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-emerald-400">
                {formatCurrency(price)}
              </span>
              {priceChanged && (
                <span className="text-xs text-muted-foreground line-through">
                  {formatCurrency(startPrice)}
                </span>
              )}
            </div>

            {auction.auction_type === "english" && (
              <p className="text-xs text-muted-foreground">
                {auction.bid_count}{" "}
                {auction.bid_count === 1 ? "bid" : "bids"}
              </p>
            )}

            {auction.auction_type === "dutch" && auction.status === "active" && (
              <p className="text-xs text-purple-400">
                Drops {formatCurrency(auction.price_decrement ?? 0)} every{" "}
                {auction.decrement_interval_seconds ?? 60}s
              </p>
            )}
          </div>

          {/* Footer: time remaining + action */}
          <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className={cn(isEnded && "text-red-400")}>
                {isUpcoming ? "Starts soon" : timeStr}
              </span>
            </div>

            <Button
              size="xs"
              className={cn(
                "text-xs font-medium",
                isEnded || isUpcoming
                  ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  : "bg-neon text-background hover:bg-neon/90"
              )}
              tabIndex={-1}
            >
              {isEnded ? "View" : isUpcoming ? "Preview" : actionLabel}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ────────────────────────────────────────────────────────────
// Main Content
// ────────────────────────────────────────────────────────────

export default function AuctionsBrowseContent() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<AuctionTypeFilter>("all");
  const [sort, setSort] = useState<SortOption>("ending_soon");
  const [dutchPrices, setDutchPrices] = useState<Record<string, number>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch auctions
  const fetchAuctions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      params.set("sort", sort);

      const res = await fetch(
        `/api/marketplace/auctions?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch auctions");
      const data = await res.json();
      setAuctions(data.auctions ?? data ?? []);
    } catch {
      setAuctions([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, sort]);

  useEffect(() => {
    setLoading(true);
    fetchAuctions();
  }, [fetchAuctions]);

  // Refresh Dutch prices every 10 seconds
  useEffect(() => {
    function refreshDutchPrices() {
      const prices: Record<string, number> = {};
      for (const a of auctions) {
        if (a.auction_type === "dutch" && a.status === "active") {
          prices[a.id] = calculateDutchPrice(a);
        }
      }
      setDutchPrices(prices);
    }

    refreshDutchPrices();

    intervalRef.current = setInterval(refreshDutchPrices, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [auctions]);

  // Client-side sort (secondary to server sort)
  const sortedAuctions = [...auctions].sort((a, b) => {
    switch (sort) {
      case "ending_soon":
        return (
          new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime()
        );
      case "newest":
        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      case "price_asc":
        return getDisplayPrice(a) - getDisplayPrice(b);
      case "price_desc":
        return getDisplayPrice(b) - getDisplayPrice(a);
      default:
        return 0;
    }
  });

  const filteredAuctions =
    typeFilter === "all"
      ? sortedAuctions
      : sortedAuctions.filter((a) => a.auction_type === typeFilter);

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Gavel className="h-6 w-6 text-neon" />
          <h1 className="text-2xl font-bold">Auctions</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Browse and bid on AI models, APIs, datasets, and more in live
          auctions.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-card p-4">
        {/* Type tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {AUCTION_TYPE_TABS.map((tab) => {
            const Icon = tab.value !== "all" ? tab.icon : null;
            return (
              <Badge
                key={tab.value}
                variant="outline"
                className={cn(
                  "cursor-pointer text-xs transition-colors",
                  typeFilter === tab.value
                    ? "border-neon/30 bg-neon/10 text-neon hover:bg-neon/20"
                    : "border-border/50 text-muted-foreground hover:border-neon/30 hover:text-foreground"
                )}
                onClick={() => setTypeFilter(tab.value)}
                role="button"
                aria-pressed={typeFilter === tab.value}
              >
                {Icon && <Icon className="mr-1 h-3 w-3" />}
                {tab.label}
              </Badge>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sort */}
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="group"
          aria-label="Sort options"
        >
          Sort:
          {SORT_OPTIONS.map((opt) => (
            <Badge
              key={opt.value}
              variant="outline"
              className={cn(
                "cursor-pointer text-xs transition-colors",
                sort === opt.value
                  ? "border-neon/30 text-neon"
                  : "border-border/50 hover:border-neon/30 hover:text-foreground"
              )}
              onClick={() => setSort(opt.value)}
              role="button"
              aria-pressed={sort === opt.value}
              aria-label={`Sort by ${opt.label}`}
            >
              {opt.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">
            {filteredAuctions.length}
          </span>{" "}
          {filteredAuctions.length === 1 ? "auction" : "auctions"}
        </p>
      </div>

      {/* Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-neon" />
            <p className="text-sm text-muted-foreground">
              Loading auctions...
            </p>
          </div>
        ) : filteredAuctions.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center gap-2">
              <Package className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                No auctions found
              </p>
              <p className="text-xs text-muted-foreground/70">
                Try adjusting your filters or check back soon.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAuctions.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                dutchPrice={dutchPrices[auction.id]}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
