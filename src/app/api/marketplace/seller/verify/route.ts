import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/marketplace/seller/verify — get user's verification status
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`seller-verify:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Get latest verification request
  const { data } = await sb
    .from("seller_verification_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Get current seller status from profile
  const { data: profile } = await sb
    .from("profiles")
    .select("is_seller, seller_verified")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    request: data ?? null,
    is_seller: profile?.is_seller ?? false,
    seller_verified: profile?.seller_verified ?? false,
  });
}

// POST /api/marketplace/seller/verify — submit verification request
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`seller-verify-write:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Check if already has pending request
  const { data: existing } = await sb
    .from("seller_verification_requests")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending verification request." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { business_name, business_description, website_url, portfolio_url, reason } = body;

  if (!business_name || business_name.length < 2) {
    return NextResponse.json(
      { error: "Business name is required." },
      { status: 400 }
    );
  }

  // Ensure user is a seller
  await sb
    .from("profiles")
    .update({ is_seller: true, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  // Create request
  const { data, error } = await sb
    .from("seller_verification_requests")
    .insert({
      user_id: user.id,
      business_name,
      business_description: business_description || null,
      website_url: website_url || null,
      portfolio_url: portfolio_url || null,
      reason: reason || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
