"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Gavel,
  TrendingDown,
  Layers,
  AlertCircle,
  CheckCircle2,
  Loader2,
  User,
  Wallet,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuth } from "@/components/auth/auth-provider";

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  reserve_price: number | null;
  price_decrement: number | null;
  decrement_interval_seconds: number | null;
  bid_increment: number | null;
  bid_count: number;
  auto_extend_minutes: number | null;
  starts_at: string;
  ends_at: string;
  created_at: string;
  winner_id: string | null;
  listing?: {
    id: string;
    title: string;
    slug: string;
    description?: string;
    short_description?: string;
    listing_type: string;
    thumbnail_url?: string;
  };
  seller?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string;
    seller_verified: boolean;
    seller_rating?: number;
    total_sales?: number;
  };
  bids?: Bid[];
}

interface Bid {
  id: string;
  bidder_id: string;
  amount: number;
  created_at: string;
  bidder?: {
    display_name: string;
    username: string;
  };
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

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

const TYPE_ICONS: Record<string, typeof Gavel> = {
  english: Gavel,
  dutch: TrendingDown,
  batch: Layers,
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
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

// ────────────────────────────────────────────────────────────
// Bid History Table
// ────────────────────────────────────────────────────────────

function BidHistoryTable({ bids }: { bids: Bid[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayBids = expanded ? bids : bids.slice(0, 5);

  if (bids.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No bids yet. Be the first to bid!
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Bidder</th>
              <th className="pb-2 pr-4 font-medium">Amount</th>
              <th className="pb-2 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {displayBids.map((bid, i) => (
              <tr
                key={bid.id}
                className={cn(
                  "border-b border-border/20",
                  i === 0 && "bg-emerald-500/5"
                )}
              >
                <td className="py-2.5 pr-4">
                  <span className="font-medium">
                    {bid.bidder?.display_name || "Anonymous"}
                  </span>
                  {i === 0 && (
                    <Badge
                      variant="outline"
                      className="ml-2 text-[10px] border-emerald-500/30 text-emerald-400"
                    >
                      Highest
                    </Badge>
                  )}
                </td>
                <td className="py-2.5 pr-4 font-semibold text-emerald-400">
                  {formatCurrency(bid.amount)}
                </td>
                <td className="py-2.5 text-muted-foreground">
                  {formatDate(bid.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bids.length > 5 && (
        <button
          className="mt-3 flex items-center gap-1 text-xs text-neon hover:text-neon/80 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : `Show all ${bids.length} bids`}
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// English Bid Panel
// ────────────────────────────────────────────────────────────

function EnglishBidPanel({
  auction,
  timeRemaining,
  onBidPlaced,
}: {
  auction: Auction;
  timeRemaining: string;
  onBidPlaced: () => void;
}) {
  const { user } = useAuth();
  const currentHighest = auction.current_price ?? auction.start_price;
  const minBid = currentHighest + (auction.bid_increment || 1);
  const [bidAmount, setBidAmount] = useState(minBid.toString());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reserveMet =
    auction.reserve_price != null
      ? currentHighest >= auction.reserve_price
      : null;

  const isActive = auction.status === "active" && timeRemaining !== "Ended";

  async function handleBid() {
    setError(null);
    setSuccess(false);
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount < minBid) {
      setError(`Minimum bid is ${formatCurrency(minBid)}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/marketplace/auctions/${auction.id}/bid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to place bid");
      }

      setSuccess(true);
      onBidPlaced();
    } catch (err: any) {
      setError(err.message || "Failed to place bid");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Current bid */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Current Highest Bid
        </p>
        <p className="mt-1 text-2xl font-bold text-emerald-400">
          {formatCurrency(currentHighest)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {auction.bid_count} {auction.bid_count === 1 ? "bid" : "bids"}
        </p>
      </div>

      {/* Reserve indicator */}
      {reserveMet !== null && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
            reserveMet
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
              : "border-amber-500/30 bg-amber-500/5 text-amber-400"
          )}
        >
          {reserveMet ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
          {reserveMet ? "Reserve price met" : "Reserve not met"}
        </div>
      )}

      {/* Time remaining */}
      <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-zinc-900/50 px-3 py-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Time Remaining</p>
          <p
            className={cn(
              "text-sm font-semibold",
              timeRemaining === "Ended" ? "text-red-400" : "text-foreground"
            )}
          >
            {timeRemaining}
          </p>
        </div>
      </div>

      {/* Auto-extend notice */}
      {auction.auto_extend_minutes && isActive && (
        <p className="text-xs text-muted-foreground">
          Auto-extends by {auction.auto_extend_minutes}m if bid placed near
          end.
        </p>
      )}

      {/* Bid input */}
      {!user ? (
        <div className="rounded-lg border border-border/30 bg-zinc-900/50 p-4 text-center">
          <User className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">Sign in to bid</p>
          <p className="text-xs text-muted-foreground">
            You need an account to place bids.
          </p>
          <Button size="sm" className="mt-3" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      ) : isActive ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">
              Your Bid (min {formatCurrency(minBid)})
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                min={minBid}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                className="h-11 bg-zinc-900 pl-7 text-lg font-semibold"
                placeholder={minBid.toString()}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Bid placed successfully!
            </div>
          )}

          <Button
            className="w-full bg-neon text-background font-semibold hover:bg-neon/90"
            size="lg"
            onClick={handleBid}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Placing Bid...
              </>
            ) : (
              <>
                <Gavel className="mr-2 h-4 w-4" />
                Place Bid
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border/30 bg-zinc-900/50 p-4 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            This auction has ended.
          </p>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Dutch Bid Panel
// ────────────────────────────────────────────────────────────

function DutchBidPanel({
  auction,
  dutchPrice,
  timeRemaining,
  onAccepted,
}: {
  auction: Auction;
  dutchPrice: number;
  timeRemaining: string;
  onAccepted: () => void;
}) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isActive = auction.status === "active" && timeRemaining !== "Ended";

  async function handleAccept() {
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    try {
      const res = await fetch(
        `/api/marketplace/auctions/${auction.id}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ price: dutchPrice }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to accept price");
      }

      setSuccess(true);
      onAccepted();
    } catch (err: any) {
      setError(err.message || "Failed to accept price");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Current price */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Current Price
        </p>
        <p className="mt-1 text-2xl font-bold text-emerald-400">
          {formatCurrency(dutchPrice)}
        </p>
        {isActive && (
          <p className="mt-0.5 text-xs text-purple-400 animate-pulse">
            Price updates every {auction.decrement_interval_seconds ?? 60}s
          </p>
        )}
      </div>

      {/* Price info */}
      <div className="space-y-2 rounded-lg border border-border/30 bg-zinc-900/50 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Starting Price</span>
          <span className="font-medium">
            {formatCurrency(auction.start_price)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Floor Price</span>
          <span className="font-medium">
            {formatCurrency(auction.floor_price ?? 0)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Price Drop</span>
          <span className="font-medium text-purple-400">
            {formatCurrency(auction.price_decrement ?? 0)} every{" "}
            {auction.decrement_interval_seconds ?? 60}s
          </span>
        </div>
      </div>

      {/* Time remaining */}
      <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-zinc-900/50 px-3 py-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Time Remaining</p>
          <p
            className={cn(
              "text-sm font-semibold",
              timeRemaining === "Ended" ? "text-red-400" : "text-foreground"
            )}
          >
            {timeRemaining}
          </p>
        </div>
      </div>

      {/* Accept button */}
      {!user ? (
        <div className="rounded-lg border border-border/30 bg-zinc-900/50 p-4 text-center">
          <User className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">Sign in to purchase</p>
          <p className="text-xs text-muted-foreground">
            You need an account to accept the current price.
          </p>
          <Button size="sm" className="mt-3" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      ) : isActive ? (
        <div className="space-y-3">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Price accepted! You won the auction.
            </div>
          )}

          <Button
            className="w-full bg-purple-600 text-white font-semibold hover:bg-purple-500"
            size="lg"
            onClick={handleAccept}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <TrendingDown className="mr-2 h-4 w-4" />
                Accept Price ({formatCurrency(dutchPrice)})
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            First to accept wins. Price may change before confirmation.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/30 bg-zinc-900/50 p-4 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            This auction has ended.
          </p>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────

export default function AuctionDetailContent({
  auctionId,
}: {
  auctionId: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dutchPrice, setDutchPrice] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dutchRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch auction data
  const fetchAuction = useCallback(async () => {
    try {
      const res = await fetch(`/api/marketplace/auctions/${auctionId}`);
      if (!res.ok) throw new Error("Auction not found");
      const data = await res.json();
      setAuction(data);

      if (data.auction_type === "dutch" && data.status === "active") {
        setDutchPrice(calculateDutchPrice(data));
      } else {
        setDutchPrice(data.current_price ?? data.start_price);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load auction");
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    fetchAuction();
  }, [fetchAuction]);

  // Time countdown (every second)
  useEffect(() => {
    if (!auction) return;

    function tick() {
      if (auction) {
        setTimeRemaining(formatTimeRemaining(auction.ends_at));
      }
    }
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [auction]);

  // Dutch price refresh (every 10 seconds)
  useEffect(() => {
    if (!auction || auction.auction_type !== "dutch" || auction.status !== "active")
      return;

    function refreshPrice() {
      if (auction) {
        setDutchPrice(calculateDutchPrice(auction));
      }
    }

    dutchRef.current = setInterval(refreshPrice, 10_000);
    return () => {
      if (dutchRef.current) clearInterval(dutchRef.current);
    };
  }, [auction]);

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <Loader2 className="h-8 w-8 animate-spin text-neon" />
        <p className="text-sm text-muted-foreground">Loading auction...</p>
      </div>
    );
  }

  // Error state
  if (error || !auction) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm font-medium">{error || "Auction not found"}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/marketplace/auctions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Auctions
          </Link>
        </Button>
      </div>
    );
  }

  const TypeIcon = TYPE_ICONS[auction.auction_type] || Gavel;

  return (
    <>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/marketplace/auctions"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-neon transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Auctions
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* ─── Left column (2/3) ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  TYPE_BADGE_STYLES[auction.auction_type]
                )}
              >
                <TypeIcon className="mr-1 h-3 w-3" />
                {auction.auction_type.charAt(0).toUpperCase() +
                  auction.auction_type.slice(1)}{" "}
                Auction
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  STATUS_BADGE_STYLES[auction.status] ||
                    STATUS_BADGE_STYLES.ended
                )}
              >
                {auction.status.charAt(0).toUpperCase() +
                  auction.status.slice(1)}
              </Badge>
            </div>

            <h1 className="mt-3 text-2xl font-bold">
              {auction.listing?.title || "Untitled Auction"}
            </h1>

            {auction.listing?.short_description && (
              <p className="mt-2 text-muted-foreground">
                {auction.listing.short_description}
              </p>
            )}
          </div>

          {/* Description */}
          {auction.listing?.description && (
            <Card className="border-border/50">
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Description
                </h2>
                <div className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {auction.listing.description}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Auction details */}
          <Card className="border-border/50">
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Auction Details
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/30 bg-zinc-900/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    Auction Type
                  </p>
                  <p className="mt-0.5 text-sm font-medium capitalize">
                    {auction.auction_type}
                  </p>
                </div>
                <div className="rounded-lg border border-border/30 bg-zinc-900/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    Starting Price
                  </p>
                  <p className="mt-0.5 text-sm font-medium">
                    {formatCurrency(auction.start_price)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/30 bg-zinc-900/50 p-3">
                  <p className="text-xs text-muted-foreground">Started</p>
                  <p className="mt-0.5 text-sm font-medium">
                    {formatDate(auction.starts_at)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/30 bg-zinc-900/50 p-3">
                  <p className="text-xs text-muted-foreground">Ends</p>
                  <p className="mt-0.5 text-sm font-medium">
                    {formatDate(auction.ends_at)}
                  </p>
                </div>
                {auction.bid_increment && (
                  <div className="rounded-lg border border-border/30 bg-zinc-900/50 p-3">
                    <p className="text-xs text-muted-foreground">
                      Bid Increment
                    </p>
                    <p className="mt-0.5 text-sm font-medium">
                      {formatCurrency(auction.bid_increment)}
                    </p>
                  </div>
                )}
                {auction.auto_extend_minutes && (
                  <div className="rounded-lg border border-border/30 bg-zinc-900/50 p-3">
                    <p className="text-xs text-muted-foreground">
                      Auto Extend
                    </p>
                    <p className="mt-0.5 text-sm font-medium">
                      {auction.auto_extend_minutes} min
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bid history (English auctions) */}
          {auction.auction_type === "english" && (
            <Card className="border-border/50">
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Bid History
                </h2>
                <div className="mt-3">
                  <BidHistoryTable bids={auction.bids || []} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seller info */}
          {auction.seller && (
            <Card className="border-border/50">
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Seller
                </h2>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold">
                    {auction.seller.avatar_url ? (
                      <img
                        src={auction.seller.avatar_url}
                        alt={auction.seller.display_name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      auction.seller.display_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {auction.seller.display_name}
                      {auction.seller.seller_verified && (
                        <span
                          className="ml-1 text-neon"
                          title="Verified Seller"
                        >
                          &#10003;
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{auction.seller.username}
                      {auction.seller.total_sales != null && (
                        <span className="ml-2">
                          {auction.seller.total_sales} sales
                        </span>
                      )}
                      {auction.seller.seller_rating != null && (
                        <span className="ml-2">
                          {auction.seller.seller_rating.toFixed(1)} rating
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ─── Right column (1/3) — Bid Panel ─── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <Card className="border-border/50">
              <CardContent className="p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  {auction.auction_type === "english"
                    ? "Place a Bid"
                    : auction.auction_type === "dutch"
                      ? "Accept Price"
                      : "Auction"}
                </h2>

                {auction.auction_type === "english" && (
                  <EnglishBidPanel
                    auction={auction}
                    timeRemaining={timeRemaining}
                    onBidPlaced={fetchAuction}
                  />
                )}

                {auction.auction_type === "dutch" && (
                  <DutchBidPanel
                    auction={auction}
                    dutchPrice={dutchPrice}
                    timeRemaining={timeRemaining}
                    onAccepted={fetchAuction}
                  />
                )}

                {auction.auction_type === "batch" && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        Current Price
                      </p>
                      <p className="mt-1 text-2xl font-bold text-emerald-400">
                        {formatCurrency(
                          auction.current_price ?? auction.start_price
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-zinc-900/50 px-3 py-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Time Remaining
                        </p>
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            timeRemaining === "Ended"
                              ? "text-red-400"
                              : "text-foreground"
                          )}
                        >
                          {timeRemaining}
                        </p>
                      </div>
                    </div>

                    {!user ? (
                      <div className="rounded-lg border border-border/30 bg-zinc-900/50 p-4 text-center">
                        <User className="mx-auto h-8 w-8 text-muted-foreground/50" />
                        <p className="mt-2 text-sm font-medium">
                          Sign in to participate
                        </p>
                        <Button size="sm" className="mt-3" asChild>
                          <Link href="/login">Sign In</Link>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full bg-amber-600 text-white font-semibold hover:bg-amber-500"
                        size="lg"
                        asChild
                      >
                        <Link
                          href={`/marketplace/${auction.listing?.slug || ""}`}
                        >
                          <Layers className="mr-2 h-4 w-4" />
                          View Listing
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Wallet balance placeholder */}
            {user && (
              <Card className="mt-4 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" />
                    <span>Your Balance</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold">
                    Connect wallet to view balance
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
