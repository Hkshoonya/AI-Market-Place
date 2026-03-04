/**
 * POST /api/marketplace/purchase
 * Authenticated: session or API key -> wallet balance -> escrow -> deliver
 * Guest:         free items only -> guest_email required -> deliver
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAuthUser } from "@/lib/auth/resolve-user";
import {
  handleGuestCheckout,
  handleAuthenticatedCheckout,
  type PurchaseResult,
} from "@/lib/marketplace/purchase-handlers";

const purchaseSchema = z.object({
  listing_id: z.string().uuid("listing_id must be a valid UUID"),
  payment_method: z.enum(["balance"]).default("balance"),
  guest_email: z.string().email("Invalid email address").optional(),
  guest_name: z.string().max(200).optional(),
});

export const dynamic = "force-dynamic";

function toResponse(result: PurchaseResult): NextResponse {
  if (!result.success && result.error) {
    // Spread errorDetails (e.g. required/balance for insufficient_balance) into response body
    return NextResponse.json(
      { error: result.error, ...result.errorDetails },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json(
    {
      order_id: result.orderId,
      status: result.status,
      escrow_id: result.escrowId,
      delivery: result.delivery,
      payment: result.payment,
      ...(result.message ? { message: result.message } : {}),
    },
    { status: result.httpStatus }
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`purchase:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { listing_id, guest_email, guest_name } = parsed.data;

  // Authenticate — may be null for guest checkout
  const auth = await resolveAuthUser(request, ["marketplace", "write", "marketplace_access"]);

  const admin = createAdminClient();
  const sb = admin;

  // Fetch listing (shared between both flows)
  const { data: listing, error: listingError } = await sb
    .from("marketplace_listings")
    .select("*")
    .eq("id", listing_id)
    .eq("status", "active")
    .single();

  if (listingError || !listing) {
    return NextResponse.json(
      { error: "Listing not found or not active." },
      { status: 404 }
    );
  }

  // Delegate to appropriate handler
  const isGuest = !auth;
  let result: PurchaseResult;

  if (isGuest) {
    result = await handleGuestCheckout(sb, listing, guest_email, guest_name);
  } else {
    result = await handleAuthenticatedCheckout(
      sb,
      listing,
      auth.userId,
      auth.authMethod
    );
  }

  return toResponse(result);
}
