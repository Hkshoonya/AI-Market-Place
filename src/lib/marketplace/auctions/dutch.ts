/**
 * Dutch Auction Logic
 * Descending price auction. Price drops over time.
 * First to accept the current price wins.
 */

import {
  holdEscrow,
  refundEscrow,
  releaseEscrow,
  calculatePlatformFee,
  getOrCreateWallet,
} from "@/lib/payments/wallet";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Calculate current Dutch auction price based on elapsed time.
 * Price decreases from start_price by price_decrement every
 * decrement_interval_seconds, floored at floor_price.
 */
export function calculateDutchPrice(auction: {
  start_price: number;
  floor_price: number | null;
  price_decrement: number | null;
  decrement_interval_seconds: number | null;
  starts_at: string;
}): number {
  const elapsed = (Date.now() - new Date(auction.starts_at).getTime()) / 1000;
  const intervalSeconds = auction.decrement_interval_seconds || 60;
  const intervals = Math.floor(elapsed / intervalSeconds);
  const drop = intervals * (auction.price_decrement || 0);
  const price = Number(auction.start_price) - drop;
  const floor = auction.floor_price ? Number(auction.floor_price) : 0;
  return Math.max(price, floor);
}

/**
 * Accept the current Dutch auction price.
 * First to accept wins — uses admin client for atomicity.
 */
export async function acceptDutchAuction(
  auctionId: string,
  buyerId: string,
  buyerType: "user" | "agent" = "user"
): Promise<{
  success: boolean;
  orderId?: string;
  price?: number;
  error?: string;
}> {
  const supabase = createAdminClient();
  const sb = supabase;

  try {
    // 1. Get auction details (admin client — bypasses RLS, acts as lock)
    const { data: auction, error: auctionError } = await sb
      .from("auctions")
      .select("*")
      .eq("id", auctionId)
      .single();

    if (auctionError || !auction) {
      return { success: false, error: "Auction not found" };
    }

    // Validate auction is active
    if (auction.status !== "active") {
      return { success: false, error: "Auction is no longer active" };
    }

    // Validate auction hasn't ended
    if (new Date(auction.ends_at) <= new Date()) {
      return { success: false, error: "Auction has expired" };
    }

    // Validate auction type
    if (auction.auction_type !== "dutch") {
      return { success: false, error: "This is not a Dutch auction" };
    }

    // Validate buyer is not the seller
    if (auction.seller_id === buyerId) {
      return { success: false, error: "Sellers cannot buy their own auctions" };
    }

    // 2. Calculate current price
    const currentPrice = calculateDutchPrice({
      start_price: Number(auction.start_price),
      floor_price: auction.floor_price ? Number(auction.floor_price) : null,
      price_decrement: auction.price_decrement
        ? Number(auction.price_decrement)
        : null,
      decrement_interval_seconds: auction.decrement_interval_seconds,
      starts_at: auction.starts_at,
    });

    // 3. Atomically claim the auction FIRST (before holding escrow)
    const { data: updatedAuction, error: updateError } = await sb
      .from("auctions")
      .update({
        status: "ended",
        winner_id: buyerId,
        final_price: currentPrice,
        current_price: currentPrice,
      })
      .eq("id", auctionId)
      .eq("status", "active")
      .select("id")
      .single();

    if (updateError || !updatedAuction) {
      return {
        success: false,
        error: "Auction was accepted by another buyer.",
      };
    }

    // 4. Hold escrow from buyer's wallet (we already won the auction)
    const buyerWallet = await getOrCreateWallet(buyerId, "user");
    let escrowId: string;

    try {
      escrowId = await holdEscrow(
        buyerWallet.id,
        currentPrice,
        "auction",
        "auction",
        auctionId
      );
    } catch (err) {
      // Escrow failed after winning — revert auction to active
      await sb
        .from("auctions")
        .update({ status: "active", winner_id: null, final_price: null })
        .eq("id", auctionId);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Insufficient balance")) {
        return {
          success: false,
          error: `Insufficient wallet balance. Current price is ${currentPrice.toFixed(2)}`,
        };
      }
      return { success: false, error: `Failed to hold escrow: ${message}` };
    }

    // 5. Create a bid record with status='won'
    const { data: bidRecord, error: bidError } = await sb
      .from("auction_bids")
      .insert({
        auction_id: auctionId,
        bidder_id: buyerId,
        bidder_type: buyerType,
        bid_amount: currentPrice,
        quantity: 1,
        escrow_hold_id: escrowId,
        status: "won",
      })
      .select("id")
      .single();

    if (bidError) {
      console.error("Failed to create bid record for Dutch auction:", bidError);
    }

    // 6. Release escrow to seller minus platform fee
    const sellerWallet = await getOrCreateWallet(auction.seller_id, "user");
    const { feeAmount } = await calculatePlatformFee(
      sellerWallet.id,
      currentPrice
    );

    try {
      await releaseEscrow(escrowId, sellerWallet.id, feeAmount);
    } catch (err) {
      console.error(
        `Failed to release escrow ${escrowId} to seller:`,
        err
      );
      return {
        success: false,
        error: `Payment settlement failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    return {
      success: true,
      orderId: bidRecord?.id ?? auctionId,
      price: currentPrice,
    };
  } catch (err) {
    console.error("acceptDutchAuction unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error accepting auction",
    };
  }
}
