/**
 * Marketplace Escrow Service
 * Connects wallet escrow holds to marketplace order lifecycle.
 */

import {
  holdEscrow,
  releaseEscrow,
  refundEscrow,
  calculatePlatformFee,
  getOrCreateWallet,
} from "@/lib/payments/wallet";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Create an escrow hold for a marketplace purchase.
 * Called when a buyer initiates a purchase.
 */
export async function createPurchaseEscrow(
  buyerId: string,
  sellerId: string,
  amount: number,
  orderId: string
): Promise<{ escrowId: string; walletId: string }> {
  // 1. Get or create buyer's wallet
  const buyerWallet = await getOrCreateWallet(buyerId);

  // 2. Hold funds in escrow
  const escrowId = await holdEscrow(
    buyerWallet.id,
    amount,
    "purchase",
    "order",
    orderId
  );

  return { escrowId, walletId: buyerWallet.id };
}

/**
 * Complete a purchase -- release escrow to seller minus platform fee.
 * Called when order status transitions to "completed".
 */
export async function completePurchaseEscrow(orderId: string): Promise<{
  sellerAmount: number;
  platformFee: number;
  feeRate: number;
}> {
  const supabase = createAdminClient();
  const sb = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  // 1. Find the escrow hold for this order
  const { data: escrow, error } = await sb
    .from("escrow_holds")
    .select("*")
    .eq("reference_type", "order")
    .eq("reference_id", orderId)
    .eq("status", "held")
    .single();

  if (error || !escrow) {
    throw new Error(`No active escrow found for order ${orderId}`);
  }

  // 2. Get the order to find the seller
  const { data: order } = await sb
    .from("marketplace_orders")
    .select("seller_id")
    .eq("id", orderId)
    .single();

  if (!order) throw new Error(`Order ${orderId} not found`);

  // 3. Get or create seller's wallet
  const sellerWallet = await getOrCreateWallet(order.seller_id);

  // 4. Calculate platform fee based on seller's tier
  const { feeRate, feeAmount, netAmount } = await calculatePlatformFee(
    sellerWallet.id,
    escrow.amount
  );

  // 5. Release escrow: seller gets net, platform keeps fee
  await releaseEscrow(escrow.id, sellerWallet.id, feeAmount);

  // 6. Atomically increment seller's total_sales in profiles
  await sb.rpc("increment_seller_sales", { p_seller_id: order.seller_id, p_amount: netAmount });

  return { sellerAmount: netAmount, platformFee: feeAmount, feeRate };
}

/**
 * Refund a purchase -- return escrowed funds to buyer.
 * Called when order is cancelled or rejected after payment.
 */
export async function refundPurchaseEscrow(orderId: string): Promise<void> {
  const supabase = createAdminClient();
  const sb = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: escrow } = await sb
    .from("escrow_holds")
    .select("id, status")
    .eq("reference_type", "order")
    .eq("reference_id", orderId)
    .eq("status", "held")
    .single();

  if (!escrow) {
    // No escrow to refund (might be a free listing or already refunded)
    return;
  }

  await refundEscrow(escrow.id);
}
