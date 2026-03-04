import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TypedSupabaseClient } from "@/types/database";
import { creditWallet, type Chain, type Token } from "@/lib/payments/wallet";
import {
  checkSolanaDeposits,
  isSolanaConfigured,
} from "@/lib/payments/chains/solana";
import {
  checkEvmDeposits,
  isEvmConfigured,
} from "@/lib/payments/chains/evm";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 minutes max

type DepositChain = "solana" | "base" | "polygon";

interface DepositSummary {
  processed: number;
  credited: number;
  errors: string[];
}

/**
 * Cron / webhook endpoint for detecting on-chain deposits.
 *
 * Flow:
 * 1. Authenticate via CRON_SECRET bearer token
 * 2. Get all wallets that have deposit addresses
 * 3. For each configured chain, check for new deposits
 * 4. Credit wallets for confirmed deposits (de-duplicated by tx_hash)
 * 5. Return summary
 *
 * Body (optional): { chain?: "solana" | "base" | "polygon" }
 * If chain is specified, only check that chain. Otherwise check all configured chains.
 *
 * Authorization: Bearer ${CRON_SECRET}
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse optional body
  let targetChain: DepositChain | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.chain && ["solana", "base", "polygon"].includes(body.chain)) {
      targetChain = body.chain as DepositChain;
    }
  } catch {
    // No body or invalid JSON -- check all chains
  }

  const summary: DepositSummary = {
    processed: 0,
    credited: 0,
    errors: [],
  };

  try {
    const supabase = createAdminClient();

    // Determine which chains to check
    const chainsToCheck: DepositChain[] = targetChain
      ? [targetChain]
      : (["solana", "base", "polygon"] as DepositChain[]);

    // Filter to only configured chains
    const configuredChains = chainsToCheck.filter((chain) => {
      if (chain === "solana") return isSolanaConfigured();
      return isEvmConfigured(chain);
    });

    if (configuredChains.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No chains configured for deposit checking",
        ...summary,
      });
    }

    // Process each chain
    for (const chain of configuredChains) {
      try {
        if (chain === "solana") {
          await processSolanaDeposits(supabase, summary);
        } else {
          await processEvmDeposits(supabase, chain, summary);
        }
      } catch (err) {
        const msg = `Failed to process ${chain} deposits: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[chain-deposits] ${msg}`);
        summary.errors.push(msg);
      }
    }

    return NextResponse.json({
      ok: true,
      ...summary,
    });
  } catch (err) {
    console.error("[chain-deposits] Unexpected error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        ...summary,
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Chain-specific deposit processors
// ---------------------------------------------------------------------------

async function processSolanaDeposits(
  supabase: TypedSupabaseClient,
  summary: DepositSummary
) {
  // Get all wallets with a Solana deposit address
  const { data: wallets, error: walletsError } = await supabase
    .from("wallets")
    .select("id, deposit_address_solana")
    .not("deposit_address_solana", "is", null)
    .eq("is_active", true);

  if (walletsError || !wallets) {
    summary.errors.push(
      `Failed to fetch Solana wallets: ${walletsError?.message ?? "no data"}`
    );
    return;
  }

  for (const wallet of wallets as Array<{
    id: string;
    deposit_address_solana: string;
  }>) {
    try {
      const deposits = await checkSolanaDeposits(
        wallet.deposit_address_solana
      );
      summary.processed += deposits.length;

      for (const deposit of deposits) {
        // De-duplicate: skip if tx_hash already exists in wallet_transactions
        const alreadyProcessed = await isTxHashProcessed(
          supabase,
          deposit.txHash
        );
        if (alreadyProcessed) continue;

        // Credit the wallet
        try {
          await creditWallet(wallet.id, deposit.amount, "deposit", {
            chain: "solana" as Chain,
            txHash: deposit.txHash,
            token: deposit.token,
            referenceType: "chain_deposit",
            description: `Solana deposit from ${deposit.fromAddress}`,
          });
          summary.credited++;
        } catch (creditErr) {
          const msg = `Failed to credit wallet ${wallet.id} for tx ${deposit.txHash}: ${creditErr instanceof Error ? creditErr.message : String(creditErr)}`;
          console.error(`[chain-deposits] ${msg}`);
          summary.errors.push(msg);
        }
      }
    } catch (err) {
      const msg = `Error checking deposits for Solana address ${wallet.deposit_address_solana}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[chain-deposits] ${msg}`);
      summary.errors.push(msg);
    }
  }
}

async function processEvmDeposits(
  supabase: TypedSupabaseClient,
  chain: "base" | "polygon",
  summary: DepositSummary
) {
  // Get all wallets with an EVM deposit address
  const { data: wallets, error: walletsError } = await supabase
    .from("wallets")
    .select("id, deposit_address_evm")
    .not("deposit_address_evm", "is", null)
    .eq("is_active", true);

  if (walletsError || !wallets) {
    summary.errors.push(
      `Failed to fetch EVM wallets for ${chain}: ${walletsError?.message ?? "no data"}`
    );
    return;
  }

  for (const wallet of wallets as Array<{
    id: string;
    deposit_address_evm: string;
  }>) {
    try {
      const deposits = await checkEvmDeposits(
        chain,
        wallet.deposit_address_evm
      );
      summary.processed += deposits.length;

      for (const deposit of deposits) {
        // De-duplicate: skip if tx_hash already exists in wallet_transactions
        const alreadyProcessed = await isTxHashProcessed(
          supabase,
          deposit.txHash
        );
        if (alreadyProcessed) continue;

        // Credit the wallet
        try {
          await creditWallet(wallet.id, deposit.amount, "deposit", {
            chain: chain as Chain,
            txHash: deposit.txHash,
            token: deposit.token,
            referenceType: "chain_deposit",
            description: `${chain} deposit from ${deposit.fromAddress}`,
          });
          summary.credited++;
        } catch (creditErr) {
          const msg = `Failed to credit wallet ${wallet.id} for tx ${deposit.txHash}: ${creditErr instanceof Error ? creditErr.message : String(creditErr)}`;
          console.error(`[chain-deposits] ${msg}`);
          summary.errors.push(msg);
        }
      }
    } catch (err) {
      const msg = `Error checking deposits for ${chain} address ${wallet.deposit_address_evm}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[chain-deposits] ${msg}`);
      summary.errors.push(msg);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a transaction hash has already been processed (de-duplication).
 */
async function isTxHashProcessed(
  supabase: TypedSupabaseClient,
  txHash: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("id")
    .eq("tx_hash", txHash)
    .limit(1);

  if (error) {
    // Fail-safe: on DB error, assume already processed to prevent double-credit.
    // The UNIQUE index on tx_hash provides a second layer of dedup protection.
    console.error(
      `[chain-deposits] Error checking tx_hash ${txHash} (fail-safe: treating as processed):`,
      error.message
    );
    return true;
  }

  return data && data.length > 0;
}
