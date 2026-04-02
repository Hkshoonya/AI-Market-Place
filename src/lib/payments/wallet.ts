import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRuntimeFlagEnabled } from "@/lib/runtime-flags";
import {
  generateEvmDepositAddress,
  isEvmConfigured,
} from "@/lib/payments/chains/evm";
import {
  generateSolanaDepositAddress,
  isSolanaConfigured,
} from "@/lib/payments/chains/solana";
import type {
  Wallet,
  WalletTransaction,
  EscrowHold,
  WalletOwnerType,
  WalletTxType,
  ChainType,
  TokenType,
  EscrowReason,
  TypedSupabaseClient,
} from "@/types/database";

// Re-export domain aliases for convenience
export type OwnerType = WalletOwnerType;
export type TxType = WalletTxType;
export type TxStatus = "pending" | "confirmed" | "failed";
export type Chain = ChainType;
export type Token = TokenType;
export type EscrowStatus = "held" | "released" | "refunded";
export { type EscrowReason } from "@/types/database";

// Re-export row types
export type { Wallet, WalletTransaction, EscrowHold };

export interface WalletBalance {
  available: number;
  held: number;
  total: number;
  totalEarned: number;
  totalSpent: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function adminClient(): TypedSupabaseClient {
  return createAdminClient();
}

function getWalletDerivationIndex(walletId: string): number {
  const hash = createHash("sha256").update(walletId).digest();
  return hash.readUInt32BE(0);
}

// ---------------------------------------------------------------------------
// Core wallet operations
// ---------------------------------------------------------------------------

/**
 * Return the wallet for the given owner, creating one if it doesn't exist.
 */
export async function getOrCreateWallet(
  ownerId: string,
  ownerType: OwnerType = "user"
): Promise<Wallet> {
  const sb = adminClient();

  // Try to find an existing wallet first
  const { data: existing, error: fetchError } = await sb
    .from("wallets")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("owner_type", ownerType)
    .single();

  if (existing && !fetchError) {
    return existing as Wallet;
  }

  // Not found — create a new wallet with sensible defaults
  const { data: created, error: createError } = await sb
    .from("wallets")
    .insert({
      owner_id: ownerId,
      owner_type: ownerType,
      balance: 0,
      held_balance: 0,
      total_earned: 0,
      total_spent: 0,
      primary_chain: "solana" as ChainType,
      is_active: true,
    })
    .select("*")
    .single();

  if (createError) {
    throw new Error(`Failed to create wallet: ${createError.message}`);
  }

  return created as Wallet;
}

/**
 * Look up a wallet by owner. Returns null when none exists.
 */
export async function getWalletByOwner(
  ownerId: string,
  ownerType: OwnerType = "user"
): Promise<Wallet | null> {
  const sb = adminClient();

  const { data, error } = await sb
    .from("wallets")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("owner_type", ownerType)
    .single();

  if (error || !data) return null;
  return data as Wallet;
}

/**
 * Populate on-chain deposit addresses for a wallet when chain infrastructure
 * is configured and the wallet has not been provisioned yet.
 */
export async function ensureWalletDepositAddresses(wallet: Wallet): Promise<Wallet> {
  const needsSolanaAddress =
    !wallet.deposit_address_solana && isSolanaConfigured();
  const needsEvmAddress = !wallet.deposit_address_evm && isEvmConfigured();

  if (!needsSolanaAddress && !needsEvmAddress) {
    return wallet;
  }

  const derivationIndex = getWalletDerivationIndex(wallet.id);
  const [solanaDepositAddress, evmDepositAddress] = await Promise.all([
    needsSolanaAddress
      ? generateSolanaDepositAddress(derivationIndex)
      : wallet.deposit_address_solana,
    needsEvmAddress
      ? generateEvmDepositAddress(derivationIndex)
      : wallet.deposit_address_evm,
  ]);

  const sb = adminClient();
  const { data, error } = await sb
    .from("wallets")
    .update({
      deposit_address_solana: solanaDepositAddress,
      deposit_address_evm: evmDepositAddress,
      primary_chain:
        wallet.primary_chain ??
        (solanaDepositAddress ? "solana" : evmDepositAddress ? "base" : null),
    })
    .eq("id", wallet.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to provision wallet deposit addresses: ${error?.message ?? "unknown error"}`);
  }

  return data as Wallet;
}

/**
 * Return computed balance information for a wallet.
 */
export async function getWalletBalance(
  walletId: string
): Promise<WalletBalance> {
  const sb = adminClient();

  const { data, error } = await sb
    .from("wallets")
    .select("balance, held_balance, total_earned, total_spent")
    .eq("id", walletId)
    .single();

  if (error || !data) {
    throw new Error(`Wallet not found: ${walletId}`);
  }

  return {
    available: Number(data.balance),
    held: Number(data.held_balance),
    total: Number(data.balance) + Number(data.held_balance),
    totalEarned: Number(data.total_earned),
    totalSpent: Number(data.total_spent),
  };
}

// ---------------------------------------------------------------------------
// Credits / Debits
// ---------------------------------------------------------------------------

/**
 * Credit (add funds to) a wallet. Returns the new transaction id.
 */
export async function creditWallet(
  walletId: string,
  amount: number,
  txType: TxType,
  opts?: {
    chain?: Chain;
    txHash?: string;
    token?: Token;
    referenceType?: string;
    referenceId?: string;
    description?: string;
  }
): Promise<string> {
  const sb = adminClient();

  const { data, error } = await sb.rpc("credit_wallet", {
    p_wallet_id: walletId,
    p_amount: amount,
    p_tx_type: txType,
    p_chain: opts?.chain ?? "internal",
    p_tx_hash: opts?.txHash ?? null,
    p_token: opts?.token ?? "USDC",
    p_reference_type: opts?.referenceType ?? null,
    p_reference_id: opts?.referenceId ?? null,
    p_description: opts?.description ?? null,
  });

  if (error) {
    throw new Error(`credit_wallet failed: ${error.message}`);
  }

  return data as string;
}

/**
 * Debit (subtract funds from) a wallet. Returns the new transaction id.
 */
export async function debitWallet(
  walletId: string,
  amount: number,
  txType: TxType,
  opts?: {
    referenceType?: string;
    referenceId?: string;
    description?: string;
  }
): Promise<string> {
  const sb = adminClient();

  const { data, error } = await sb.rpc("debit_wallet", {
    p_wallet_id: walletId,
    p_amount: amount,
    p_tx_type: txType,
    p_reference_type: opts?.referenceType ?? null,
    p_reference_id: opts?.referenceId ?? null,
    p_description: opts?.description ?? null,
  });

  if (error) {
    throw new Error(`debit_wallet failed: ${error.message}`);
  }

  return data as string;
}

// ---------------------------------------------------------------------------
// Escrow
// ---------------------------------------------------------------------------

/**
 * Place funds in escrow. Returns the escrow_hold id.
 */
export async function holdEscrow(
  walletId: string,
  amount: number,
  reason: EscrowReason,
  referenceType: string,
  referenceId: string
): Promise<string> {
  const sb = adminClient();

  const { data, error } = await sb.rpc("hold_escrow", {
    p_wallet_id: walletId,
    p_amount: amount,
    p_reason: reason,
    p_reference_type: referenceType,
    p_reference_id: referenceId,
  });

  if (error) {
    throw new Error(`hold_escrow failed: ${error.message}`);
  }

  return data as string;
}

/**
 * Release escrowed funds to a recipient wallet, optionally deducting a
 * platform fee.
 */
export async function releaseEscrow(
  escrowId: string,
  toWalletId: string,
  platformFee?: number
): Promise<void> {
  const sb = adminClient();

  const { error } = await sb.rpc("release_escrow", {
    p_escrow_id: escrowId,
    p_to_wallet_id: toWalletId,
    p_platform_fee: platformFee ?? 0,
  });

  if (error) {
    throw new Error(`release_escrow failed: ${error.message}`);
  }
}

/**
 * Refund escrowed funds back to the original wallet.
 */
export async function refundEscrow(escrowId: string): Promise<void> {
  const sb = adminClient();

  const { error } = await sb.rpc("refund_escrow", {
    p_escrow_id: escrowId,
  });

  if (error) {
    throw new Error(`refund_escrow failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Platform fees
// ---------------------------------------------------------------------------

export function isMarketplaceFeesEnabled() {
  return isRuntimeFlagEnabled("ENABLE_MARKETPLACE_FEES", false);
}

/**
 * Calculate the platform fee for a given wallet and transaction amount based
 * on the wallet's lifetime earnings and the `platform_fee_tiers` table.
 *
 * NOTE: Fee tier is based on total_earned at query time. A seller could
 * theoretically game tiers by splitting sales across multiple wallets.
 * This is an accepted limitation — enforcing single-wallet-per-user is
 * handled by the UNIQUE constraint on wallets(owner_id, owner_type).
 */
export async function calculatePlatformFee(
  walletId: string,
  amount: number
): Promise<{ feeRate: number; feeAmount: number; netAmount: number }> {
  if (!isMarketplaceFeesEnabled()) {
    return {
      feeRate: 0,
      feeAmount: 0,
      netAmount: amount,
    };
  }

  const sb = adminClient();

  // Get the wallet's lifetime earnings
  const { data: wallet, error: walletError } = await sb
    .from("wallets")
    .select("total_earned")
    .eq("id", walletId)
    .single();

  if (walletError || !wallet) {
    throw new Error(`Wallet not found: ${walletId}`);
  }

  const totalEarned = Number(wallet.total_earned);

  // Find the matching fee tier
  const { data: tier, error: tierError } = await sb
    .from("platform_fee_tiers")
    .select("fee_percentage")
    .lte("min_lifetime_sales", totalEarned)
    .or(`max_lifetime_sales.gte.${totalEarned},max_lifetime_sales.is.null`)
    .order("min_lifetime_sales", { ascending: false })
    .limit(1)
    .single();

  if (tierError || !tier) {
    // Default to a 5 % fee if no matching tier is found
    const defaultRate = 0.05;
    const feeAmount = Math.round(amount * defaultRate * 100) / 100;
    return {
      feeRate: defaultRate,
      feeAmount,
      netAmount: Math.round((amount - feeAmount) * 100) / 100,
    };
  }

  const feeRate = Number(tier.fee_percentage) / 100; // stored as e.g. 5 for 5 %
  const feeAmount = Math.round(amount * feeRate * 100) / 100;

  return {
    feeRate,
    feeAmount,
    netAmount: Math.round((amount - feeAmount) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Transaction history
// ---------------------------------------------------------------------------

/**
 * Fetch paginated transaction history for a wallet.
 */
export async function getTransactionHistory(
  walletId: string,
  opts?: {
    limit?: number;
    offset?: number;
    type?: TxType;
    referenceType?: string;
    referenceId?: string;
  }
): Promise<WalletTransaction[]> {
  const sb = adminClient();

  let query = sb
    .from("wallet_transactions")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false });

  if (opts?.type) {
    query = query.eq("type", opts.type);
  }

  if (opts?.referenceType) {
    query = query.eq("reference_type", opts.referenceType);
  }

  if (opts?.referenceId) {
    query = query.eq("reference_id", opts.referenceId);
  }

  if (opts?.limit) {
    query = query.limit(opts.limit);
  } else {
    query = query.limit(50);
  }

  if (opts?.offset) {
    query = query.range(opts.offset, opts.offset + (opts?.limit ?? 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  return (data ?? []) as WalletTransaction[];
}

/**
 * Count transactions for a wallet, optionally filtered by type.
 */
export async function getTransactionHistoryCount(
  walletId: string,
  opts?: {
    type?: TxType;
    referenceType?: string;
    referenceId?: string;
  }
): Promise<number> {
  const sb = adminClient();

  let query = sb
    .from("wallet_transactions")
    .select("*", { count: "exact", head: true })
    .eq("wallet_id", walletId);

  if (opts?.type) {
    query = query.eq("type", opts.type);
  }

  if (opts?.referenceType) {
    query = query.eq("reference_type", opts.referenceType);
  }

  if (opts?.referenceId) {
    query = query.eq("reference_id", opts.referenceId);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count transactions: ${error.message}`);
  }

  return count ?? 0;
}
