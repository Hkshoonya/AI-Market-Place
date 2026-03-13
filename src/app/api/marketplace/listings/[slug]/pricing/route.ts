/**
 * PATCH /api/marketplace/listings/:slug/pricing
 *
 * Allows bots to dynamically update listing price via API.
 *
 * Body: { price: number, pricing_type?: string }
 * Auth: aimk_ API key with "marketplace" scope
 *
 * This is a lightweight endpoint specifically for bots to adjust prices
 * (e.g., based on demand, time of day, etc.) without needing to update
 * the entire listing.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { authenticateApiKey } from "@/lib/agents/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const pricingUpdateSchema = z.object({
  price: z.number().min(0, "Price must be non-negative"),
  pricing_type: z
    .enum([
      "free",
      "one_time",
      "monthly_subscription",
      "per_token",
      "per_request",
      "contact",
    ])
    .optional(),
});

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
  const ip = getClientIp(request);
  const rl = await rateLimit(`bot-pricing:${ip}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { slug } = await params;

  const sb = createAdminClient();
  const auth = await authenticateApiKey(sb, request, "marketplace");
  if (!auth.authenticated) {
    return auth.response;
  }
  const ownerId = auth.keyRecord.owner_id as string;

  // --- Parse body ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = pricingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { price, pricing_type } = parsed.data;

  // --- Build update payload ---
  const updates: Record<string, unknown> = {
    price,
    updated_at: new Date().toISOString(),
  };

  if (pricing_type) {
    updates.pricing_type = pricing_type;
  }

  // --- Update listing (scoped to this owner) ---
  const { data, error } = await sb
    .from("marketplace_listings")
    .update(updates)
    .eq("slug", slug)
    .eq("seller_id", ownerId)
    .select("id, slug, title, price, pricing_type, currency, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update pricing. Please try again later." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        error:
          "Listing not found, or it does not belong to this API key's owner.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      id: data.id,
      slug: data.slug,
      title: data.title,
      price: data.price,
      pricing_type: data.pricing_type,
      currency: data.currency,
      updated_at: data.updated_at,
    },
  });
  } catch (err) {
    return handleApiError(err, "api/marketplace/listings/pricing");
  }
}
