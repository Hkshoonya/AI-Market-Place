/**
 * GET /api/marketplace/auctions/:id — Auction details with current price and bid history
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { calculateDutchPrice } from "@/lib/marketplace/auctions/dutch";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  const rl = rateLimit(`auction-detail:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const sb = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  // Fetch auction with listing info
  const { data: auction, error: auctionError } = await sb
    .from("auctions")
    .select(
      "*, marketplace_listings(id, title, slug, listing_type, description, short_description, thumbnail_url, demo_url, tags, pricing_type, price)"
    )
    .eq("id", id)
    .single();

  if (auctionError || !auction) {
    // Gracefully handle missing table (migration not yet applied)
    const msg = auctionError?.message || "";
    const code = auctionError?.code || "";
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

  // Fetch bid history — two-query approach (auction_bids may not have FK to profiles)
  const { data: rawBids } = await sb
    .from("auction_bids")
    .select("id, bid_amount, quantity, status, created_at, bidder_type, bidder_id")
    .eq("auction_id", id)
    .order("bid_amount", { ascending: false });

  // Enrich bids with bidder profiles
  let bids = rawBids ?? [];
  if (bids.length > 0) {
    const bidderIds = [...new Set(bids.map((b: any) => b.bidder_id).filter(Boolean))];
    if (bidderIds.length > 0) {
      const { data: bidderProfiles } = await sb
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", bidderIds);
      const bidderMap = new Map((bidderProfiles ?? []).map((p: any) => [p.id, p]));
      bids = bids.map((b: any) => ({
        ...b,
        profiles: b.bidder_id ? bidderMap.get(b.bidder_id) ?? null : null,
      }));
    }
  }

  // Fetch seller profile
  const { data: seller } = await sb
    .from("profiles")
    .select("id, display_name, avatar_url, username, seller_rating, total_sales")
    .eq("id", auction.seller_id)
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
    (b: any) => b.status === "active" || b.status === "won"
  );
  const highBid =
    activeBids.length > 0
      ? Math.max(...activeBids.map((b: any) => Number(b.bid_amount)))
      : null;

  // Return unwrapped auction object — client (auction-detail-content.tsx)
  // sets auction directly from response: setAuction(data)
  return NextResponse.json({
    ...auction,
    // Remap nested listing relation to match client Auction.listing interface
    listing: auction.marketplace_listings ?? null,
    marketplace_listings: undefined,
    // Alias bid_increment_min → bid_increment for client compatibility
    bid_increment: auction.bid_increment_min ?? null,
    calculated_current_price: calculatedCurrentPrice,
    seller,
    bids: (bids || []).map((b: any) => ({
      id: b.id,
      bid_amount: Number(b.bid_amount),
      amount: Number(b.bid_amount),
      quantity: b.quantity,
      status: b.status,
      bidder_type: b.bidder_type,
      bidder_display_name: b.profiles?.display_name || "Anonymous",
      bidder_avatar_url: b.profiles?.avatar_url || null,
      bidder: {
        display_name: b.profiles?.display_name || "Anonymous",
        username: b.profiles?.display_name || "anonymous",
      },
      created_at: b.created_at,
    })),
    bid_count: activeBids.length,
    high_bid: highBid,
  });
}
