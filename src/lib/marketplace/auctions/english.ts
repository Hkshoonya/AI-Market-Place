/**
 * English Auction Logic
 * Ascending price auction. Bidders place increasing bids.
 * Highest bidder wins when timer expires.
 * Supports: auto-extend, hidden reserve price, batch quantities.
 */

import {
  holdEscrow,
  refundEscrow,
  releaseEscrow,
  getOrCreateWallet,
  calculatePlatformFee,
} from "@/lib/payments/wallet";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTaggedLogger } from "@/lib/logging";

const log = createTaggedLogger("marketplace/auction-english");

export interface PlaceBidResult {
  success: boolean;
  bidId?: string;
  escrowId?: string;
  newCurrentPrice?: number;
  autoExtended?: boolean;
  error?: string;
}

/**
 * Place a bid on an English auction.
 * 1. Validate bid >= current_price + bid_increment_min
 * 2. Hold bid amount in escrow from bidder's wallet
 * 3. Release previous highest bidder's escrow hold
 * 4. Auto-extend if bid within last auto_extend_minutes
 * 5. Update auction current_price
 */
export async function placeBid(
  auctionId: string,
  bidderId: string,
  bidAmount: number,
  bidderType: "user" | "agent" = "user"
): Promise<PlaceBidResult> {
  const supabase = createAdminClient();
  const sb = supabase;

  try {
    // 1. Get auction details (admin client bypasses RLS)
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
      return { success: false, error: "Auction is not active" };
    }

    // Validate auction hasn't ended
    if (new Date(auction.ends_at) <= new Date()) {
      return { success: false, error: "Auction has ended" };
    }

    // Validate auction type
    if (auction.auction_type !== "english") {
      return { success: false, error: "This is not an English auction" };
    }

    // Validate bidder is not the seller
    if (auction.seller_id === bidderId) {
      return { success: false, error: "Sellers cannot bid on their own auctions" };
    }

    // 2. Validate bid amount meets minimum
    const currentPrice = Number(auction.current_price || auction.start_price);
    const bidIncrement = Number(auction.bid_increment_min || 1);
    const minimumBid = currentPrice + bidIncrement;

    if (bidAmount < minimumBid) {
      return {
        success: false,
        error: `Bid must be at least ${minimumBid.toFixed(2)} (current: ${currentPrice.toFixed(2)} + increment: ${bidIncrement.toFixed(2)})`,
      };
    }

    // 3. Hold escrow from bidder's wallet
    const bidderWallet = await getOrCreateWallet(bidderId, "user");
    let escrowId: string;

    try {
      escrowId = await holdEscrow(
        bidderWallet.id,
        bidAmount,
        "bid",
        "auction",
        auctionId
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Insufficient balance")) {
        return { success: false, error: "Insufficient wallet balance for this bid" };
      }
      return { success: false, error: `Failed to hold escrow: ${message}` };
    }

    // 4. Find and refund the previous highest bid
    const { data: previousBid } = await sb
      .from("auction_bids")
      .select("id, escrow_hold_id, bidder_id")
      .eq("auction_id", auctionId)
      .eq("status", "active")
      .order("bid_amount", { ascending: false })
      .limit(1)
      .single();

    if (previousBid && previousBid.escrow_hold_id) {
      // Mark previous bid as outbid
      await sb
        .from("auction_bids")
        .update({ status: "outbid" })
        .eq("id", previousBid.id);

      // Refund previous bidder's escrow
      try {
        await refundEscrow(previousBid.escrow_hold_id);
      } catch (err) {
        // Log but don't fail the bid — the previous hold may already be handled
        void log.error("Failed to refund previous bid escrow", {
          escrowHoldId: previousBid.escrow_hold_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 5. Insert new bid record
    const { data: newBid, error: bidError } = await sb
      .from("auction_bids")
      .insert({
        auction_id: auctionId,
        bidder_id: bidderId,
        bidder_type: bidderType,
        bid_amount: bidAmount,
        quantity: 1,
        escrow_hold_id: escrowId,
        status: "active",
      })
      .select("id")
      .single();

    if (bidError || !newBid) {
      // Attempt to refund the escrow we just placed
      try {
        await refundEscrow(escrowId);
      } catch {
        // Best-effort refund
      }
      return { success: false, error: "Failed to record bid" };
    }

    // 6. Check auto-extend: if bid is within the last N minutes of end time
    let autoExtended = false;
    const autoExtendMinutes = auction.auto_extend_minutes || 5;
    const endsAt = new Date(auction.ends_at);
    const extensionThreshold = new Date(
      endsAt.getTime() - autoExtendMinutes * 60 * 1000
    );

    let newEndsAt = auction.ends_at;
    if (new Date() >= extensionThreshold) {
      newEndsAt = new Date(
        endsAt.getTime() + autoExtendMinutes * 60 * 1000
      ).toISOString();
      autoExtended = true;
    }

    // 7. Update auction current_price and optionally extend end time
    const updatePayload: Record<string, unknown> = {
      current_price: bidAmount,
    };
    if (autoExtended) {
      updatePayload.ends_at = newEndsAt;
    }

    // Optimistic lock: only update if current_price hasn't changed (another bid)
    const { data: updatedAuction, error: updateError } = await sb
      .from("auctions")
      .update(updatePayload)
      .eq("id", auctionId)
      .eq("current_price", currentPrice)
      .select("id")
      .single();

    if (updateError || !updatedAuction) {
      // Race condition: another bid changed the price. Refund our escrow.
      try {
        await refundEscrow(escrowId);
      } catch {
        // Best-effort refund
      }
      // Mark our bid as cancelled
      await sb.from("auction_bids").update({ status: "cancelled" }).eq("id", newBid.id);
      return {
        success: false,
        error: "Another bid was placed simultaneously. Your escrow has been refunded. Please try again.",
      };
    }

    return {
      success: true,
      bidId: newBid.id,
      escrowId,
      newCurrentPrice: bidAmount,
      autoExtended,
    };
  } catch (err) {
    void log.error("placeBid unexpected error", { error: err instanceof Error ? err.message : String(err) });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error placing bid",
    };
  }
}

/**
 * Settle an ended English auction.
 * Called by the settlement cron job.
 */
export async function settleEnglishAuction(auctionId: string): Promise<{
  success: boolean;
  winnerId?: string;
  finalPrice?: number;
  error?: string;
}> {
  const supabase = createAdminClient();
  const sb = supabase;

  try {
    // 1. Get auction and verify it should be settled
    const { data: auction, error: auctionError } = await sb
      .from("auctions")
      .select("*")
      .eq("id", auctionId)
      .single();

    if (auctionError || !auction) {
      return { success: false, error: "Auction not found" };
    }

    if (auction.status !== "active") {
      return { success: false, error: `Auction is not active (status: ${auction.status})` };
    }

    if (new Date(auction.ends_at) > new Date()) {
      return { success: false, error: "Auction has not ended yet" };
    }

    // 2. Find the highest active bid
    const { data: winningBid } = await sb
      .from("auction_bids")
      .select("*")
      .eq("auction_id", auctionId)
      .eq("status", "active")
      .order("bid_amount", { ascending: false })
      .limit(1)
      .single();

    // 3. Check if there's a winner
    const reservePrice = auction.reserve_price
      ? Number(auction.reserve_price)
      : null;
    const hasWinner =
      winningBid &&
      (reservePrice === null || Number(winningBid.bid_amount) >= reservePrice);

    if (!hasWinner) {
      // No winner — cancel auction, refund all remaining held bids
      await sb
        .from("auctions")
        .update({
          status: "cancelled",
          final_price: null,
          winner_id: null,
        })
        .eq("id", auctionId);

      // Refund all active bids (there might be none, or one that didn't meet reserve)
      const { data: activeBids } = await sb
        .from("auction_bids")
        .select("id, escrow_hold_id")
        .eq("auction_id", auctionId)
        .eq("status", "active");

      if (activeBids && activeBids.length > 0) {
        for (const bid of activeBids) {
          await sb
            .from("auction_bids")
            .update({ status: "cancelled" })
            .eq("id", bid.id);

          if (bid.escrow_hold_id) {
            try {
              await refundEscrow(bid.escrow_hold_id);
            } catch (err) {
              void log.error("Failed to refund escrow during auction cancellation", {
                escrowHoldId: bid.escrow_hold_id,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }
      }

      return {
        success: true,
        error: reservePrice
          ? "Reserve price not met"
          : "No bids received",
      };
    }

    // 4. We have a winner — settle the auction
    const finalPrice = Number(winningBid.bid_amount);

    // Update auction
    // Atomic settlement: only if still active (prevents double-settlement)
    const { error: settleError } = await sb
      .from("auctions")
      .update({
        status: "ended",
        winner_id: winningBid.bidder_id,
        final_price: finalPrice,
      })
      .eq("id", auctionId)
      .eq("status", "active");

    if (settleError) {
      return { success: false, error: "Failed to settle auction (may already be settled)" };
    }

    // Mark winning bid
    await sb
      .from("auction_bids")
      .update({ status: "won" })
      .eq("id", winningBid.id);

    // 5. Release escrow to seller minus platform fee
    if (winningBid.escrow_hold_id) {
      const sellerWallet = await getOrCreateWallet(auction.seller_id, "user");

      const { feeAmount } = await calculatePlatformFee(
        sellerWallet.id,
        finalPrice
      );

      try {
        await releaseEscrow(
          winningBid.escrow_hold_id,
          sellerWallet.id,
          feeAmount
        );
      } catch (err) {
        void log.error("Failed to release escrow to seller", {
          escrowHoldId: winningBid.escrow_hold_id,
          error: err instanceof Error ? err.message : String(err),
        });
        await Promise.allSettled([
          sb
            .from("auctions")
            .update({
              status: "active",
              winner_id: null,
              final_price: null,
            })
            .eq("id", auctionId)
            .eq("status", "ended"),
          sb.from("auction_bids").update({ status: "active" }).eq("id", winningBid.id),
        ]);
        return {
          success: false,
          error: `Escrow release failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    return {
      success: true,
      winnerId: winningBid.bidder_id,
      finalPrice,
    };
  } catch (err) {
    void log.error("settleEnglishAuction unexpected error", { error: err instanceof Error ? err.message : String(err) });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error settling auction",
    };
  }
}
