/**
 * POST /api/marketplace/purchase
 *
 * Unified purchase endpoint for humans, bots, and guests.
 *
 * Authenticated flow: Auth via Supabase session or API key -> wallet balance -> escrow -> deliver
 * Guest flow:         Free items only -> guest_email required -> deliver
 *
 * Body: { listing_id: string, payment_method?: "balance", guest_email?: string, guest_name?: string }
 *
 * Returns: { order_id, delivery?: { type, data }, escrow_id }
 * Or 402:  { error: "insufficient_balance", required, balance }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { getOrCreateWallet, getWalletBalance } from "@/lib/payments/wallet";
import { createPurchaseEscrow, completePurchaseEscrow } from "@/lib/marketplace/escrow";
import { deliverDigitalGood } from "@/lib/marketplace/delivery";
import { createAdminClient } from "@/lib/supabase/admin";

const purchaseSchema = z.object({
  listing_id: z.string().uuid("listing_id must be a valid UUID"),
  payment_method: z.enum(["balance"]).default("balance"),
  guest_email: z.string().email("Invalid email address").optional(),
  guest_name: z.string().max(200).optional(),
});

export const dynamic = "force-dynamic";

/**
 * Resolve the authenticated user from either a Supabase session or an API key.
 * Returns the user ID or null.
 */
