export const PUBLIC_AUCTION_STATUSES = ["upcoming", "active", "ended", "cancelled"] as const;

export type AuctionStatus = (typeof PUBLIC_AUCTION_STATUSES)[number];
export type AuctionStatusFilter = AuctionStatus | "all";

export function normalizeAuctionStatusParam(status: string | null | undefined): AuctionStatusFilter {
  if (!status) return "active";

  const normalized = status.toLowerCase();
  if (normalized === "all") return "all";
  if (normalized === "settled") return "ended";

  return PUBLIC_AUCTION_STATUSES.includes(normalized as AuctionStatus)
    ? (normalized as AuctionStatus)
    : "active";
}
