import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bs58 from "bs58";

const solanaMocks = vi.hoisted(() => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  sendAndConfirm: vi.fn(),
  sendAndConfirmFactory: vi.fn(),
}));

vi.mock("@solana/kit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solana/kit")>();
  return {
    ...actual,
    sendAndConfirmTransactionFactory: (...args: unknown[]) => {
      solanaMocks.sendAndConfirmFactory(...args);
      return solanaMocks.sendAndConfirm;
    },
  };
});

vi.mock("@/lib/logging", () => ({
  createTaggedLogger: () => ({
    error: (...args: unknown[]) => solanaMocks.logError(...args),
    info: vi.fn(),
    warn: (...args: unknown[]) => solanaMocks.logWarn(...args),
  }),
}));

import {
  decompileTransactionMessage,
  getCompiledTransactionMessageDecoder,
  getSignatureFromTransaction,
} from "@solana/kit";
import { getTransferSolInstructionDataDecoder } from "@solana-program/system";
import {
  checkSolanaDeposits,
  confirmSolanaTransaction,
  generateSolanaDepositAddress,
  isSolanaConfigured,
  isSolanaEnabled,
  isSolanaWithdrawalConfigured,
  sendSolanaTransfer,
} from "./solana";

const ENV_KEYS = [
  "ENABLE_SOLANA_CHAIN",
  "SOLANA_MASTER_PRIVATE_KEY",
  "SOLANA_RPC_URL",
  "SOLANA_USDC_MINT",
  "SOLANA_WS_URL",
] as const;
const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

const MASTER_SECRET = Uint8Array.from([
  ...Array(32).fill(7),
  234, 74, 108, 99, 226, 156, 82, 10, 190, 245, 80, 123, 19, 46, 197,
  249, 149, 71, 118, 174, 190, 190, 123, 146, 66, 30, 234, 105, 20, 70,
  210, 44,
]);
const MASTER_ADDRESS = "GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB";
const OWNER_ADDRESS = MASTER_ADDRESS;
const TOKEN_ACCOUNT = "Es8EkKZskn4s43R28XvFivX58Vwt4smzsC7QvUVMLL7G";
const SENDER_ADDRESS = "EEBc3epno1QCWGNtK26cFcgw8SeUdfaJRNMx9A3LXtju";
const SOURCE_TOKEN_ACCOUNT = "EPwkqURquzR3pwE23qJCCSZ5SUXFTctjNsNd6eDTk8aF";
const DESTINATION_ADDRESS = "F7tKp3XjhCAZHMA3w1M61qGaWRoRhYcUujBSgPpi13m3";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const BLOCKHASH = "11111111111111111111111111111111";
const SOL_SIGNATURE = bs58.encode(Uint8Array.from({ length: 64 }, () => 1));
const USDC_SIGNATURE = bs58.encode(Uint8Array.from({ length: 64 }, () => 2));

interface RpcRequest {
  id: string;
  jsonrpc: "2.0";
  method: string;
  params: unknown[];
}

function configureSolana() {
  process.env.ENABLE_SOLANA_CHAIN = "true";
  process.env.SOLANA_MASTER_PRIVATE_KEY = JSON.stringify(
    Array.from(MASTER_SECRET)
  );
  process.env.SOLANA_RPC_URL = "https://rpc.example.test";
  process.env.SOLANA_USDC_MINT = USDC_MINT;
}

