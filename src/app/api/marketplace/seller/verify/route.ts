import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

  let body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const verifySchema = z.object({
    business_name: z.string().min(2, "Business name must be at least 2 characters").max(200),
    business_description: z.string().max(5000).optional(),
    website_url: z.string().url().max(2048).optional().or(z.literal("")),
    portfolio_url: z.string().url().max(2048).optional().or(z.literal("")),
    reason: z.string().max(2000).optional(),
  });

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Validation failed" },
      { status: 400 }
    );
  }
  const { business_name, business_description, website_url, portfolio_url, reason } = parsed.data;

  // Ensure user is a seller
  const { error: profileError } = await sb
    .from("profiles")
    .update({ is_seller: true, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

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
