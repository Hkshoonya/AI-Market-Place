/**
 * Withdrawal Service
 * Handles the full withdrawal flow: validate -> debit -> send on-chain -> confirm
 */

import {
  debitWallet,
  creditWallet,
  type Chain,
  type Token,
} from "./wallet";
import { sendSolanaTransfer, isSolanaConfigured } from "./chains/solana";
import { sendEvmTransfer, isEvmConfigured } from "./chains/evm";
import { createAdminClient } from "@/lib/supabase/admin";

export interface WithdrawalRequest {
  walletId: string;
  amount: number;
  chain: Chain;
  toAddress: string;
  token?: Token;
}

export interface WithdrawalResult {
  success: boolean;
  txId?: string; // Internal transaction ID
  txHash?: string; // On-chain transaction hash
  error?: string;
}

// Minimum withdrawal amounts per chain (in USDC equivalent)
const MIN_WITHDRAWAL: Record<string, number> = {
  solana: 1.0,
  base: 5.0, // Higher due to potential gas
  polygon: 1.0,
};

// Withdrawal fee per chain (covers gas costs)
const WITHDRAWAL_FEE: Record<string, number> = {
  solana: 0.01,
  base: 0.5,
  polygon: 0.1,
};

/**
 * Process a withdrawal request.
 *
 * Flow:
 * 1. Validate amount and chain configuration
 * 2. Debit wallet (atomic - balance check + deduct)
 * 3. Send on-chain transaction
 * 4. On success: update transaction with tx_hash
 * 5. On failure: refund the wallet
 */
export async function processWithdrawal(
  req: WithdrawalRequest
): Promise<WithdrawalResult> {
  const { walletId, amount, chain, toAddress, token = "USDC" } = req;

  // Validate chain is configured
  if (chain === "solana" && !isSolanaConfigured()) {
    return { success: false, error: "Solana withdrawals not configured" };
  }
  if (
    (chain === "base" || chain === "polygon") &&
    !isEvmConfigured(chain)
  ) {
    return { success: false, error: `${chain} withdrawals not configured` };
  }
  if (chain === "internal") {
    return { success: false, error: "Cannot withdraw to internal chain" };
  }

  // Validate minimum amount
  const minAmount = MIN_WITHDRAWAL[chain] || 1.0;
  if (amount < minAmount) {
    return {
      success: false,
      error: `Minimum withdrawal for ${chain} is $${minAmount}`,
    };
  }

  // Calculate fee
  const fee = WITHDRAWAL_FEE[chain] || 0;
  const totalDebit = amount + fee;

  // Step 1: Debit wallet (atomic balance check + deduction)
  let txId: string;
  try {
    txId = await debitWallet(walletId, totalDebit, "withdrawal", {
      referenceType: "withdrawal",
      description: `Withdrawal of ${amount} ${token} to ${toAddress} on ${chain} (fee: ${fee})`,
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to debit wallet",
    };
  }

  // Step 2: Send on-chain transaction
  try {
    let txHash: string;

    if (chain === "solana") {
      const result = await sendSolanaTransfer(toAddress, amount, token);
      txHash = result.txHash;
    } else {
      const result = await sendEvmTransfer(
        chain as "base" | "polygon",
        toAddress,
        amount,
        token
      );
      txHash = result.txHash;
    }

    // Step 3: Update transaction with on-chain tx hash
    const supabase = createAdminClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    await supabase
      .from("wallet_transactions")
      .update({ tx_hash: txHash, chain, status: "confirmed" })
      .eq("id", txId);

    return { success: true, txId, txHash };
  } catch (err) {
    // Step 4: On-chain send failed -- refund the wallet
    try {
      await creditWallet(walletId, totalDebit, "refund", {
        referenceType: "withdrawal_refund",
        description: `Refund for failed ${chain} withdrawal`,
      });

      // Mark original tx as failed
      const supabase = createAdminClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      await supabase
        .from("wallet_transactions")
        .update({ status: "failed" })
        .eq("id", txId);
    } catch (refundErr) {
      // Critical: refund failed -- log for manual intervention
      console.error(
        "[withdraw] CRITICAL: Failed to refund wallet after failed withdrawal",
        {
          walletId,
          txId,
          amount,
          error: refundErr,
        }
      );
    }

    return {
      success: false,
      txId,
      error:
        err instanceof Error ? err.message : "On-chain transfer failed",
    };
  }
}

/**
 * Get supported chains with their configuration status.
 */
export function getSupportedChains(): Array<{
  chain: Chain;
  configured: boolean;
  minWithdrawal: number;
  fee: number;
}> {
  return [
    {
      chain: "solana",
      configured: isSolanaConfigured(),
      minWithdrawal: MIN_WITHDRAWAL.solana,
      fee: WITHDRAWAL_FEE.solana,
    },
    {
      chain: "base",
      configured: isEvmConfigured("base"),
      minWithdrawal: MIN_WITHDRAWAL.base,
      fee: WITHDRAWAL_FEE.base,
    },
    {
      chain: "polygon",
      configured: isEvmConfigured("polygon"),
      minWithdrawal: MIN_WITHDRAWAL.polygon,
      fee: WITHDRAWAL_FEE.polygon,
    },
  ];
}
