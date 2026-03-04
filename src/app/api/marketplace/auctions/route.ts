/**
 * GET  /api/marketplace/auctions — Browse active auctions
 * POST /api/marketplace/auctions — Create a new auction (seller only)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { calculateDutchPrice } from "@/lib/marketplace/auctions/dutch";
import { handleApiError } from "@/lib/api-error";
import { systemLog } from "@/lib/logging";

const createAuctionSchema = z.object({
  listing_id: z.string().uuid(),
  auction_type: z.enum(["english", "dutch", "batch"]),
  start_price: z.number().positive(),
  reserve_price: z.number().positive().optional(),
  floor_price: z.number().positive().optional(),
  bid_increment_min: z.number().positive().optional().default(1),
  price_decrement: z.number().positive().optional(),
  decrement_interval_seconds: z.number().int().positive().optional(),
  quantity: z.number().int().positive().optional().default(1),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  auto_extend_minutes: z.number().int().min(0).optional().default(5),
});

export const dynamic = "force-dynamic";

type AuctionWithListing = Record<string, unknown>;
type AuctionStatus = "upcoming" | "active" | "ended" | "cancelled" | "settled";

type AuctionQueryResult = {
  data: AuctionWithListing[] | null;
  error: { message: string; details: string; hint: string; code: string } | null;
  count: number | null;
};

/**
 * GET /api/marketplace/auctions
 * Browse auctions with filters: auction_type, status, listing_type, page, limit.
 */
