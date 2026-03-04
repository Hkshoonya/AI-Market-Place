"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import Link from "next/link";
import {
  Clock,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/components/auth/auth-provider";
import type { Auction } from "@/types/auction";

interface DutchBidPanelProps {
  auction: Auction;
  dutchPrice: number;
  timeRemaining: string;
  onAccepted: () => void;
}

export function DutchBidPanel({
  auction,
  dutchPrice,
  timeRemaining,
  onAccepted,
}: DutchBidPanelProps) {
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
