/**
 * GET /api/marketplace/auctions/:id — Auction details with current price and bid history
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { parseQueryResultSingle } from "@/lib/schemas/parse";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { calculateDutchPrice } from "@/lib/marketplace/auctions/dutch";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const ip = getClientIp(request);
  const rl = await rateLimit(`auction-detail:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { id } = await params;

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch auction with listing info
  // NOTE: embedded join "marketplace_listings" has no FK Relationship in DB type.
  // Validate with Zod passthrough schema instead of double-casting.
  type AuctionWithListing = Record<string, unknown> & {
    seller_id: string | null;
    auction_type: string | null;
    status: string | null;
    start_price: number | string | null;
    floor_price: number | string | null;
    price_decrement: number | string | null;
    decrement_interval_seconds: number | null;
    starts_at: string;
    bid_increment_min: number | null;
  };
  const AuctionDetailSchema = z.object({
    id: z.string(),
    seller_id: z.string().nullable(),
    auction_type: z.string().nullable(),
    status: z.string().nullable(),
    start_price: z.union([z.number(), z.string()]).nullable(),
    floor_price: z.union([z.number(), z.string()]).nullable(),
    price_decrement: z.union([z.number(), z.string()]).nullable(),
    decrement_interval_seconds: z.number().nullable(),
    starts_at: z.string(),
    bid_increment_min: z.number().nullable(),
  }).passthrough();

  const auctionResponse = await supabase
    .from("auctions")
    .select(
      "*, marketplace_listings(id, title, slug, listing_type, description, short_description, thumbnail_url, demo_url, tags, pricing_type, price)"
    )
    .eq("id", id)
    .single();

  if (auctionResponse.error) {
    // Gracefully handle missing table (migration not yet applied)
    const msg = auctionResponse.error?.message || "";
    const code = auctionResponse.error?.code || "";
    if (
      msg.includes("does not exist") ||
      msg.includes("Could not find") ||
      msg.includes("relation") ||
      code === "42P01" ||
      code === "PGRST205" ||
      code === "PGRST204"
    ) {
      return NextResponse.json(
        { error: "Auctions are not yet available." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Auction not found" },
      { status: 404 }
    );
  }

  const auction = parseQueryResultSingle(auctionResponse, AuctionDetailSchema, "AuctionDetail") as AuctionWithListing | null;
  if (!auction) {
    return NextResponse.json(
      { error: "Auction not found" },
      { status: 404 }
    );
  }

  // Fetch bid history — two-query approach (auction_bids may not have FK to profiles)
  type BidRow = { id: string; bid_amount: number; quantity: number; status: string; created_at: string; bidder_type: string; bidder_id: string; profiles?: Record<string, unknown> | null };
  const { data: rawBids } = await supabase
    .from("auction_bids")
    .select("id, bid_amount, quantity, status, created_at, bidder_type, bidder_id")
    .eq("auction_id", id)
    .order("bid_amount", { ascending: false });

  // Enrich bids with bidder profiles
  let bids: BidRow[] = (rawBids ?? []) as BidRow[];
  if (bids.length > 0) {
    const bidderIds = [...new Set(bids.map((b) => b.bidder_id).filter(Boolean))];
    if (bidderIds.length > 0) {
      const { data: bidderProfiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", bidderIds);
      const bidderMap = new Map((bidderProfiles ?? []).map((p) => [p.id, p]));
      bids = bids.map((b) => ({
        ...b,
        profiles: b.bidder_id ? bidderMap.get(b.bidder_id) ?? null : null,
      }));
    }
  }

  // Fetch seller profile
  const { data: seller } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, username, seller_rating, total_sales")
    .eq("id", auction.seller_id as string)
    .single();

  // Calculate current Dutch price
  let calculatedCurrentPrice: number | null = null;
  if (
    auction.auction_type === "dutch" &&
    auction.status === "active"
  ) {
    calculatedCurrentPrice = calculateDutchPrice({
      start_price: Number(auction.start_price),
      floor_price: auction.floor_price
        ? Number(auction.floor_price)
        : null,
      price_decrement: auction.price_decrement
        ? Number(auction.price_decrement)
        : null,
      decrement_interval_seconds: auction.decrement_interval_seconds,
      starts_at: auction.starts_at,
    });
  }

  // Compute bid count and high bid for summary
  const activeBids = (bids || []).filter(
    (b) => b.status === "active" || b.status === "won"
  );
  const highBid =
    activeBids.length > 0
      ? Math.max(...activeBids.map((b) => Number(b.bid_amount)))
      : null;

  // Return unwrapped auction object — client (auction-detail-content.tsx)
  // sets auction directly from response: setAuction(data)
  return NextResponse.json({
    ...auction,
    // Remap nested listing relation to match client Auction.listing interface
    listing: (auction as Record<string, unknown>).marketplace_listings ?? null,
    marketplace_listings: undefined,
    // Alias bid_increment_min → bid_increment for client compatibility
    bid_increment: (auction as Record<string, unknown>).bid_increment_min ?? null,
    calculated_current_price: calculatedCurrentPrice,
    seller,
    bids: (bids || []).map((b) => ({
      id: b.id,
      bid_amount: Number(b.bid_amount),
      amount: Number(b.bid_amount),
      quantity: b.quantity,
      status: b.status,
      bidder_type: b.bidder_type,
      bidder_display_name: (b.profiles as Record<string, unknown> | null | undefined)?.display_name as string || "Anonymous",
      bidder_avatar_url: (b.profiles as Record<string, unknown> | null | undefined)?.avatar_url as string | null || null,
      bidder: {
        display_name: (b.profiles as Record<string, unknown> | null | undefined)?.display_name as string || "Anonymous",
        username: (b.profiles as Record<string, unknown> | null | undefined)?.display_name as string || "anonymous",
      },
      created_at: b.created_at,
    })),
    bid_count: activeBids.length,
    high_bid: highBid,
  });
  } catch (err) {
    return handleApiError(err, "api/marketplace/auctions");
  }
}