function installRpcMock(
  handler: (request: RpcRequest) => unknown | Promise<unknown>
) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as RpcRequest;
    const result = await handler(request);
    return new Response(
      JSON.stringify({ id: request.id, jsonrpc: "2.0", result }),
      { headers: { "content-type": "application/json" } }
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function signatureInfo(
  signature: string,
  blockTime: number,
  confirmationStatus: "confirmed" | "finalized" = "finalized"
) {
  return {
    blockTime,
    confirmationStatus,
    err: null,
    memo: null,
    signature,
    slot: 100,
  };
}

function tokenBalance(
  accountIndex: number,
  amount: string,
  owner: string
) {
  const numericAmount = Number(amount) / 1_000_000;
  return {
    accountIndex,
    mint: USDC_MINT,
    owner,
    programId: TOKEN_PROGRAM,
    uiTokenAmount: {
      amount,
      decimals: 6,
      uiAmount: numericAmount,
      uiAmountString: String(numericAmount),
    },
  };
}

function parsedTransaction({
  accountKeys,
  postBalances,
  postTokenBalances = [],
  preBalances,
  preTokenBalances = [],
  signature,
}: {
  accountKeys: string[];
  postBalances: number[];
  postTokenBalances?: ReturnType<typeof tokenBalance>[];
  preBalances: number[];
  preTokenBalances?: ReturnType<typeof tokenBalance>[];
  signature: string;
}) {
  return {
    blockTime: 1_700_000_000,
    meta: {
      err: null,
      fee: 5_000,
      innerInstructions: [],
      logMessages: [],
      postBalances,
      postTokenBalances,
      preBalances,
      preTokenBalances,
      rewards: null,
      status: { Ok: null },
    },
    slot: 100,
    transaction: {
      message: {
        accountKeys: accountKeys.map((pubkey, index) => ({
          pubkey,
          signer: index === 0,
          source: "transaction",
          writable: true,
        })),
        instructions: [],
        recentBlockhash: BLOCKHASH,
      },
      signatures: [signature],
    },
    version: "legacy",
  };
}

describe("solana chain availability", () => {
  it("defaults Solana off when the launch flag is unset", () => {
    delete process.env.ENABLE_SOLANA_CHAIN;
    process.env.SOLANA_RPC_URL = "https://rpc.example.test";
    process.env.SOLANA_MASTER_PRIVATE_KEY = JSON.stringify(
      Array.from(MASTER_SECRET)
    );

    expect(isSolanaEnabled()).toBe(false);
    expect(isSolanaConfigured()).toBe(false);
  });

  it("requires the launch flag, RPC URL, and master key", () => {
    process.env.ENABLE_SOLANA_CHAIN = "true";
    process.env.SOLANA_RPC_URL = "https://rpc.example.test";
    delete process.env.SOLANA_MASTER_PRIVATE_KEY;

    expect(isSolanaConfigured()).toBe(false);

    process.env.SOLANA_MASTER_PRIVATE_KEY = JSON.stringify(
      Array.from(MASTER_SECRET)
    );
    expect(isSolanaConfigured()).toBe(true);
  });

  it("does not advertise unsupported Solana USDC withdrawals", () => {
    configureSolana();

    expect(isSolanaConfigured()).toBe(true);
    expect(isSolanaWithdrawalConfigured()).toBe(false);
  });
});

describe("Solana address derivation", () => {
  beforeEach(configureSolana);

  it("preserves addresses generated by the legacy SDK", async () => {
    await expect(generateSolanaDepositAddress(0)).resolves.toBe(
      "Es8EkKZskn4s43R28XvFivX58Vwt4smzsC7QvUVMLL7G"
    );
    await expect(generateSolanaDepositAddress(42)).resolves.toBe(
      "EPwkqURquzR3pwE23qJCCSZ5SUXFTctjNsNd6eDTk8aF"
    );

    process.env.SOLANA_MASTER_PRIVATE_KEY = bs58.encode(MASTER_SECRET);
    await expect(generateSolanaDepositAddress(42)).resolves.toBe(
      "EPwkqURquzR3pwE23qJCCSZ5SUXFTctjNsNd6eDTk8aF"
    );
  });

  it("rejects invalid keys and derivation indexes", async () => {
    process.env.SOLANA_MASTER_PRIVATE_KEY = "[1,2,3]";
    await expect(generateSolanaDepositAddress(0)).rejects.toThrow(
      /invalid SOLANA_MASTER_PRIVATE_KEY/i
    );

    process.env.SOLANA_MASTER_PRIVATE_KEY = JSON.stringify(
      Array.from(MASTER_SECRET)
    );
    await expect(generateSolanaDepositAddress(-1)).rejects.toThrow(
      /derivation index/i
    );
  });
});

describe("Solana deposit detection", () => {
  beforeEach(configureSolana);

  it("finds native SOL and USDC received by the owner's token account", async () => {
    const fetchMock = installRpcMock((request) => {
      if (request.method === "getTokenAccountsByOwner") {
        return {
          context: { apiVersion: "3.0.0", slot: 100 },
          value: [
            {
              account: {
                data: ["", "base64"],
                executable: false,
                lamports: 2_039_280,
                owner: TOKEN_PROGRAM,
                rentEpoch: 1,
                space: 165,
              },
              pubkey: TOKEN_ACCOUNT,
            },
          ],
        };
      }

      if (request.method === "getSignaturesForAddress") {
        return request.params[0] === OWNER_ADDRESS
          ? [signatureInfo(SOL_SIGNATURE, 1_700_000_001)]
          : [signatureInfo(USDC_SIGNATURE, 1_700_000_002, "confirmed")];
      }

      if (request.method === "getTransaction") {
        if (request.params[0] === SOL_SIGNATURE) {
          return parsedTransaction({
            accountKeys: [SENDER_ADDRESS, OWNER_ADDRESS],
            postBalances: [3_499_995_000, 2_500_000_000],
            preBalances: [5_000_000_000, 1_000_000_000],
            signature: SOL_SIGNATURE,
          });
        }

        return parsedTransaction({
          accountKeys: [SOURCE_TOKEN_ACCOUNT, TOKEN_ACCOUNT],
          postBalances: [2_039_280, 2_039_280],
          postTokenBalances: [
            tokenBalance(0, "2500000", SENDER_ADDRESS),
            tokenBalance(1, "3500000", OWNER_ADDRESS),
          ],
          preBalances: [2_039_280, 2_039_280],
          preTokenBalances: [
            tokenBalance(0, "5000000", SENDER_ADDRESS),
            tokenBalance(1, "1000000", OWNER_ADDRESS),
          ],
          signature: USDC_SIGNATURE,
        });
      }

      throw new Error(`Unexpected RPC method: ${request.method}`);
    });

    await expect(checkSolanaDeposits(OWNER_ADDRESS)).resolves.toEqual([
      {
        amount: 1.5,
        confirmations: 32,
        fromAddress: SENDER_ADDRESS,
        timestamp: 1_700_000_001,
        toAddress: OWNER_ADDRESS,
        token: "SOL",
        txHash: SOL_SIGNATURE,
      },
      {
        amount: 2.5,
        confirmations: 1,
        fromAddress: "unknown",
        timestamp: 1_700_000_002,
        toAddress: OWNER_ADDRESS,
        token: "USDC",
        txHash: USDC_SIGNATURE,
      },
    ]);

    const requests = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(String(init?.body)) as RpcRequest
    );
    expect(
      requests
        .filter((request) => request.method === "getSignaturesForAddress")
        .map((request) => request.params[0])
    ).toEqual([OWNER_ADDRESS, TOKEN_ACCOUNT]);
  });

  it("skips old and failed signatures without fetching their transactions", async () => {
    const failedSignature = bs58.encode(
      Uint8Array.from({ length: 64 }, () => 3)
    );
    const fetchMock = installRpcMock((request) => {
      if (request.method === "getTokenAccountsByOwner") {
        return { context: { slot: 100 }, value: [] };
      }
      if (request.method === "getSignaturesForAddress") {
        return [
          signatureInfo(SOL_SIGNATURE, 100),
          { ...signatureInfo(failedSignature, 300), err: { InstructionError: [0, "Custom"] } },
        ];
      }
      throw new Error(`Unexpected RPC method: ${request.method}`);
    });

    await expect(checkSolanaDeposits(OWNER_ADDRESS, 200)).resolves.toEqual([]);
    const methods = fetchMock.mock.calls.map(
      ([, init]) => (JSON.parse(String(init?.body)) as RpcRequest).method
    );
    expect(methods).not.toContain("getTransaction");
  });
});