export async function GET(request: NextRequest) {
  try {
  const ip = getClientIp(request);
  const rl = rateLimit(`auctions:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { searchParams } = new URL(request.url);

  const auctionType =
    searchParams.get("auction_type") || searchParams.get("type");
  const status = searchParams.get("status") || "active";
  const listingType = searchParams.get("listing_type");
  const sort = searchParams.get("sort") || "ending_soon";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

  const statusFilter: AuctionStatus[] =
    status === "all" ? ["upcoming", "active", "ended"] : [status as AuctionStatus];

  // Sorting
  const sortMap: Record<string, { column: string; ascending: boolean }> = {
    ending_soon: { column: "ends_at", ascending: true },
    newest: { column: "created_at", ascending: false },
    price_asc: { column: "current_price", ascending: true },
    price_desc: { column: "current_price", ascending: false },
  };
  const sortConfig = sortMap[sort] || sortMap.ending_soon;

  // NOTE: embedded join "marketplace_listings" has no FK Relationship in DB type.
  // The SDK infers `never` for the joined shape. We build the query via the typed
  // client (for .from/.in/.eq/.order type-checking) then cast the awaited result
  // to a known shape — no `supabase as any` needed.
  let baseQuery = supabase
    .from("auctions")
    .select(
      "*, marketplace_listings(id, title, slug, listing_type, thumbnail_url, short_description)",
      { count: "exact" }
    )
    .in("status", statusFilter);

  if (auctionType) {
    baseQuery = baseQuery.eq(
      "auction_type",
      auctionType as "english" | "dutch" | "batch"
    );
  }

  if (listingType) {
    baseQuery = baseQuery.eq(
      "marketplace_listings.listing_type",
      listingType as import("@/types/database").ListingType
    );
  }

  baseQuery = baseQuery.order(sortConfig.column, {
    ascending: sortConfig.ascending,
    nullsFirst: false,
  });

  baseQuery = baseQuery.range((page - 1) * limit, page * limit - 1);

  const { data, error } = (await baseQuery) as unknown as AuctionQueryResult;

  if (error) {
    // Gracefully handle missing table (migration not yet applied)
    const msg =
      (error.message || "") + (error.details || "") + (error.hint || "");
    const code = error.code || "";
    if (
      msg.includes("does not exist") ||
      msg.includes("Could not find") ||
      msg.includes("relation") ||
      code === "42P01" ||
      code === "PGRST204" ||
      code === "PGRST205" ||
      code === "PGRST116"
    ) {
      return NextResponse.json([]);
    }
    return NextResponse.json(
      { error: "Failed to fetch auctions. Please try again later." },
      { status: 500 }
    );
  }

  // Enrich auctions: remap listing relation and calculate Dutch prices
  const enriched = ((data || []) as AuctionWithListing[]).map((auction) => {
    const mapped: AuctionWithListing = {
      ...auction,
      // Remap nested relation to match client Auction.listing interface
      listing: auction.marketplace_listings ?? null,
      marketplace_listings: undefined,
    };

    if (auction.auction_type === "dutch" && auction.status === "active") {
      mapped.calculated_current_price = calculateDutchPrice({
        start_price: Number(auction.start_price),
        floor_price: auction.floor_price
          ? Number(auction.floor_price)
          : null,
        price_decrement: auction.price_decrement
          ? Number(auction.price_decrement)
          : null,
        decrement_interval_seconds: (auction.decrement_interval_seconds as number | null | undefined) ?? null,
        starts_at: auction.starts_at as string,
      });
    }

    return mapped;
  });

  // Return flat array — client (auctions-browse-content.tsx) expects data.auctions or falls back to data
  return NextResponse.json(enriched);
  } catch (err) {
    return handleApiError(err, "api/marketplace/auctions");
  }
}

/**
 * POST /api/marketplace/auctions
 * Create a new auction. Requires authentication. Seller must own the listing.
 */
export async function POST(request: NextRequest) {
  try {
  const { createClient: createServerClient } = await import(
    "@/lib/supabase/server"
  );
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Authentication required. Please sign in to create an auction.",
      },
      { status: 401 }
    );
  }

  const rl = rateLimit(`auction-create:${user.id}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = createAuctionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Verify seller owns the listing and listing is active
  const { data: listing, error: listingError } = await supabase
    .from("marketplace_listings")
    .select("id, seller_id, status")
    .eq("id", parsed.data.listing_id)
    .single();

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.seller_id !== user.id) {
    return NextResponse.json(
      { error: "You do not own this listing" },
      { status: 403 }
    );
  }

  if (listing.status !== "active") {
    return NextResponse.json(
      { error: "Listing is not active" },
      { status: 400 }
    );
  }

  // Check that there isn't already an active/upcoming auction for this listing
  const { data: existingAuction } = await supabase
    .from("auctions")
    .select("id")
    .eq("listing_id", parsed.data.listing_id)
    .in("status", ["upcoming", "active"] as AuctionStatus[])
    .limit(1)
    .single();

  if (existingAuction) {
    return NextResponse.json(
      {
        error:
          "An active or upcoming auction already exists for this listing",
      },
      { status: 409 }
    );
  }

  // Validate timing
  const startsAt = new Date(parsed.data.starts_at);
  const endsAt = new Date(parsed.data.ends_at);

  if (endsAt <= startsAt) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 }
    );
  }

  // Dutch auction validations
  if (parsed.data.auction_type === "dutch") {
    if (
      !parsed.data.price_decrement ||
      !parsed.data.decrement_interval_seconds
    ) {
      return NextResponse.json(
        {
          error:
            "Dutch auctions require price_decrement and decrement_interval_seconds",
        },
        { status: 400 }
      );
    }
  }

  // Determine initial status: active if starts_at <= now, otherwise upcoming
  const initialStatus =
    startsAt <= new Date()
      ? ("active" as const)
      : ("upcoming" as const);

  const { data: auction, error: createError } = await supabase
    .from("auctions")
    .insert({
      listing_id: parsed.data.listing_id,
      seller_id: user.id,
      auction_type: parsed.data.auction_type,
      status: initialStatus,
      start_price: parsed.data.start_price,
      reserve_price: parsed.data.reserve_price ?? null,
      floor_price: parsed.data.floor_price ?? null,
      current_price: parsed.data.start_price,
      bid_increment_min: parsed.data.bid_increment_min,
      price_decrement: parsed.data.price_decrement ?? null,
      decrement_interval_seconds:
        parsed.data.decrement_interval_seconds ?? null,
      quantity: parsed.data.quantity,
      remaining_quantity: parsed.data.quantity,
      starts_at: parsed.data.starts_at,
      ends_at: parsed.data.ends_at,
      auto_extend_minutes: parsed.data.auto_extend_minutes,
    })
    .select()
    .single();

  if (createError) {
    void systemLog.error("api/marketplace/auctions", "Failed to create auction", { error: createError.message });
    return NextResponse.json(
      { error: "Failed to create auction. Please try again later." },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: auction }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "api/marketplace/auctions");
  }
}
