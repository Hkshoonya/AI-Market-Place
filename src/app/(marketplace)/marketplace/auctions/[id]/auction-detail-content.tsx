"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import {
  ArrowLeft,
  Gavel,
  TrendingDown,
  Layers,
  AlertCircle,
  Loader2,
  Wallet,
  Clock,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuth } from "@/components/auth/auth-provider";
import { SWR_TIERS } from "@/lib/swr/config";
import type { Auction } from "@/types/auction";
import { useAuctionTimer } from "@/hooks/use-auction-timer";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { BidHistoryTable } from "@/components/marketplace/bid-history-table";
import { EnglishBidPanel } from "@/components/marketplace/english-bid-panel";
import { DutchBidPanel } from "@/components/marketplace/dutch-bid-panel";
import { WalletDepositPanel } from "@/components/marketplace/wallet-deposit-panel";

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
// Main Component
// ────────────────────────────────────────────────────────────

export default function AuctionDetailContent({
  auctionId,
}: {
  auctionId: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore clipboard failures in the auction sidebar
    }
  }, []);

  const { data: auction, error, isLoading, mutate } = useSWR<Auction>(
    `/api/marketplace/auctions/${auctionId}`,
    { ...SWR_TIERS.FAST }
  );

  const { timeRemaining, dutchPrice } = useAuctionTimer({ auction: auction ?? null });
  const { walletData, loadingWallet } = useWalletBalance({
    enabled: !!user,
  });

  // Loading state
  if (isLoading || authLoading) {
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
        <p className="text-sm font-medium">{error?.message || "Auction not found"}</p>
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
  const englishMinimumBid =
    (auction.current_price ?? auction.start_price) + (auction.bid_increment || 1);
  const minimumActionAmount =
    auction.auction_type === "english"
      ? englishMinimumBid
      : auction.auction_type === "dutch"
        ? dutchPrice ?? auction.current_price ?? auction.start_price
        : auction.current_price ?? auction.start_price;
  const hasEnoughBalance =
    walletData != null && walletData.balance >= minimumActionAmount;

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
                      <Image
                        src={auction.seller.avatar_url}
                        alt={auction.seller.display_name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                        unoptimized
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
                    onBidPlaced={() => mutate()}
                  />
                )}

                {auction.auction_type === "dutch" && (
                  <DutchBidPanel
                    auction={auction}
                    dutchPrice={dutchPrice}
                    timeRemaining={timeRemaining}
                    onAccepted={() => mutate()}
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

            {/* Wallet balance */}
            {user && (
              <Card className="mt-4 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" />
                    <span>Your Wallet</span>
                  </div>
                  {loadingWallet ? (
                    <div className="mt-3 space-y-2">
                      <div className="h-7 w-28 animate-pulse rounded bg-secondary" />
                      <div className="h-4 w-full animate-pulse rounded bg-secondary" />
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Available Balance
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-foreground">
                            {formatCurrency(walletData?.balance ?? 0)}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            hasEnoughBalance
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          )}
                        >
                          {hasEnoughBalance ? "Ready" : "Needs Funding"}
                        </Badge>
                      </div>

                      <p className="text-xs leading-5 text-muted-foreground">
                        {hasEnoughBalance
                          ? `You have enough wallet balance for the next ${auction.auction_type === "english" ? "bid" : "action"} at ${formatCurrency(minimumActionAmount)}.`
                          : `You need ${formatCurrency(minimumActionAmount)} available to ${auction.auction_type === "english" ? "place the next bid" : auction.auction_type === "dutch" ? "accept the current price" : "participate"} from this panel.`}
                      </p>

                      {!hasEnoughBalance && (
                        <WalletDepositPanel
                          walletData={walletData}
                          price={minimumActionAmount}
                          copiedField={copiedField}
                          onCopy={copyToClipboard}
                        />
                      )}

                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link href="/wallet">Open Wallet</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
