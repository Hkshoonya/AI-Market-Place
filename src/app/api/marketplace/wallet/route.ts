/**
 * Marketplace Wallet API
 *
 * GET  /api/marketplace/wallet -- Get current user's wallet balance + transaction history
 * POST /api/marketplace/wallet -- Create wallet if not exists, return wallet info
 */

import { NextRequest, NextResponse } from "next/server";
import type { WalletTxType } from "@/types/database";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import {
  ensureWalletDepositAddresses,
  getOrCreateWallet,
  getWalletBalance,
  getTransactionHistory,
  getTransactionHistoryCount,
} from "@/lib/payments/wallet";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const WALLET_TX_TYPES = new Set<WalletTxType>([
  "deposit",
  "purchase",
  "sale",
  "withdrawal",
]);

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
    const { searchParams } = new URL(request.url);
    const limitParam = Number.parseInt(searchParams.get("limit") || "20", 10);
    const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
    const typeParam = searchParams.get("type");
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 20;
    const page = Number.isFinite(pageParam) ? Math.max(pageParam, 1) : 1;
    const offset = (page - 1) * limit;
    const type: WalletTxType | undefined =
      typeParam && WALLET_TX_TYPES.has(typeParam as WalletTxType)
        ? (typeParam as WalletTxType)
        : undefined;

    const wallet = await getOrCreateWallet(user.id);
    const balance = await getWalletBalance(wallet.id);
    const [transactions, totalTransactions] = await Promise.all([
      getTransactionHistory(wallet.id, {
        limit,
        offset,
        type,
      }),
      getTransactionHistoryCount(wallet.id, {
        type,
      }),
    ]);

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
      total_transactions: totalTransactions,
      page,
      limit,
      type: type ?? "all",
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
    const provisionedWallet = await ensureWalletDepositAddresses(wallet);

    if (
      !provisionedWallet.deposit_address_solana &&
      !provisionedWallet.deposit_address_evm
    ) {
      return NextResponse.json(
        {
          error:
            "Wallet address generation is not configured yet. Configure at least one supported wallet infrastructure and try again.",
        },
        { status: 503 }
      );
    }

    const balance = await getWalletBalance(wallet.id);

    return NextResponse.json(
      {
        balance: balance.available,
        escrow_balance: balance.held,
        total_earned: balance.totalEarned,
        total_spent: balance.totalSpent,
        primary_chain: provisionedWallet.primary_chain || null,
        solana_deposit_address: provisionedWallet.deposit_address_solana || null,
        evm_deposit_address: provisionedWallet.deposit_address_evm || null,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err, "api/marketplace/wallet");
  }
}
