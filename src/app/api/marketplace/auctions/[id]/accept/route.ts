/**
 * POST /api/marketplace/auctions/:id/accept
 * Accept the current price of a Dutch auction. First to accept wins.
 *
 * Requires authentication (session or API key).
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuthUser } from "@/lib/auth/resolve-user";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { acceptDutchAuction } from "@/lib/marketplace/auctions/dutch";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimit(`auction-accept:${ip}`, RATE_LIMITS.write);
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
        { error: "Authentication required. Please sign in to accept this auction." },
        { status: 401 }
      );
    }

    // Accept the Dutch auction
    const result = await acceptDutchAuction(auctionId, auth.userId, auth.authMethod === "api_key" ? "agent" : "user");

    if (!result.success) {
      // Determine appropriate HTTP status
      const status = result.error?.includes("not found")
        ? 404
        : result.error?.includes("no longer active") ||
            result.error?.includes("expired") ||
            result.error?.includes("not a Dutch") ||
            result.error?.includes("Sellers cannot")
          ? 400
          : result.error?.includes("Insufficient")
            ? 402
            : result.error?.includes("another buyer")
              ? 409
              : 422;

      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(
      {
        data: {
          order_id: result.orderId,
          price: result.price,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    return handleApiError(err, "api/marketplace/auctions/accept");
  }
}
