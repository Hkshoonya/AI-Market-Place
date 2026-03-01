import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST /api/marketplace/listings/[slug]/report — report a listing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(request);
  const rl = rateLimit(`report:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to report a listing." },
      { status: 401 }
    );
  }

  let body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }
  const { reason, details } = body;

  if (!reason || typeof reason !== "string") {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Get listing ID from slug
  const { data: listing } = await sb
    .from("marketplace_listings")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const { error } = await sb
    .from("listing_reports")
    .insert({
      listing_id: listing.id,
      reporter_id: user.id,
      reason,
      details: details?.trim() || null,
    });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You have already reported this listing" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