describe("Solana transfer and confirmation", () => {
  beforeEach(() => {
    configureSolana();
    solanaMocks.sendAndConfirm.mockResolvedValue(undefined);
  });

  it("signs and confirms a legacy native SOL transfer with the master key", async () => {
    installRpcMock((request) => {
      if (request.method === "getLatestBlockhash") {
        return {
          context: { slot: 100 },
          value: { blockhash: BLOCKHASH, lastValidBlockHeight: 500 },
        };
      }
      throw new Error(`Unexpected RPC method: ${request.method}`);
    });

    const result = await sendSolanaTransfer(
      DESTINATION_ADDRESS,
      0.25,
      "SOL"
    );

    expect(result).toEqual({
      amount: 0.25,
      chain: "solana",
      status: "confirmed",
      token: "SOL",
      txHash: expect.any(String),
    });
    expect(solanaMocks.sendAndConfirm).toHaveBeenCalledOnce();

    const transaction = solanaMocks.sendAndConfirm.mock.calls[0]?.[0];
    expect(transaction).toBeDefined();
    expect(getSignatureFromTransaction(transaction)).toBe(result.txHash);

    const compiledMessage = getCompiledTransactionMessageDecoder().decode(
      transaction.messageBytes
    );
    const message = decompileTransactionMessage(compiledMessage);
    expect(message.feePayer.address).toBe(MASTER_ADDRESS);
    expect(message.version).toBe("legacy");
    expect(message.instructions).toHaveLength(1);

    const instruction = message.instructions[0];
    expect(instruction?.accounts?.[1]?.address).toBe(DESTINATION_ADDRESS);
    expect(
      getTransferSolInstructionDataDecoder().decode(instruction?.data ?? new Uint8Array())
    ).toEqual({ discriminator: 2, amount: BigInt(250_000_000) });
  });

  it("returns a failed result when the network rejects a native transfer", async () => {
    installRpcMock((request) => {
      if (request.method === "getLatestBlockhash") {
        return {
          context: { slot: 100 },
          value: { blockhash: BLOCKHASH, lastValidBlockHeight: 500 },
        };
      }
      throw new Error(`Unexpected RPC method: ${request.method}`);
    });
    solanaMocks.sendAndConfirm.mockRejectedValueOnce(new Error("preflight failed"));

    await expect(
      sendSolanaTransfer(DESTINATION_ADDRESS, 0.25, "SOL")
    ).resolves.toEqual({
      amount: 0.25,
      chain: "solana",
      status: "failed",
      token: "SOL",
      txHash: "",
    });
    expect(solanaMocks.logError).toHaveBeenCalledWith(
      "Transfer failed",
      expect.objectContaining({ error: "preflight failed" })
    );
  });

  it("rejects unsafe amounts and unsupported USDC transfers before sending", async () => {
    await expect(
      sendSolanaTransfer(DESTINATION_ADDRESS, Number.NaN, "SOL")
    ).rejects.toThrow(/positive finite number/i);
    await expect(
      sendSolanaTransfer(DESTINATION_ADDRESS, 10, "USDC")
    ).rejects.toThrow(/USDC withdrawals are not supported/i);
    expect(solanaMocks.sendAndConfirm).not.toHaveBeenCalled();
  });

  it("requires a successful confirmed signature status", async () => {
    let transactionError: unknown = null;
    installRpcMock((request) => {
      if (request.method !== "getSignatureStatuses") {
        throw new Error(`Unexpected RPC method: ${request.method}`);
      }
      return {
        context: { slot: 100 },
        value: [
          {
            confirmationStatus: "confirmed",
            confirmations: 1,
            err: transactionError,
            slot: 99,
            status: transactionError
              ? { Err: transactionError }
              : { Ok: null },
          },
        ],
      };
    });

    await expect(confirmSolanaTransaction(SOL_SIGNATURE)).resolves.toBe(true);
    transactionError = { InstructionError: [0, "Custom"] };
    await expect(confirmSolanaTransaction(SOL_SIGNATURE)).resolves.toBe(false);
    await expect(confirmSolanaTransaction("not-a-signature")).resolves.toBe(
      false
    );
  });
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = ORIGINAL_ENV[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
