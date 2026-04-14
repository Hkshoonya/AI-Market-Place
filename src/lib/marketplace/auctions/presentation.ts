import { Gavel, Layers, TrendingDown, type LucideIcon } from "lucide-react";

import type { AuctionStatus } from "./status";

export const AUCTION_TYPE_BADGE_STYLES = {
  english: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  dutch: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  batch: "bg-amber-500/10 text-amber-400 border-amber-500/30",
} as const;

export const AUCTION_STATUS_BADGE_STYLES: Record<AuctionStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  upcoming: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  ended: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
};

export const AUCTION_TYPE_ICONS: Record<keyof typeof AUCTION_TYPE_BADGE_STYLES, LucideIcon> = {
  english: Gavel,
  dutch: TrendingDown,
  batch: Layers,
};
