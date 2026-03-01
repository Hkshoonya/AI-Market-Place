/**
 * Solana Chain Integration
 * Handles deposit address generation, deposit detection, and withdrawal execution.
 *
 * Uses @solana/web3.js for Solana blockchain interactions.
 * Designed to work with USDC (SPL token) and native SOL.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { createHash } from "crypto";
import bs58 from "bs58";
import type { Chain, Token } from "../wallet";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface DepositAddress {
  address: string;
  chain: Chain;
  derivationIndex: number;
}

export interface TransferResult {
  txHash: string;
  status: "confirmed" | "failed";
  chain: Chain;
  amount: number;
  token: Token;
}

export interface PendingDeposit {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  token: Token;
  confirmations: number;
  timestamp: number;
}

// ────────────────────────────────────────────────────────────────
// Environment
// ────────────────────────────────────────────────────────────────

function getSolanaEnv() {
  return {
    rpcUrl: process.env.SOLANA_RPC_URL || "",
    masterKey: process.env.SOLANA_MASTER_PRIVATE_KEY || "",
    usdcMint:
      process.env.SOLANA_USDC_MINT ||
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // mainnet USDC
  };
}

export function isSolanaConfigured(): boolean {
  return !!process.env.SOLANA_RPC_URL;
}

function getConnection(): Connection {
  const env = getSolanaEnv();
  if (!env.rpcUrl) throw new Error("SOLANA_RPC_URL not configured");
  return new Connection(env.rpcUrl, "confirmed");
}

function getMasterKeypair(): Keypair {
  const env = getSolanaEnv();
  if (!env.masterKey) throw new Error("SOLANA_MASTER_PRIVATE_KEY not configured");
  try {
    // Support both base58 and JSON array formats
    if (env.masterKey.startsWith("[")) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(env.masterKey)));
    }
    return Keypair.fromSecretKey(bs58.decode(env.masterKey));
  } catch {
    throw new Error("Invalid SOLANA_MASTER_PRIVATE_KEY format (expected base58 or JSON array)");
  }
}

// ────────────────────────────────────────────────────────────────
// HD Derivation (deterministic child keypairs from master seed)
// ────────────────────────────────────────────────────────────────

/**
 * Derive a child keypair from the master key using index-based seed derivation.
 * This is a simplified approach: SHA-512(masterSecretKey + "solana-deposit" + index)
 * truncated to 32 bytes for the child seed.
 */
function deriveChildKeypair(derivationIndex: number): Keypair {
  const master = getMasterKeypair();
  const seed = createHash("sha512")
    .update(Buffer.from(master.secretKey))
    .update(`solana-deposit-${derivationIndex}`)
    .digest()
    .subarray(0, 32);
  return Keypair.fromSeed(seed);
}

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

/**
 * Generate a unique deposit address for a wallet using HD derivation.
 * Each wallet gets a deterministic address derived from the master key + index.
 */
export async function generateSolanaDepositAddress(
  derivationIndex: number
): Promise<string> {
  if (!isSolanaConfigured()) {
    throw new Error("SOLANA_RPC_URL not configured");
  }
  const child = deriveChildKeypair(derivationIndex);
  return child.publicKey.toBase58();
}

/**
 * Check for incoming deposits to a specific address.
 * Looks for both SOL transfers and USDC SPL token transfers.
 */
