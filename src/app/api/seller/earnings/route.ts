/**
 * GET /api/seller/earnings
 *
 * Seller earnings dashboard API.
 * Returns wallet balance, held funds, total earned, fee rate, and recent transactions.
 *
 * Requires auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuthUser } from "@/lib/auth/resolve-user";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import {
  getOrCreateWallet,
  getWalletBalance,
  getTransactionHistory,
  calculatePlatformFee,
} from "@/lib/payments/wallet";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`seller-earnings:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  // Authenticate (session or API key)
  const auth = await resolveAuthUser(request, ["marketplace", "read"]);
  if (!auth) {
    return NextResponse.json(
      {
        error:
          "Authentication required. Please sign in to view your earnings.",
      },
      { status: 401 }
    );
  }

  try {
    const wallet = await getOrCreateWallet(auth.userId);
    const balance = await getWalletBalance(wallet.id);

    // Get the seller's current fee rate (use a $100 sample to determine tier)
    const { feeRate } = await calculatePlatformFee(wallet.id, 100);

    // Get recent transactions filtered to sale-related types
    const allTransactions = await getTransactionHistory(wallet.id, {
      limit: 50,
    });

    const earningsTypes = [
      "sale",
      "escrow_release",
      "platform_fee",
      "withdrawal",
      "refund",
    ];

    const recentTransactions = allTransactions.filter(
      (tx: any) => earningsTypes.includes(tx.type) // eslint-disable-line @typescript-eslint/no-explicit-any
    );

    return NextResponse.json({
      balance: balance.available,
      held: balance.held,
      totalEarned: balance.totalEarned,
      totalSpent: balance.totalSpent,
      feeRate,
      feePercentage: `${(feeRate * 100).toFixed(1)}%`,
      recentTransactions,
    });
  } catch (err) {
    return handleApiError(err, "api/seller/earnings");
  }
}
