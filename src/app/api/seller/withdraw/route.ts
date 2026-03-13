/**
 * POST /api/seller/withdraw
 *
 * Initiate a withdrawal of funds from the seller's wallet to an on-chain address.
 *
 * Body: { amount: number, chain: "solana" | "base" | "polygon", wallet_address: string }
 *
 * Requires auth + verified seller status.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveAuthUser } from "@/lib/auth/resolve-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { getOrCreateWallet, getWalletBalance } from "@/lib/payments/wallet";
import {
  processWithdrawal,
  getSupportedChains,
} from "@/lib/payments/withdraw";
import { handleApiError } from "@/lib/api-error";
import { systemLog } from "@/lib/logging";
import { isRuntimeFlagEnabled } from "@/lib/runtime-flags";

const withdrawSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  chain: z.enum(["solana", "base", "polygon"], {
    message: "chain must be one of: solana, base, polygon",
  }),
  wallet_address: z
    .string()
    .min(20, "wallet_address is too short")
    .max(200, "wallet_address is too long"),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
  const ip = getClientIp(request);
  const rl = await rateLimit(`seller-withdraw:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const enforceWithdrawScope = isRuntimeFlagEnabled("ENFORCE_WITHDRAW_SCOPE");
  const requiredScopes = enforceWithdrawScope
    ? ["withdraw"]
    : ["withdraw", "marketplace", "write"];

  // Auth (session or API key)
  const auth = await resolveAuthUser(request, requiredScopes);
  if (!auth) {
    return NextResponse.json(
      {
        error:
          "Authentication required. Please sign in to withdraw funds.",
      },
      { status: 401 }
    );
  }

  if (
    !enforceWithdrawScope &&
    auth.authMethod === "api_key" &&
    !(auth.apiKeyScopes ?? []).includes("withdraw")
  ) {
    await systemLog.warn(
      "api/seller/withdraw",
      "Deprecated legacy withdraw scope used",
      {
        userId: auth.userId,
        apiKeyId: auth.apiKeyId ?? null,
        scopes: auth.apiKeyScopes ?? [],
      }
    );
  }

  // Verify seller status (use admin client for profile query)
  const adminSb = createAdminClient();
  const { data: profile } = await adminSb
    .from("profiles")
    .select("is_seller, seller_verified")
    .eq("id", auth.userId)
    .single();

  if (!profile?.is_seller) {
    return NextResponse.json(
      { error: "You must be a registered seller to withdraw funds." },
      { status: 403 }
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = withdrawSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { amount, chain, wallet_address } = parsed.data;

  // Get wallet
  const wallet = await getOrCreateWallet(auth.userId);

  // Verify available balance covers withdrawal
  const balance = await getWalletBalance(wallet.id);
  if (balance.available < amount) {
    return NextResponse.json(
      {
        error: `Insufficient available balance. Available: $${balance.available.toFixed(2)}, Held in escrow: $${balance.held.toFixed(2)}, Requested: $${amount.toFixed(2)}`,
      },
      { status: 400 }
    );
  }

  // Process withdrawal
  const result = await processWithdrawal({
    walletId: wallet.id,
    amount,
    chain,
    toAddress: wallet_address,
    token: "USDC",
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Withdrawal failed. Please try again later." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    tx_id: result.txId,
    tx_hash: result.txHash,
    amount,
    chain,
    wallet_address,
    message: `Withdrawal of $${amount.toFixed(2)} initiated on ${chain}.`,
  });
  } catch (err) {
    return handleApiError(err, "api/seller/withdraw");
  }
}

/**
 * GET /api/seller/withdraw
 * Returns supported chains and their configuration.
 */
export async function GET(request: NextRequest) {
  try {
  const ip = getClientIp(request);
  const rl = await rateLimit(`seller-withdraw-info:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  // Authenticate (session or API key)
  const authResult = await resolveAuthUser(request, [
    "withdraw",
    "marketplace",
    "read",
  ]);
  if (!authResult) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const chains = getSupportedChains();

  return NextResponse.json({ chains });
  } catch (err) {
    return handleApiError(err, "api/seller/withdraw");
  }
}
