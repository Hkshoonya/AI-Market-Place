"use client";

import { useEffect, useRef, useState } from "react";
import type { Auction } from "@/types/auction";

// ────────────────────────────────────────────────────────────
// Helpers (module-level, not exported)
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
// Hook
// ────────────────────────────────────────────────────────────

interface UseAuctionTimerParams {
  auction: Auction | null;
}

interface UseAuctionTimerResult {
  timeRemaining: string;
  dutchPrice: number;
}

export function useAuctionTimer({
  auction,
}: UseAuctionTimerParams): UseAuctionTimerResult {
  const [timeRemaining, setTimeRemaining] = useState(
    () => (auction ? formatTimeRemaining(auction.ends_at) : "")
  );
  const [dutchPrice, setDutchPrice] = useState(() => {
    if (!auction) return 0;
    return auction.auction_type === "dutch" && auction.status === "active"
      ? calculateDutchPrice(auction)
      : (auction.current_price ?? auction.start_price);
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dutchRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer (every second)
  useEffect(() => {
    if (!auction) return;

    function tick() {
      if (auction) {
        setTimeRemaining(formatTimeRemaining(auction.ends_at));
      }
    }
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [auction]);

  // Dutch price refresh (every 10 seconds)
  useEffect(() => {
    if (
      !auction ||
      auction.auction_type !== "dutch" ||
      auction.status !== "active"
    )
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

  return { timeRemaining, dutchPrice };
}