async function resolveAuthUser(
  request: NextRequest
): Promise<{ userId: string; authMethod: "session" | "api_key" } | null> {
  // 1. Try Supabase session first
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { userId: user.id, authMethod: "session" };
  }

  // 2. Try API key auth (aimk_ prefix)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer aimk_")) {
    const keyRaw = authHeader.slice(7); // Remove "Bearer "
    const keyHash = crypto
      .createHash("sha256")
      .update(keyRaw)
      .digest("hex");

    const admin = createAdminClient();
    const sb = admin as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const { data: apiKey } = await sb
      .from("api_keys")
      .select("owner_id, is_active, scopes")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .single();

    if (apiKey) {
      return { userId: apiKey.owner_id, authMethod: "api_key" };
    }
  }

  return null;
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

  // Parse and validate body first (needed for guest check)
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
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
  const auth = await resolveAuthUser(request);

  const admin = createAdminClient();
  const sb = admin as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  // Get listing
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

  const price = Number(listing.price) || 0;
  const isFree = listing.pricing_type === "free" || price === 0;

  // Determine if this is a guest checkout
  const isGuest = !auth;

  if (isGuest) {
    // Guests can only get free items
    if (!isFree) {
      return NextResponse.json(
        {
          error: "Authentication required for paid purchases. Please sign in or create a free account.",
        },
        { status: 401 }
      );
    }

    // Guest must provide email
    if (!guest_email) {
      return NextResponse.json(
        { error: "Email address is required for guest checkout." },
        { status: 400 }
      );
    }
  }

  const userId = auth?.userId ?? null;
  const authMethod = auth?.authMethod ?? "guest";

  // Cannot buy own listing (only applies to authenticated users)
  if (userId && listing.seller_id === userId) {
    return NextResponse.json(
      { error: "Cannot purchase your own listing." },
      { status: 400 }
    );
  }

  // For paid listings, check wallet balance (authenticated users only)
  if (price > 0 && userId) {
    const wallet = await getOrCreateWallet(userId);
    const balance = await getWalletBalance(wallet.id);

    if (balance.available < price) {
      return NextResponse.json(
        {
          error: "insufficient_balance",
          message: `Insufficient wallet balance. You need $${price.toFixed(2)} but have $${balance.available.toFixed(2)} available.`,
          required: price,
          balance: balance.available,
          wallet_id: wallet.id,
        },
        { status: 402 }
      );
    }
  }

  // Create order record
  const orderInsert: Record<string, any> = {
    listing_id,
    seller_id: listing.seller_id,
    price_at_time: price,
    status: "pending",
  };

  if (userId) {
    orderInsert.buyer_id = userId;
    if (authMethod === "api_key") orderInsert.message = "Purchased via API";
  } else {
    // Guest checkout
    orderInsert.buyer_id = null;
    orderInsert.guest_email = guest_email;
    orderInsert.guest_name = guest_name || null;
    orderInsert.message = `Guest checkout: ${guest_email}`;
  }

  const { data: order, error: orderError } = await sb
    .from("marketplace_orders")
    .insert(orderInsert)
    .select()
    .single();

  if (orderError || !order) {
    console.error("[purchase] Order creation failed:", orderError);
    return NextResponse.json(
      { error: "Failed to create order. Please try again later." },
      { status: 500 }
    );
  }

  // Create escrow hold for paid listings
  let escrowId: string | null = null;
  if (price > 0 && userId) {
    try {
      const result = await createPurchaseEscrow(
        userId,
        listing.seller_id,
        price,
        order.id
      );
      escrowId = result.escrowId;
    } catch (err) {
      // Escrow failed -- clean up the order
      await sb
        .from("marketplace_orders")
        .update({ status: "cancelled" })
        .eq("id", order.id);

      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Failed to hold escrow. Please try again.",
        },
        { status: 402 }
      );
    }
  }

  // For "one_time" and "free" pricing on digital goods: auto-complete
  const autoCompletePricing = ["one_time", "free"];
  if (autoCompletePricing.includes(listing.pricing_type)) {
    try {
      // Complete escrow (release funds to seller minus fee)
      let escrowResult = null;
      if (price > 0 && userId) {
        escrowResult = await completePurchaseEscrow(order.id);
      }

      // Deliver digital good (use a placeholder userId for guests)
      const deliverUserId = userId || order.id; // order.id as fallback key for guest delivery
      const delivery = await deliverDigitalGood(
        order.id,
        listing_id,
        deliverUserId
      );

      if (!delivery.success) {
        // Delivery failed — mark order as approved (paid) but not completed
        await sb
          .from("marketplace_orders")
          .update({ status: "approved" })
          .eq("id", order.id);

        return NextResponse.json(
          {
            order_id: order.id,
            status: "approved",
            escrow_id: escrowId,
            delivery: null,
            message:
              "Payment successful but delivery failed. The seller will fulfill your order manually.",
            payment: escrowResult
              ? {
                  total: price,
                  seller_received: escrowResult.sellerAmount,
                  platform_fee: escrowResult.platformFee,
                  fee_rate: escrowResult.feeRate,
                }
              : null,
          },
          { status: 201 }
        );
      }

      // Update order to completed
      await sb
        .from("marketplace_orders")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      // Increment listing purchase count (best-effort)
      try {
        await sb.rpc("increment_listing_purchases", {
          p_listing_id: listing_id,
        });
      } catch {
        // Non-critical — log but don't fail the purchase
        console.error("[purchase] Failed to increment listing purchases for", listing_id);
      }

      return NextResponse.json(
        {
          order_id: order.id,
          status: "completed",
          escrow_id: escrowId,
          delivery: { type: delivery.deliveryType, data: delivery.data },
          payment: escrowResult
            ? {
                total: price,
                seller_received: escrowResult.sellerAmount,
                platform_fee: escrowResult.platformFee,
                fee_rate: escrowResult.feeRate,
              }
            : null,
        },
        { status: 201 }
      );
    } catch (err) {
      // Auto-complete failed -- leave order as pending for manual resolution
      console.error("[purchase] Auto-complete failed:", err);

      return NextResponse.json(
        {
          order_id: order.id,
          status: "pending",
          escrow_id: escrowId,
          message:
            "Order created but auto-completion failed. The seller will process your order manually.",
        },
        { status: 201 }
      );
    }
  }

  // For subscription / per_token / per_request / contact: leave as pending
  return NextResponse.json(
    {
      order_id: order.id,
      status: "pending",
      escrow_id: escrowId,
      message:
        "Order created. The seller will review and approve your purchase.",
    },
    { status: 201 }
  );
}
