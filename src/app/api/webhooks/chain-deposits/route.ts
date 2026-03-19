import { NextResponse, type NextRequest } from "next/server";
import { trackCronRun } from "@/lib/cron-tracker";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TypedSupabaseClient } from "@/types/database";
// REMOVED: import { creditWallet, type Chain, type Token } from "@/lib/payments/wallet";
import { creditWallet, type Chain } from "@/lib/payments/wallet";
import {
  checkSolanaDeposits,
  isSolanaConfigured,
} from "@/lib/payments/chains/solana";
import {
  checkEvmDeposits,
  isEvmConfigured,
} from "@/lib/payments/chains/evm";
import { createTaggedLogger } from "@/lib/logging";

const log = createTaggedLogger("webhook/chain-deposits");

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
export async function GET(request: NextRequest) {
  return runDepositScan(request, parseTargetChainFromSearchParams(request));
}

export async function POST(request: NextRequest) {
  return runDepositScan(request, await parseTargetChainFromBody(request));
}

async function runDepositScan(
  request: NextRequest,
  targetChain?: DepositChain
) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary: DepositSummary = {
    processed: 0,
    credited: 0,
    errors: [],
  };
  const tracker = await trackCronRun("wallet-chain-deposits", {
    staleAfterMs: 10 * 60 * 1000,
  });

  if (tracker.shouldSkip) {
    return tracker.skip({ targetChain: targetChain ?? "all" });
  }

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
      return tracker.complete({
        message: "No chains configured for deposit checking",
        targetChain: targetChain ?? "all",
        configuredChains: [],
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
        void log.error(msg, { chain });
        summary.errors.push(msg);
      }
    }

    return tracker.complete({
      targetChain: targetChain ?? "all",
      configuredChains,
      ...summary,
    });
  } catch (err) {
    void log.error("Unexpected error in chain-deposits webhook", { error: err instanceof Error ? err.message : String(err) });
    return tracker.fail(err);
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
          void log.error(msg, { walletId: wallet.id, txHash: deposit.txHash });
          summary.errors.push(msg);
        }
      }
    } catch (err) {
      const msg = `Error checking deposits for Solana address ${wallet.deposit_address_solana}: ${err instanceof Error ? err.message : String(err)}`;
      void log.error(msg, { address: wallet.deposit_address_solana });
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
          void log.error(msg, { walletId: wallet.id, txHash: deposit.txHash, chain });
          summary.errors.push(msg);
        }
      }
    } catch (err) {
      const msg = `Error checking deposits for ${chain} address ${wallet.deposit_address_evm}: ${err instanceof Error ? err.message : String(err)}`;
      void log.error(msg, { address: wallet.deposit_address_evm, chain });
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
    void log.error(`Error checking tx_hash ${txHash} (fail-safe: treating as processed)`, { error: error.message, txHash });
    return true;
  }

  return data && data.length > 0;
}

function isDepositChain(value: unknown): value is DepositChain {
  return value === "solana" || value === "base" || value === "polygon";
}

function parseTargetChainFromSearchParams(
  request: NextRequest
): DepositChain | undefined {
  const value = new URL(request.url).searchParams.get("chain");
  return isDepositChain(value) ? value : undefined;
}

async function parseTargetChainFromBody(
  request: NextRequest
): Promise<DepositChain | undefined> {
  try {
    const body = await request.json().catch(() => {
      void log.warn("Invalid JSON body");
      return {};
    });

    return isDepositChain(body.chain) ? body.chain : undefined;
  } catch {
    return undefined;
  }
}
