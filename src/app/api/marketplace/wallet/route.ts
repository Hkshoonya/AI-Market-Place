/**
 * Marketplace Wallet API
 *
 * GET  /api/marketplace/wallet -- Get current user's wallet balance + transaction history
 * POST /api/marketplace/wallet -- Create wallet if not exists, return wallet info
 */

import { NextRequest, NextResponse } from "next/server";
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
} from "@/lib/payments/wallet";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`wallet-read:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to view your wallet." },
      { status: 401 }
    );
  }

  try {
    const wallet = await getOrCreateWallet(user.id);
    const balance = await getWalletBalance(wallet.id);
    const transactions = await getTransactionHistory(wallet.id, { limit: 20 });

    // Flatten response to match client expectations (wallet-content.tsx, purchase-button.tsx)
    return NextResponse.json({
      balance: balance.available,
      escrow_balance: balance.held,
      total_earned: balance.totalEarned,
      total_spent: balance.totalSpent,
      primary_chain: wallet.primary_chain || null,
      solana_deposit_address: wallet.deposit_address_solana || null,
      evm_deposit_address: wallet.deposit_address_evm || null,
      transactions,
      total_transactions: transactions.length,
    });
  } catch (err) {
    return handleApiError(err, "api/marketplace/wallet");
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`wallet-create:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Authentication required. Please sign in to create a wallet.",
      },
      { status: 401 }
    );
  }

  try {
    const wallet = await getOrCreateWallet(user.id);
    const balance = await getWalletBalance(wallet.id);

    return NextResponse.json(
      {
        balance: balance.available,
        escrow_balance: balance.held,
        total_earned: balance.totalEarned,
        total_spent: balance.totalSpent,
        primary_chain: wallet.primary_chain || null,
        solana_deposit_address: wallet.deposit_address_solana || null,
        evm_deposit_address: wallet.deposit_address_evm || null,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err, "api/marketplace/wallet");
  }
}
