import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";

export const dynamic = "force-dynamic";

// POST /api/marketplace/listings/[slug]/report — report a listing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
  const ip = getClientIp(request);
  const rl = await rateLimit(`report:${ip}`, RATE_LIMITS.write);
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

  const originError = rejectUntrustedRequestOrigin(request);
  if (originError) {
    return originError;
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
  const { reason, details } = body as { reason?: string; details?: string };

  if (!reason || typeof reason !== "string") {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  // Get listing ID from slug
  const { data: listing } = await supabase
    .from("marketplace_listings")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("listing_reports")
    .insert({
      listing_id: listing.id,
      reporter_id: user.id,
      reason: reason as string,
      details: typeof details === "string" ? details.trim() || null : null,
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
  } catch (err) {
    return handleApiError(err, "api/marketplace/listings/report");
  }
}
