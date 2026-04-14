import type { AuctionStatus } from "@/lib/marketplace/auctions/status";

// ────────────────────────────────────────────────────────────
// Shared Auction domain types
// Used by: auction-detail-content, bid-history-table,
//          english-bid-panel, dutch-bid-panel, use-auction-timer
// ────────────────────────────────────────────────────────────

export interface Auction {
  id: string;
  listing_id: string;
  auction_type: "english" | "dutch" | "batch";
  status: AuctionStatus;
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

export interface Bid {
  id: string;
  bidder_id: string;
  amount: number;
  created_at: string;
  bidder?: {
    display_name: string;
    username: string;
  };
}