export async function checkSolanaDeposits(
  address: string,
  sinceTimestamp?: number
): Promise<PendingDeposit[]> {
  if (!isSolanaConfigured()) return [];

  const connection = getConnection();
  const pubkey = new PublicKey(address);
  const deposits: PendingDeposit[] = [];

  try {
    // Get recent confirmed signatures for this address
    const signatures = await connection.getSignaturesForAddress(pubkey, {
      limit: 20,
    });

    for (const sigInfo of signatures) {
      // Skip if before our cutoff timestamp
      if (sinceTimestamp && sigInfo.blockTime && sigInfo.blockTime < sinceTimestamp) {
        continue;
      }

      // Skip failed transactions
      if (sigInfo.err) continue;

      try {
        const tx = await connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });
        if (!tx?.meta || !tx.transaction) continue;

        // Check for native SOL transfers
        const preBalances = tx.meta.preBalances;
        const postBalances = tx.meta.postBalances;
        const accountKeys = tx.transaction.message.accountKeys;

        const addrIndex = accountKeys.findIndex(
          (k) => k.pubkey.toBase58() === address
        );

        if (addrIndex >= 0 && postBalances[addrIndex] > preBalances[addrIndex]) {
          const lamportsDiff = postBalances[addrIndex] - preBalances[addrIndex];
          const solAmount = lamportsDiff / LAMPORTS_PER_SOL;

          if (solAmount > 0.001) {
            // Minimum deposit threshold
            deposits.push({
              txHash: sigInfo.signature,
              fromAddress: accountKeys[0]?.pubkey.toBase58() ?? "unknown",
              toAddress: address,
              amount: solAmount,
              token: "SOL",
              confirmations: sigInfo.confirmationStatus === "finalized" ? 32 : 1,
              timestamp: sigInfo.blockTime ?? Math.floor(Date.now() / 1000),
            });
          }
        }

        // Check for USDC SPL token transfers (parsed instructions)
        const innerInstructions = tx.meta.innerInstructions ?? [];
        const allInstructions = [
          ...tx.transaction.message.instructions,
          ...innerInstructions.flatMap((ii) => ii.instructions),
        ];

        for (const ix of allInstructions) {
          if ("parsed" in ix && ix.parsed?.type === "transferChecked") {
            const info = ix.parsed.info;
            if (
              info.mint === getSolanaEnv().usdcMint &&
              info.destination === address
            ) {
              const amount = parseFloat(info.tokenAmount?.uiAmount ?? "0");
              if (amount > 0) {
                deposits.push({
                  txHash: sigInfo.signature,
                  fromAddress: info.source ?? "unknown",
                  toAddress: address,
                  amount,
                  token: "USDC",
                  confirmations: sigInfo.confirmationStatus === "finalized" ? 32 : 1,
                  timestamp: sigInfo.blockTime ?? Math.floor(Date.now() / 1000),
                });
              }
            }
          }
        }
      } catch {
        // Skip individual transaction parsing errors
        continue;
      }
    }
  } catch (err) {
    console.error("[solana] Error checking deposits:", err);
  }

  return deposits;
}

/**
 * Execute a native SOL withdrawal from the platform master wallet.
 * For USDC SPL token transfers, a more complex instruction set is needed.
 */
export async function sendSolanaTransfer(
  toAddress: string,
  amount: number,
  token: Token = "USDC"
): Promise<TransferResult> {
  const connection = getConnection();
  const masterKeypair = getMasterKeypair();

  if (token === "SOL") {
    // Native SOL transfer
    const lamports = Math.round(amount * LAMPORTS_PER_SOL);
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: masterKeypair.publicKey,
        toPubkey: new PublicKey(toAddress),
        lamports,
      })
    );

    try {
      const txHash = await sendAndConfirmTransaction(connection, transaction, [
        masterKeypair,
      ]);
      return {
        txHash,
        status: "confirmed",
        chain: "solana",
        amount,
        token: "SOL",
      };
    } catch (err) {
      console.error("[solana] Transfer failed:", err);
      return {
        txHash: "",
        status: "failed",
        chain: "solana",
        amount,
        token: "SOL",
      };
    }
  }

  // USDC transfer requires SPL token program instructions
  // For now, use a simplified approach via @solana/spl-token if available
  // In production, you'd use createTransferCheckedInstruction from @solana/spl-token
  throw new Error(
    "USDC SPL token transfers require @solana/spl-token. Install with: npm install @solana/spl-token"
  );
}

/**
 * Check if a transaction hash is confirmed on Solana.
 */
export async function confirmSolanaTransaction(
  txHash: string
): Promise<boolean> {
  if (!isSolanaConfigured()) return false;

  try {
    const connection = getConnection();
    const status = await connection.getSignatureStatus(txHash);
    return (
      status.value?.confirmationStatus === "finalized" ||
      status.value?.confirmationStatus === "confirmed"
    );
  } catch {
    return false;
  }
}
