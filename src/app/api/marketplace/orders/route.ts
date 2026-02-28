import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

const createOrderSchema = z.object({
  listing_id: z.string().uuid("listing_id must be a valid UUID"),
  message: z.string().max(2000, "Message must be 2000 characters or less").optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`orders:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to view your orders." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "buyer";

  let query;

  if (role === "seller") {
    query = (supabase as any)
      .from("marketplace_orders")
      .select(
        "*, marketplace_listings(title, slug, listing_type), profiles!marketplace_orders_buyer_id_fkey(display_name, avatar_url)"
      )
      .eq("seller_id", user.id);
  } else {
    query = (supabase as any)
      .from("marketplace_orders")
      .select("*, marketplace_listings(title, slug, listing_type)")
      .eq("buyer_id", user.id);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch orders. Please try again later." },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`orders-write:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to place an order." },
      { status: 401 }
    );
  }

  const body = await request.json();
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { listing_id, message } = parsed.data;

  // Get listing to find seller and price
  const { data: listing } = await (supabase as any)
    .from("marketplace_listings")
    .select("seller_id, price")
    .eq("id", listing_id)
    .single();

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.seller_id === user.id) {
    return NextResponse.json(
      { error: "Cannot order your own listing" },
      { status: 400 }
    );
  }

  const { data, error } = await (supabase as any)
    .from("marketplace_orders")
    .insert({
      listing_id,
      buyer_id: user.id,
      seller_id: listing.seller_id,
      message: message || null,
      price_at_time: listing.price,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create order. Please try again later." },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
