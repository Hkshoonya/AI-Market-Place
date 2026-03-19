import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { resolveAuthUser } from "@/lib/auth/resolve-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseQueryResult } from "@/lib/schemas/parse";
import type { TypedSupabaseClient } from "@/types/database";
import { handleApiError } from "@/lib/api-error";
import { systemLog } from "@/lib/logging";

const createOrderSchema = z.object({
  listing_id: z.string().uuid("listing_id must be a valid UUID"),
  message: z.string().max(2000, "Message must be 2000 characters or less").optional().nullable(),
  guest_email: z.string().email("Invalid email address").optional(),
  guest_name: z.string().max(200).optional(),
});

export const dynamic = "force-dynamic";

function isRequestOnlyPricingType(pricingType: string | null | undefined) {
  return pricingType === "free" || pricingType === "contact";
}

export async function GET(request: NextRequest) {
  try {
  const ip = getClientIp(request);
  const rl = await rateLimit(`orders:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  // Authenticate (session or API key)
  const auth = await resolveAuthUser(request, ["marketplace", "read"]);
  if (!auth) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to view your orders." },
      { status: 401 }
    );
  }

  // Use admin client for API key auth (no session), server client for session auth
  let db: TypedSupabaseClient;
  if (auth.authMethod === "api_key") {
    db = createAdminClient();
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    db = await createClient();
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "buyer";

  // Two-query approach: marketplace_orders may not have FK to profiles
  let query;

  if (role === "seller") {
    query = db
      .from("marketplace_orders")
      .select("*, marketplace_listings(title, slug, listing_type)")
      .eq("seller_id", auth.userId);
  } else {
    query = db
      .from("marketplace_orders")
      .select("*, marketplace_listings(title, slug, listing_type)")
      .eq("buyer_id", auth.userId);
  }

  query = query.order("created_at", { ascending: false });

  const OrderRowSchema = z.object({
    buyer_id: z.string().nullable(),
    guest_email: z.string().nullable().optional(),
    guest_name: z.string().nullable().optional(),
  }).passthrough();
  const ordersResponse = await query;

  if (ordersResponse.error) {
    return NextResponse.json(
      { error: "Failed to fetch orders. Please try again later." },
      { status: 500 }
    );
  }

  // Enrich seller orders with buyer profiles (or guest info)
  type OrderRow = z.infer<typeof OrderRowSchema> & Record<string, unknown>;
  let responseData: OrderRow[] = parseQueryResult(ordersResponse, OrderRowSchema, "OrderRows");
  if (role === "seller" && responseData.length > 0) {
    const buyerIds = [...new Set(responseData.map((o) => o.buyer_id).filter(Boolean))] as string[];
    let profileMap = new Map<string, { id: string; display_name: string | null; avatar_url: string | null }>();
    if (buyerIds.length > 0) {
      const { data: profiles } = await db
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", buyerIds);
      profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    }
    responseData = responseData.map((o) => ({
      ...o,
      profiles: o.buyer_id
        ? profileMap.get(o.buyer_id) ?? null
        : o.guest_email
          ? { display_name: o.guest_name || o.guest_email, avatar_url: null }
          : null,
    }));
  }

  return NextResponse.json({ data: responseData });
  } catch (err) {
    return handleApiError(err, "api/marketplace/orders");
  }
}

export async function POST(request: NextRequest) {
  try {
  const ip = getClientIp(request);
  const rl = await rateLimit(`orders-write:${ip}`, RATE_LIMITS.write);
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
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { listing_id, message, guest_email, guest_name } = parsed.data;

  // Try to authenticate — may be null for guest contacts
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isGuest = !user;

  // Guests must provide email
  if (isGuest && !guest_email) {
    return NextResponse.json(
      { error: "Email address is required. Please provide your email or sign in." },
      { status: 400 }
    );
  }

  // Use admin client for guest inserts (bypasses RLS)
  const adminSb = createAdminClient();

  // Get listing to find seller and price
  const { data: listing } = await adminSb
    .from("marketplace_listings")
    .select("seller_id, price, pricing_type, status")
    .eq("id", listing_id)
    .single();

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.status !== "active") {
    return NextResponse.json(
      { error: "Listing not found or not active." },
      { status: 404 }
    );
  }

  // Authenticated users can't order their own listing
  if (user && listing.seller_id === user.id) {
    return NextResponse.json(
      { error: "Cannot order your own listing" },
      { status: 400 }
    );
  }

  if (!isRequestOnlyPricingType(listing.pricing_type)) {
    return NextResponse.json(
      {
        error:
          "Direct paid checkout now requires the purchase flow. Use /api/marketplace/purchase for paid listings.",
      },
      { status: 409 }
    );
  }

  if (user) {
    const { data: existingBuyerOrder } = await adminSb
      .from("marketplace_orders")
      .select("id")
      .eq("listing_id", listing_id)
      .eq("buyer_id", user.id)
      .in("status", ["pending", "completed"])
      .limit(1)
      .maybeSingle();

    if (existingBuyerOrder) {
      return NextResponse.json(
        { error: "You already have an active request or order for this listing." },
        { status: 409 }
      );
    }
  }

  if (!user && guest_email) {
    const { data: existingGuestOrder } = await adminSb
      .from("marketplace_orders")
      .select("id")
      .eq("listing_id", listing_id)
      .eq("guest_email", guest_email)
      .in("status", ["pending", "completed"])
      .limit(1)
      .maybeSingle();

    if (existingGuestOrder) {
      return NextResponse.json(
        { error: "You already have an active request or order for this listing." },
        { status: 409 }
      );
    }
  }

  // Build insert payload — buyer_id is nullable for guest orders
  const baseInsert = {
    listing_id,
    seller_id: listing.seller_id,
    message: message || null,
    price_at_time: listing.price,
    buyer_id: (user ? user.id : null) as string | null, // null for guest orders
    ...((!user && guest_email) ? { guest_email, guest_name: guest_name || null } : {}),
  };

  const { data, error } = await adminSb
    .from("marketplace_orders")
    .insert(baseInsert)
    .select()
    .single();

  if (error) {
    void systemLog.error("api/marketplace/orders", "Order insert failed", { error: error.message, listing_id });
    return NextResponse.json(
      { error: "Failed to create order. Please try again later." },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "api/marketplace/orders");
  }
}
