/**
 * EVM Chain Integration (Base, Polygon)
 * Handles deposit address generation, deposit detection, and withdrawal execution.
 *
 * Uses viem for EVM blockchain interactions.
 * Designed to work with USDC (ERC20) and native tokens (ETH on Base, MATIC on Polygon).
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, polygon } from "viem/chains";
import { createHash } from "crypto";
import type { Chain, Token } from "../wallet";
import { createTaggedLogger } from "@/lib/logging";

const log = createTaggedLogger("payments/evm");

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface EvmDepositAddress {
  address: string;
  chain: Chain;
  derivationPath: string;
}

export interface EvmTransferResult {
  txHash: string;
  status: "confirmed" | "failed";
  chain: Chain;
  amount: number;
  token: Token;
  blockNumber: number;
}

export interface EvmPendingDeposit {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  token: Token;
  chain: Chain;
  blockNumber: number;
  confirmations: number;
}

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const USDC_CONTRACTS: Record<string, Address> = {
  base: (process.env.BASE_USDC_CONTRACT ||
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as Address,
  polygon: (process.env.POLYGON_USDC_CONTRACT ||
    "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359") as Address,
};

// ERC20 Transfer event signature
// REMOVED: const TRANSFER_EVENT_SIGNATURE =
//   "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as Hex;

// Minimal ERC20 ABI for transfer
const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ────────────────────────────────────────────────────────────────
// Environment
// ────────────────────────────────────────────────────────────────

function getEvmEnv() {
  return {
    masterKey: process.env.EVM_MASTER_PRIVATE_KEY || "",
    baseRpc: process.env.BASE_RPC_URL || "",
    polygonRpc: process.env.POLYGON_RPC_URL || "",
  };
}

export function isEvmConfigured(chain?: "base" | "polygon"): boolean {
  if (chain === "base") return !!process.env.BASE_RPC_URL;
  if (chain === "polygon") return !!process.env.POLYGON_RPC_URL;
  return !!process.env.BASE_RPC_URL || !!process.env.POLYGON_RPC_URL;
}

/** Get the native token for a chain */
export function getNativeToken(chain: "base" | "polygon"): Token {
  return chain === "base" ? "ETH" : "MATIC";
}

// ────────────────────────────────────────────────────────────────
// Client Factories
// ────────────────────────────────────────────────────────────────

function getViemChain(chain: "base" | "polygon") {
  return chain === "base" ? base : polygon;
}

function getRpcUrl(chain: "base" | "polygon"): string {
  const env = getEvmEnv();
  const rpc = chain === "base" ? env.baseRpc : env.polygonRpc;
  if (!rpc) throw new Error(`${chain.toUpperCase()}_RPC_URL not configured`);
  return rpc;
}

function getPublicClient(chain: "base" | "polygon") {
  return createPublicClient({
    chain: getViemChain(chain),
    transport: http(getRpcUrl(chain)),
  });
}

function getWalletClient(chain: "base" | "polygon") {
  const env = getEvmEnv();
  if (!env.masterKey) throw new Error("EVM_MASTER_PRIVATE_KEY not configured");

  const account = privateKeyToAccount(env.masterKey as Hex);
  return createWalletClient({
    account,
    chain: getViemChain(chain),
    transport: http(getRpcUrl(chain)),
  });
}

// ────────────────────────────────────────────────────────────────
// HD Derivation
// ────────────────────────────────────────────────────────────────

/**
 * Derive a deterministic deposit address from the master key + index.
 * Uses SHA-256 seed derivation to generate a child private key.
 * Same address works on all EVM chains.
 */
export async function generateEvmDepositAddress(
  derivationIndex: number
): Promise<string> {
  const env = getEvmEnv();
  if (!env.masterKey) {
    throw new Error("EVM_MASTER_PRIVATE_KEY not configured");
  }

  // Derive child key: SHA-256(masterKey + "evm-deposit" + index) → 32-byte private key
  const childSeed = createHash("sha256")
    .update(env.masterKey)
    .update(`evm-deposit-${derivationIndex}`)
    .digest();

  const childKey = `0x${childSeed.toString("hex")}` as Hex;
  const account = privateKeyToAccount(childKey);
  return account.address;
}

// ────────────────────────────────────────────────────────────────
// Deposit Detection
// ────────────────────────────────────────────────────────────────

/**
 * Check for incoming USDC and native token deposits on a specific EVM chain.
 */
