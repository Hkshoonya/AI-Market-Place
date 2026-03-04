"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import Link from "next/link";
import {
  Clock,
  Gavel,
  AlertCircle,
  CheckCircle2,
  Loader2,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/components/auth/auth-provider";
import type { Auction } from "@/types/auction";

interface EnglishBidPanelProps {
  auction: Auction;
  timeRemaining: string;
  onBidPlaced: () => void;
}

export function EnglishBidPanel({
  auction,
  timeRemaining,
  onBidPlaced,
}: EnglishBidPanelProps) {
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
