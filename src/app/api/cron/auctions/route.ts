/**
 * GET /api/cron/auctions
 *
 * Auction settlement cron job. Runs every 5 minutes via Vercel cron.
 *
 * 1. Activates upcoming auctions whose starts_at <= now
 * 2. Settles English auctions where ends_at < now AND status = 'active'
 * 3. Cancels Dutch auctions that expired unsold (ends_at < now AND status = 'active')
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleEnglishAuction } from "@/lib/marketplace/auctions/english";
import { refundEscrow } from "@/lib/payments/wallet";
import { trackCronRun } from "@/lib/cron-tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const tracker = await trackCronRun("auctions");

  const results = {
    activated: 0,
    settled: 0,
    cancelled: 0,
    errors: [] as string[],
  };

  try {
    // Quick check: if the auctions table doesn't exist yet, exit gracefully
    const { error: tableCheck } = await supabase
      .from("auctions")
      .select("id")
      .limit(0);

    if (tableCheck) {
      const msg = tableCheck.message || "";
      const code = tableCheck.code || "";
      if (
        msg.includes("does not exist") ||
        msg.includes("Could not find") ||
        msg.includes("relation") ||
        code === "42P01" ||
        code === "PGRST205" ||
        code === "PGRST204"
      ) {
        return NextResponse.json({
          ok: true,
          message: "Auctions table not yet created. Skipping.",
          activated: 0,
          settled: 0,
          cancelled: 0,
        });
      }
    }

    // ---------------------------------------------------------------
    // Step 1: Activate upcoming auctions whose start time has passed
    // ---------------------------------------------------------------
    const { data: upcomingAuctions, error: upcomingError } = await supabase
      .from("auctions")
      .select("id")
      .eq("status", "upcoming")
      .lte("starts_at", new Date().toISOString());

    if (upcomingError) {
      results.errors.push(`Failed to query upcoming auctions: ${upcomingError.message}`);
    } else if (upcomingAuctions && upcomingAuctions.length > 0) {
      const ids = upcomingAuctions.map((a) => a.id);
      const { error: activateError, count } = await supabase
        .from("auctions")
        .update({ status: "active" })
        .in("id", ids)
        .eq("status", "upcoming"); // Safety: only update if still upcoming

      if (activateError) {
        results.errors.push(`Failed to activate auctions: ${activateError.message}`);
      } else {
        results.activated = count ?? ids.length;
      }
    }

    // ---------------------------------------------------------------
    // Step 2: Find all expired active auctions
    // ---------------------------------------------------------------
    const { data: expiredAuctions, error: expiredError } = await supabase
      .from("auctions")
      .select("id, auction_type")
      .eq("status", "active")
      .lte("ends_at", new Date().toISOString())
      .order("ends_at", { ascending: true })
      .limit(100); // Process in batches to stay within time limits

    if (expiredError) {
      results.errors.push(`Failed to query expired auctions: ${expiredError.message}`);
    } else if (expiredAuctions && expiredAuctions.length > 0) {
      for (const auction of expiredAuctions) {
        try {
          if (auction.auction_type === "english" || auction.auction_type === "batch") {
            // -------------------------------------------------------
            // Step 2a: Settle English / Batch auctions
            // -------------------------------------------------------
            const settleResult = await settleEnglishAuction(auction.id);
            if (settleResult.success) {
              results.settled++;
            } else {
              results.errors.push(
                `Settle auction ${auction.id}: ${settleResult.error}`
              );
            }
          } else if (auction.auction_type === "dutch") {
            // -------------------------------------------------------
            // Step 2b: Cancel expired Dutch auctions (unsold)
            // Dutch auctions that ended without being accepted are cancelled.
            // -------------------------------------------------------
            await supabase
              .from("auctions")
              .update({ status: "cancelled" })
              .eq("id", auction.id)
              .eq("status", "active"); // Safety check

            // Refund any escrow holds (shouldn't normally exist for Dutch,
            // but handle edge cases)
            const { data: activeBids } = await supabase
              .from("auction_bids")
              .select("id, escrow_hold_id")
              .eq("auction_id", auction.id)
              .eq("status", "active");

            if (activeBids && activeBids.length > 0) {
              for (const bid of activeBids) {
                await supabase
                  .from("auction_bids")
                  .update({ status: "cancelled" })
                  .eq("id", bid.id);

                if (bid.escrow_hold_id) {
                  try {
                    await refundEscrow(bid.escrow_hold_id);
                  } catch (err) {
                    console.error(
                      `Cron: Failed to refund escrow ${bid.escrow_hold_id}:`,
                      err
                    );
                  }
                }
              }
            }

            results.cancelled++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.errors.push(
            `Error processing auction ${auction.id}: ${message}`
          );
        }
      }
    }
  } catch (err) {
    console.error("Auction cron job failed:", err);
    return tracker.fail(err);
  }

  return tracker.complete({
    activated: results.activated,
    settled: results.settled,
    cancelled: results.cancelled,
    errors: results.errors.length > 0 ? results.errors : undefined,
  });
}
