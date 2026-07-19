/**
 * Solana Chain Integration
 * Handles deposit address generation, deposit detection, and withdrawal execution.
 *
 * Uses @solana/kit for Solana blockchain interactions.
 * Designed to work with USDC (SPL token) and native SOL.
 */

import {
  address as toSolanaAddress,
  appendTransactionMessageInstruction,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signature as toSolanaSignature,
  signTransactionMessageWithSigners,
  type Address,
  type KeyPairSigner,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { createHash } from "crypto";
import bs58 from "bs58";
import type { Chain, Token } from "../wallet";
import { createTaggedLogger } from "@/lib/logging";
import { isRuntimeFlagEnabled } from "@/lib/runtime-flags";

const log = createTaggedLogger("payments/solana");
const LAMPORTS_PER_SOL = BigInt(1_000_000_000);
const MIN_SOL_DEPOSIT_LAMPORTS = BigInt(1_000_000);

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
    wsUrl: process.env.SOLANA_WS_URL || "",
    masterKey: process.env.SOLANA_MASTER_PRIVATE_KEY || "",
    usdcMint:
      process.env.SOLANA_USDC_MINT ||
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // mainnet USDC
  };
}

export function isSolanaEnabled(): boolean {
  return isRuntimeFlagEnabled("ENABLE_SOLANA_CHAIN", false);
}

export function isSolanaConfigured(): boolean {
  const env = getSolanaEnv();
  return isSolanaEnabled() && !!env.rpcUrl && !!env.masterKey;
}

/** Solana withdrawals remain disabled until USDC transfers are implemented and tested. */
export function isSolanaWithdrawalConfigured(): boolean {
  return false;
}

function getRpc() {
  const env = getSolanaEnv();
  if (!env.rpcUrl) throw new Error("SOLANA_RPC_URL not configured");
  return createSolanaRpc(env.rpcUrl);
}

function getWebsocketUrl(): string {
  const env = getSolanaEnv();
  if (env.wsUrl) return env.wsUrl;

  try {
    const url = new URL(env.rpcUrl);
    if (url.protocol === "https:") url.protocol = "wss:";
    else if (url.protocol === "http:") url.protocol = "ws:";
    else throw new Error("Unsupported Solana RPC protocol");
    return url.toString();
  } catch {
    throw new Error("SOLANA_WS_URL is required when SOLANA_RPC_URL is not HTTP(S)");
  }
}

function parseMasterSecretKey(): Uint8Array {
  const { masterKey } = getSolanaEnv();
  if (!masterKey) throw new Error("SOLANA_MASTER_PRIVATE_KEY not configured");

  try {
    let secretKey: Uint8Array;
    if (masterKey.startsWith("[")) {
      const parsed: unknown = JSON.parse(masterKey);
      if (
        !Array.isArray(parsed) ||
        parsed.length !== 64 ||
        parsed.some(
          (value) =>
            !Number.isInteger(value) || Number(value) < 0 || Number(value) > 255
        )
      ) {
        throw new Error("Invalid JSON secret key");
      }
      secretKey = Uint8Array.from(parsed as number[]);
    } else {
      secretKey = bs58.decode(masterKey);
    }

    if (secretKey.length !== 64) throw new Error("Invalid secret key length");
    return secretKey;
  } catch {
    throw new Error("Invalid SOLANA_MASTER_PRIVATE_KEY format (expected base58 or JSON array)");
  }
}

async function getMasterSigner(): Promise<KeyPairSigner> {
  try {
    return await createKeyPairSignerFromBytes(parseMasterSecretKey());
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Invalid SOLANA_MASTER_PRIVATE_KEY")
    ) {
      throw error;
    }
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
async function deriveChildSigner(
  derivationIndex: number
): Promise<KeyPairSigner> {
  if (!Number.isSafeInteger(derivationIndex) || derivationIndex < 0) {
    throw new Error("Solana derivation index must be a non-negative safe integer");
  }

  const seed = createHash("sha512")
    .update(Buffer.from(parseMasterSecretKey()))
    .update(`solana-deposit-${derivationIndex}`)
    .digest()
    .subarray(0, 32);
  return createKeyPairSignerFromPrivateKeyBytes(seed);
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
    throw new Error("Solana chain not configured");
  }
  const child = await deriveChildSigner(derivationIndex);
  return child.address;
}

