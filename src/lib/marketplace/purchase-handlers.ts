/**
 * Purchase Handler Functions
 *
 * Business logic for guest and authenticated checkout flows.
 * These functions are injected with a Supabase client (no internal createAdminClient calls)
 * and have no dependency on Next.js server types.
 */

import { createPurchaseEscrow, completePurchaseEscrow } from "@/lib/marketplace/escrow";
import { deliverDigitalGood } from "@/lib/marketplace/delivery";
import { getOrCreateWallet, getWalletBalance } from "@/lib/payments/wallet";
import type { TypedSupabaseClient } from "@/types/database";
import { createTaggedLogger } from "@/lib/logging";
import { isRuntimeFlagEnabled } from "@/lib/runtime-flags";

const log = createTaggedLogger("marketplace/purchase");

export interface PurchaseResult {
  success: boolean;
  orderId: string;
  status: "completed" | "pending" | "cancelled";
  escrowId: string | null;
  delivery: { type: string; data: Record<string, unknown> } | null;
  payment: { total: number; seller_received: number; platform_fee: number; fee_rate: number } | null;
  httpStatus: number;
  message?: string;
  error?: string;
  errorDetails?: Record<string, unknown>;
}

export interface ListingData {
  id: string;
  seller_id: string;
  price: number | string | null;
  pricing_type: string;
  listing_type: string;
  slug: string;
  status?: string;
  title?: string;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function createOrderRecord(
  sb: TypedSupabaseClient,
  listing: ListingData,
  orderData: {
    buyerId: string | null;
    price: number;
    guestEmail?: string;
    guestName?: string;
    authMethod?: string;
  }
): Promise<{ id: string } | null> {
  const baseInsert = {
    listing_id: listing.id,
    seller_id: listing.seller_id,
    price_at_time: orderData.price,
    status: "pending" as const,
    buyer_id: orderData.buyerId ?? null,
    message: orderData.buyerId
      ? (orderData.authMethod === "api_key" ? "Purchased via API" : null)
      : (`Guest checkout: ${orderData.guestEmail}` as string | null),
    guest_email: orderData.buyerId ? null : (orderData.guestEmail ?? null),
    guest_name: orderData.buyerId ? null : (orderData.guestName ?? null),
  };

  const { data: order, error: orderError } = await sb
    .from("marketplace_orders")
    .insert(baseInsert)
    .select()
    .single();

  if (orderError || !order) {
    void log.error("Order creation failed", { error: orderError });
    return null;
  }

  return order;
}

async function autoCompleteOrder(
  sb: TypedSupabaseClient,
  orderId: string,
  listingId: string,
  deliverUserId: string,
  escrowId: string | null,
  price: number,
  userId: string | null
): Promise<PurchaseResult> {
  try {
    // Deliver digital good FIRST (before releasing escrow)
    const delivery = await deliverDigitalGood(orderId, listingId, deliverUserId);

    if (!delivery.success) {
      // Delivery failed — keep escrow held, leave order pending for manual resolution
      return {
        success: true,
        orderId,
        status: "pending",
        escrowId,
        delivery: null,
        payment: null,
        httpStatus: 201,
        message:
          "Delivery failed. Your payment is held safely in escrow and will be released once the seller fulfills the order.",
      };
    }

    // Delivery succeeded — now release escrow to seller
    let escrowResult = null;
    if (price > 0 && userId) {
      escrowResult = await completePurchaseEscrow(orderId);
    }

    // Update order to completed
    await sb
      .from("marketplace_orders")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    // Increment listing purchase count (best-effort)
    try {
      await sb.rpc("increment_listing_purchases", { p_listing_id: listingId });
    } catch {
      // Non-critical — log but don't fail the purchase
      void log.error("Failed to increment listing purchases", { listingId });
    }

    return {
      success: true,
      orderId,
      status: "completed",
      escrowId,
      delivery: { type: delivery.deliveryType, data: delivery.data ?? {} },
      payment: escrowResult
        ? {
            total: price,
            seller_received: escrowResult.sellerAmount,
            platform_fee: escrowResult.platformFee,
            fee_rate: escrowResult.feeRate,
          }
        : null,
      httpStatus: 201,
    };
  } catch (err) {
    // Auto-complete failed -- leave order as pending for manual resolution
    void log.error("Auto-complete failed", { error: err instanceof Error ? err.message : String(err) });

    return {
      success: true,
      orderId,
      status: "pending",
      escrowId,
      delivery: null,
      payment: null,
      httpStatus: 201,
      message:
        "Order created but auto-completion failed. The seller will process your order manually.",
    };
  }
}

// ---------------------------------------------------------------------------
// Exported handler functions
// ---------------------------------------------------------------------------

/**
 * Handle a guest checkout (free items only).
 * Guest must provide email. Dedup check prevents re-downloading the same item.
 */
export async function handleGuestCheckout(
  sb: TypedSupabaseClient,
  listing: ListingData,
  guestEmail: string | undefined,
  guestName: string | undefined
): Promise<PurchaseResult> {
  const price = Number(listing.price) || 0;
  const isFree = listing.pricing_type === "free" || price === 0;
  const isAccountBoundProduct =
    listing.listing_type === "api_access" || listing.listing_type === "agent";

  // Guests can only get free items
  if (!isFree) {
    return {
      success: false,
      orderId: "",
      status: "cancelled",
      escrowId: null,
      delivery: null,
      payment: null,
      httpStatus: 401,
      error: "Authentication required for paid purchases. Please sign in or create a free account.",
    };
  }

  if (isAccountBoundProduct) {
    if (isRuntimeFlagEnabled("BLOCK_GUEST_ACCOUNT_BOUND_DELIVERY")) {
      return {
        success: false,
        orderId: "",
        status: "cancelled",
        escrowId: null,
        delivery: null,
        payment: null,
        httpStatus: 401,
        error: "Authentication required for this product type. Please sign in to continue.",
      };
    }

    await log.warn("Guest checkout used legacy account-bound delivery path", {
      listingId: listing.id,
      listingType: listing.listing_type,
      guestEmail: guestEmail ?? null,
    });
  }

  // Guest must provide email
  if (!guestEmail) {
    return {
      success: false,
      orderId: "",
      status: "cancelled",
      escrowId: null,
      delivery: null,
      payment: null,
      httpStatus: 400,
      error: "Email address is required for guest checkout.",
    };
  }

  // Dedup check: prevent re-downloading same listing
  const { data: existingOrder } = await sb
    .from("marketplace_orders")
    .select("id")
    .eq("guest_email", guestEmail)
    .eq("listing_id", listing.id)
    .eq("status", "completed")
    .limit(1)
    .single();

  if (existingOrder) {
    return {
      success: false,
      orderId: "",
      status: "cancelled",
      escrowId: null,
      delivery: null,
      payment: null,
      httpStatus: 409,
      error: "You have already downloaded this item. Check your email for the download link.",
    };
  }

  // Create order record
  const order = await createOrderRecord(sb, listing, {
    buyerId: null,
    price,
    guestEmail,
    guestName,
  });

  if (!order) {
    return {
      success: false,
      orderId: "",
      status: "cancelled",
      escrowId: null,
      delivery: null,
      payment: null,
      httpStatus: 500,
      error: "Failed to create order. Please try again later.",
    };
  }

  // For "one_time"/"free" pricing: auto-complete
  const autoCompletePricing = ["one_time", "free"];
  if (autoCompletePricing.includes(listing.pricing_type)) {
    const deliverUserId = order.id; // guest: use order ID as buyer reference
    return autoCompleteOrder(sb, order.id, listing.id, deliverUserId, null, price, null);
  }

  // For other pricing types: leave as pending
  return {
    success: true,
    orderId: order.id,
    status: "pending",
    escrowId: null,
    delivery: null,
    payment: null,
    httpStatus: 201,
    message: "Order created. The seller will review and approve your purchase.",
  };
}

/**
 * Handle an authenticated checkout (free or paid).
 * Validates ownership, checks wallet balance for paid items, creates escrow.
 */
export async function handleAuthenticatedCheckout(
  sb: TypedSupabaseClient,
  listing: ListingData,
  userId: string,
  authMethod: string
): Promise<PurchaseResult> {
  const price = Number(listing.price) || 0;

  // Cannot buy own listing
  if (listing.seller_id === userId) {
    return {
      success: false,
      orderId: "",
      status: "cancelled",
      escrowId: null,
      delivery: null,
      payment: null,
      httpStatus: 400,
      error: "Cannot purchase your own listing.",
    };
  }

  // For paid listings, check wallet balance
  if (price > 0) {
    const wallet = await getOrCreateWallet(userId);
    const balance = await getWalletBalance(wallet.id);

    if (balance.available < price) {
      return {
        success: false,
        orderId: "",
        status: "cancelled",
        escrowId: null,
        delivery: null,
        payment: null,
        httpStatus: 402,
        error: "insufficient_balance",
        errorDetails: {
          message: `Insufficient wallet balance. You need $${price.toFixed(2)} but have $${balance.available.toFixed(2)} available.`,
          required: price,
          balance: balance.available,
        },
      };
    }
  }

  // Create order record
  const order = await createOrderRecord(sb, listing, {
    buyerId: userId,
    price,
    authMethod,
  });

  if (!order) {
    return {
      success: false,
      orderId: "",
      status: "cancelled",
      escrowId: null,
      delivery: null,
      payment: null,
      httpStatus: 500,
      error: "Failed to create order. Please try again later.",
    };
  }

  // Create escrow hold for paid listings
  let escrowId: string | null = null;
  if (price > 0) {
    try {
      const result = await createPurchaseEscrow(userId, listing.seller_id, price, order.id);
      escrowId = result.escrowId;
    } catch (err) {
      // Escrow failed -- clean up the order
      await sb
        .from("marketplace_orders")
        .update({ status: "cancelled" })
        .eq("id", order.id);

      return {
        success: false,
        orderId: order.id,
        status: "cancelled",
        escrowId: null,
        delivery: null,
        payment: null,
        httpStatus: 402,
        error:
          err instanceof Error ? err.message : "Failed to hold escrow. Please try again.",
      };
    }
  }

  // For "one_time"/"free" pricing: auto-complete
  const autoCompletePricing = ["one_time", "free"];
  if (autoCompletePricing.includes(listing.pricing_type)) {
    const deliverUserId = userId;
    return autoCompleteOrder(sb, order.id, listing.id, deliverUserId, escrowId, price, userId);
  }

  // For subscription / per_token / per_request / contact: leave as pending
  return {
    success: true,
    orderId: order.id,
    status: "pending",
    escrowId,
    delivery: null,
    payment: null,
    httpStatus: 201,
    message: "Order created. The seller will review and approve your purchase.",
  };
}