export async function checkEvmDeposits(
  chain: "base" | "polygon",
  address: string,
  fromBlock?: number
): Promise<EvmPendingDeposit[]> {
  if (!isEvmConfigured(chain)) return [];

  const client = getPublicClient(chain);
  const deposits: EvmPendingDeposit[] = [];
  const targetAddress = address.toLowerCase() as Address;

  try {
    const currentBlock = await client.getBlockNumber();
    const startBlock = fromBlock
      ? BigInt(fromBlock)
      : currentBlock - BigInt(1000); // Look back ~1000 blocks

    // 1. Check USDC ERC20 Transfer events TO our address
    const usdcContract = USDC_CONTRACTS[chain];
    if (usdcContract) {
      try {
        const logs = await client.getLogs({
          address: usdcContract,
          event: {
            type: "event",
            name: "Transfer",
            inputs: [
              { name: "from", type: "address", indexed: true },
              { name: "to", type: "address", indexed: true },
              { name: "value", type: "uint256", indexed: false },
            ],
          },
          args: {
            to: targetAddress,
          },
          fromBlock: startBlock,
          toBlock: currentBlock,
        });

        for (const log of logs) {
          const amount = parseFloat(formatUnits(log.args.value ?? BigInt(0), 6)); // USDC has 6 decimals
          if (amount > 0) {
            deposits.push({
              txHash: log.transactionHash ?? "",
              fromAddress: (log.args.from as string) ?? "unknown",
              toAddress: address,
              amount,
              token: "USDC",
              chain,
              blockNumber: Number(log.blockNumber ?? 0),
              confirmations: Number(currentBlock - (log.blockNumber ?? BigInt(0))),
            });
          }
        }
      } catch (err) {
        void log.error("Error fetching USDC logs", { chain, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 2. Check native token transfers (ETH/MATIC) via recent blocks
    // This is more expensive — only check last ~100 blocks for native transfers
    const nativeStartBlock =
      currentBlock > BigInt(100) ? currentBlock - BigInt(100) : BigInt(0);

    for (
      let blockNum = nativeStartBlock;
      blockNum <= currentBlock;
      blockNum++
    ) {
      try {
        const block = await client.getBlock({
          blockNumber: blockNum,
          includeTransactions: true,
        });

        for (const tx of block.transactions) {
          if (
            typeof tx === "object" &&
            tx.to?.toLowerCase() === targetAddress &&
            tx.value > BigInt(0)
          ) {
            const nativeToken = getNativeToken(chain);
            const amount = parseFloat(formatUnits(tx.value, 18));
            if (amount > 0.001) {
              deposits.push({
                txHash: tx.hash,
                fromAddress: tx.from,
                toAddress: address,
                amount,
                token: nativeToken,
                chain,
                blockNumber: Number(blockNum),
                confirmations: Number(currentBlock - blockNum),
              });
            }
          }
        }
      } catch {
        // Skip blocks that fail to fetch
        continue;
      }
    }
  } catch (err) {
    void log.error("Error checking deposits", { chain, error: err instanceof Error ? err.message : String(err) });
  }

  return deposits;
}

// ────────────────────────────────────────────────────────────────
// Withdrawals
// ────────────────────────────────────────────────────────────────

/**
 * Execute a withdrawal on an EVM chain (Base or Polygon).
 */
export async function sendEvmTransfer(
  chain: "base" | "polygon",
  toAddress: string,
  amount: number,
  token: Token = "USDC"
): Promise<EvmTransferResult> {
  const publicClient = getPublicClient(chain);
  const walletClient = getWalletClient(chain);
  const to = toAddress as Address;

  try {
    if (token === "USDC") {
      // ERC20 USDC transfer
      const usdcContract = USDC_CONTRACTS[chain];
      if (!usdcContract) {
        throw new Error(`USDC contract not configured for ${chain}`);
      }

      const usdcAmount = parseUnits(amount.toString(), 6); // USDC = 6 decimals

      const txHash = await walletClient.writeContract({
        address: usdcContract,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [to, usdcAmount],
      });

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 2,
      });

      return {
        txHash,
        status: receipt.status === "success" ? "confirmed" : "failed",
        chain,
        amount,
        token: "USDC",
        blockNumber: Number(receipt.blockNumber),
      };
    } else {
      // Native token transfer (ETH or MATIC)
      const value = parseUnits(amount.toString(), 18);

      const txHash = await walletClient.sendTransaction({
        to,
        value,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 2,
      });

      return {
        txHash,
        status: receipt.status === "success" ? "confirmed" : "failed",
        chain,
        amount,
        token: getNativeToken(chain),
        blockNumber: Number(receipt.blockNumber),
      };
    }
  } catch (err) {
    void log.error("Transfer failed", { chain, error: err instanceof Error ? err.message : String(err) });
    return {
      txHash: "",
      status: "failed",
      chain,
      amount,
      token,
      blockNumber: 0,
    };
  }
}

/**
 * Confirm a transaction on an EVM chain.
 */
export async function confirmEvmTransaction(
  chain: "base" | "polygon",
  txHash: string,
  requiredConfirmations = 12
): Promise<boolean> {
  if (!isEvmConfigured(chain)) return false;

  try {
    const client = getPublicClient(chain);
    const receipt = await client.getTransactionReceipt({
      hash: txHash as Hex,
    });

    if (!receipt || receipt.status !== "success") return false;

    const currentBlock = await client.getBlockNumber();
    const confirmations = Number(currentBlock - receipt.blockNumber);
    return confirmations >= requiredConfirmations;
  } catch {
    return false;
  }
}