/**
 * Check for incoming deposits to a specific address.
 * Looks for both SOL transfers and USDC SPL token transfers.
 */
export async function checkSolanaDeposits(
  walletAddress: string,
  sinceTimestamp?: number
): Promise<PendingDeposit[]> {
  if (!isSolanaConfigured()) return [];

  const rpc = getRpc();
  const ownerAddress = toSolanaAddress(walletAddress);
  const { usdcMint: configuredUsdcMint } = getSolanaEnv();
  const deposits: PendingDeposit[] = [];
  const usdcTokenAccounts: Address[] = [];
  let usdcMint: Address | null = null;

  try {
    usdcMint = toSolanaAddress(configuredUsdcMint);
    const { value: tokenAccounts } = await rpc
      .getTokenAccountsByOwner(
        ownerAddress,
        { mint: usdcMint },
        {
          commitment: "confirmed",
          dataSlice: { offset: 0, length: 0 },
          encoding: "base64",
        }
      )
      .send();
    usdcTokenAccounts.push(...tokenAccounts.map((account) => account.pubkey));
  } catch (err) {
    void log.warn("Unable to resolve Solana USDC token accounts", {
      address: walletAddress,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const scanAddresses = [ownerAddress, ...usdcTokenAccounts];
    const signaturePages = await Promise.all(
      scanAddresses.map((scanAddress) =>
        rpc
          .getSignaturesForAddress(scanAddress, {
            commitment: "confirmed",
            limit: 20,
          })
          .send()
      )
    );
    const seenSignatures = new Set<string>();
    const tokenAccountSet = new Set<string>(usdcTokenAccounts);

    for (const sigInfo of signaturePages.flat()) {
      if (seenSignatures.has(sigInfo.signature)) continue;
      seenSignatures.add(sigInfo.signature);

      // Skip if before our cutoff timestamp
      if (
        sinceTimestamp &&
        sigInfo.blockTime !== null &&
        Number(sigInfo.blockTime) < sinceTimestamp
      ) {
        continue;
      }

      // Skip failed transactions
      if (sigInfo.err) continue;

      try {
        const tx = await rpc
          .getTransaction(sigInfo.signature, {
            commitment: "confirmed",
            encoding: "jsonParsed",
            maxSupportedTransactionVersion: 0,
          })
          .send();
        if (!tx?.meta || !tx.transaction) continue;

        // Check for native SOL transfers
        const preBalances = tx.meta.preBalances;
        const postBalances = tx.meta.postBalances;
        const accountKeys = tx.transaction.message.accountKeys;

        const addrIndex = accountKeys.findIndex(
          (account) => account.pubkey === ownerAddress
        );

        if (addrIndex >= 0 && postBalances[addrIndex] > preBalances[addrIndex]) {
          const lamportsDiff = postBalances[addrIndex] - preBalances[addrIndex];
          const solAmount = Number(lamportsDiff) / Number(LAMPORTS_PER_SOL);

          if (lamportsDiff > MIN_SOL_DEPOSIT_LAMPORTS) {
            // Minimum deposit threshold
            deposits.push({
              txHash: sigInfo.signature,
              fromAddress: accountKeys[0]?.pubkey ?? "unknown",
              toAddress: walletAddress,
              amount: solAmount,
              token: "SOL",
              confirmations: sigInfo.confirmationStatus === "finalized" ? 32 : 1,
              timestamp:
                sigInfo.blockTime !== null
                  ? Number(sigInfo.blockTime)
                  : Math.floor(Date.now() / 1000),
            });
          }
        }

        if (!usdcMint) continue;

        const preTokenBalances = tx.meta.preTokenBalances ?? [];
        const postTokenBalances = tx.meta.postTokenBalances ?? [];
        const relevantAccountIndexes = new Set<number>();

        for (const balance of [...preTokenBalances, ...postTokenBalances]) {
          const accountKey = accountKeys[balance.accountIndex]?.pubkey;
          if (
            balance.mint === usdcMint &&
            (balance.owner === ownerAddress ||
              (accountKey && tokenAccountSet.has(accountKey)))
          ) {
            relevantAccountIndexes.add(balance.accountIndex);
          }
        }

        let rawUsdcDelta = BigInt(0);
        let usdcDecimals: number | null = null;
        let sourceAddress = "unknown";

        for (const accountIndex of relevantAccountIndexes) {
          const preBalance = preTokenBalances.find(
            (balance) =>
              balance.accountIndex === accountIndex && balance.mint === usdcMint
          );
          const postBalance = postTokenBalances.find(
            (balance) =>
              balance.accountIndex === accountIndex && balance.mint === usdcMint
          );
          const preAmount = BigInt(preBalance?.uiTokenAmount.amount ?? "0");
          const postAmount = BigInt(postBalance?.uiTokenAmount.amount ?? "0");
          const accountDelta = postAmount - preAmount;

          rawUsdcDelta += accountDelta;
          usdcDecimals ??=
            postBalance?.uiTokenAmount.decimals ??
            preBalance?.uiTokenAmount.decimals ??
            null;

          if (accountDelta < BigInt(0)) {
            sourceAddress = accountKeys[accountIndex]?.pubkey ?? sourceAddress;
          }
        }

        if (rawUsdcDelta > BigInt(0) && usdcDecimals !== null) {
          const amount = Number(rawUsdcDelta) / 10 ** usdcDecimals;
          if (Number.isFinite(amount) && amount > 0) {
            deposits.push({
              txHash: sigInfo.signature,
              fromAddress: sourceAddress,
              toAddress: walletAddress,
              amount,
              token: "USDC",
              confirmations: sigInfo.confirmationStatus === "finalized" ? 32 : 1,
              timestamp:
                sigInfo.blockTime !== null
                  ? Number(sigInfo.blockTime)
                  : Math.floor(Date.now() / 1000),
            });
          }
        }
      } catch {
        // Skip individual transaction parsing errors
        continue;
      }
    }
  } catch (err) {
    void log.error("Error checking deposits", { error: err instanceof Error ? err.message : String(err) });
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
  if (!isSolanaConfigured()) {
    throw new Error("Solana chain not configured");
  }

  if (token === "SOL") {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Solana transfer amount must be a positive finite number");
    }
    const lamportsAsNumber = Math.round(amount * Number(LAMPORTS_PER_SOL));
    if (!Number.isSafeInteger(lamportsAsNumber)) {
      throw new Error("Solana transfer amount exceeds the safe transaction limit");
    }

    const rpc = getRpc();
    const masterSigner = await getMasterSigner();
    const destination = toSolanaAddress(toAddress);
    const transferInstruction = getTransferSolInstruction({
      amount: BigInt(lamportsAsNumber),
      destination,
      source: masterSigner,
    });

    try {
      const { value: latestBlockhash } = await rpc
        .getLatestBlockhash({ commitment: "confirmed" })
        .send();
      const transactionMessage = pipe(
        createTransactionMessage({ version: "legacy" }),
        (message) => setTransactionMessageFeePayerSigner(masterSigner, message),
        (message) =>
          setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
        (message) =>
          appendTransactionMessageInstruction(transferInstruction, message)
      );
      const transaction = await signTransactionMessageWithSigners(
        transactionMessage
      );
      assertIsTransactionWithBlockhashLifetime(transaction);
      const txHash = getSignatureFromTransaction(transaction);
      const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
        rpc,
        rpcSubscriptions: createSolanaRpcSubscriptions(getWebsocketUrl()),
      });
      await sendAndConfirmTransaction(transaction, { commitment: "confirmed" });

      return {
        txHash,
        status: "confirmed",
        chain: "solana",
        amount,
        token: "SOL",
      };
    } catch (err) {
      void log.error("Transfer failed", { error: err instanceof Error ? err.message : String(err) });
      return {
        txHash: "",
        status: "failed",
        chain: "solana",
        amount,
        token: "SOL",
      };
    }
  }

  throw new Error("Solana USDC withdrawals are not supported");
}

/**
 * Check if a transaction hash is confirmed on Solana.
 */
export async function confirmSolanaTransaction(
  txHash: string
): Promise<boolean> {
  if (!isSolanaConfigured()) return false;

  try {
    const rpc = getRpc();
    const { value: statuses } = await rpc
      .getSignatureStatuses([toSolanaSignature(txHash)], {
        searchTransactionHistory: true,
      })
      .send();
    const status = statuses[0];
    return (
      status?.err === null &&
      (status.confirmationStatus === "finalized" ||
        status.confirmationStatus === "confirmed")
    );
  } catch {
    return false;
  }
}
