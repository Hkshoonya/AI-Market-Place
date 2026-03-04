/**
 * POST /api/marketplace/auctions/:id/bid
 * Place a bid on an English auction.
 * Body: { amount: number, quantity?: number }
 *
 * Requires authentication (session or API key).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveAuthUser } from "@/lib/auth/resolve-user";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { placeBid } from "@/lib/marketplace/auctions/english";
import { handleApiError } from "@/lib/api-error";

const bidSchema = z.object({
  amount: z.number().positive("Bid amount must be positive").max(10_000_000, "Bid amount exceeds maximum"),
  quantity: z.number().int().positive().optional().default(1),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const ip = getClientIp(request);
  const rl = rateLimit(`auction-bid:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { id: auctionId } = await params;

  // Authenticate (session or API key)
  const auth = await resolveAuthUser(request, ["marketplace", "write"]);
  if (!auth) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to place a bid." },
      { status: 401 }
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = bidSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Place the bid via English auction logic
  const result = await placeBid(
    auctionId,
    auth.userId,
    parsed.data.amount,
    auth.authMethod === "api_key" ? "agent" : "user"
  );

  if (!result.success) {
    // Determine appropriate HTTP status
    const status = result.error?.includes("not found")
      ? 404
      : result.error?.includes("not active") ||
          result.error?.includes("has ended") ||
          result.error?.includes("not an English") ||
          result.error?.includes("Sellers cannot")
        ? 400
        : result.error?.includes("Insufficient")
          ? 402
          : 422;

    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(
    {
      data: {
        bid_id: result.bidId,
        escrow_id: result.escrowId,
        current_price: result.newCurrentPrice,
        auto_extended: result.autoExtended,
      },
    },
    { status: 201 }
  );
  } catch (err) {
    return handleApiError(err, "api/marketplace/auctions/bid");
  }
}
