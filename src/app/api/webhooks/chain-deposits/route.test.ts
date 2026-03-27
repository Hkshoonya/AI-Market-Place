import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateAdminClient = vi.fn();
const mockCreditWallet = vi.fn();
const mockCheckSolanaDeposits = vi.fn();
const mockIsSolanaConfigured = vi.fn();
const mockCheckEvmDeposits = vi.fn();
const mockIsEvmConfigured = vi.fn();
const mockTrackerComplete = vi.fn();
const mockTrackerFail = vi.fn();
const mockTrackerSkip = vi.fn();
const mockTrackCronRun = vi.fn().mockResolvedValue({
  complete: (...args: unknown[]) => mockTrackerComplete(...args),
  fail: (...args: unknown[]) => mockTrackerFail(...args),
  skip: (...args: unknown[]) => mockTrackerSkip(...args),
  runId: "cron-run-1",
  shouldSkip: false,
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/payments/wallet", () => ({
  creditWallet: (...args: unknown[]) => mockCreditWallet(...args),
}));

vi.mock("@/lib/payments/chains/solana", () => ({
  checkSolanaDeposits: (...args: unknown[]) => mockCheckSolanaDeposits(...args),
  isSolanaConfigured: (...args: unknown[]) => mockIsSolanaConfigured(...args),
}));

vi.mock("@/lib/payments/chains/evm", () => ({
  checkEvmDeposits: (...args: unknown[]) => mockCheckEvmDeposits(...args),
  isEvmConfigured: (...args: unknown[]) => mockIsEvmConfigured(...args),
}));

vi.mock("@/lib/cron-tracker", () => ({
  trackCronRun: (...args: unknown[]) => mockTrackCronRun(...args),
}));

function makeWalletsQuery<T extends Record<string, unknown>>(rows: T[]) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return builder;
}

function makeWalletPreflightQuery<T extends Record<string, unknown>>(rows: T[]) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return builder;
}

function makeTransactionsQuery(processedTxHashes: Set<string>) {
  let currentTxHash = "";
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockImplementation((column: string, value: string) => {
      if (column === "tx_hash") {
        currentTxHash = value;
      }
      return builder;
    }),
    limit: vi.fn().mockImplementation(async () => ({
      data: processedTxHashes.has(currentTxHash) ? [{ id: "existing-tx" }] : [],
      error: null,
    })),
  };

  return builder;
}

function createAdminClient({
  walletRows = [],
  processedTxHashes = [],
}: {
  walletRows?: Array<Record<string, unknown>>;
  processedTxHashes?: string[];
}) {
  let walletQueryCount = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === "wallets") {
        walletQueryCount += 1;
        return walletQueryCount === 1
          ? makeWalletPreflightQuery(walletRows)
          : makeWalletsQuery(walletRows);
      }

      if (table === "wallet_transactions") {
        return makeTransactionsQuery(new Set(processedTxHashes));
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function makeGetRequest(path = "https://aimarketcap.tech/api/webhooks/chain-deposits") {
  return new NextRequest(path, {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

describe("chain deposit cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";

    mockCreateAdminClient.mockReturnValue(createAdminClient({}));
    mockIsSolanaConfigured.mockReturnValue(false);
    mockIsEvmConfigured.mockReturnValue(false);
    mockTrackerComplete.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, ...data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    mockTrackerFail.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "boom" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
    mockTrackerSkip.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 when the cron secret is missing or wrong", async () => {
    const { GET } = await import("./route");

    expect(
      (
        await GET(
          new NextRequest("https://aimarketcap.tech/api/webhooks/chain-deposits")
        )
      ).status
    ).toBe(401);

    expect(
      (
        await GET(
          new NextRequest("https://aimarketcap.tech/api/webhooks/chain-deposits", {
            headers: { authorization: "Bearer wrong-secret" },
          })
        )
      ).status
    ).toBe(401);
  });

  it("returns 202 when another chain-deposit scan already holds the lock", async () => {
    mockTrackCronRun.mockResolvedValueOnce({
      complete: (...args: unknown[]) => mockTrackerComplete(...args),
      fail: (...args: unknown[]) => mockTrackerFail(...args),
      skip: (...args: unknown[]) => mockTrackerSkip(...args),
      runId: null,
      shouldSkip: true,
    });

    const { GET } = await import("./route");
    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.skipped).toBe(true);
    expect(mockCheckEvmDeposits).not.toHaveBeenCalled();
    expect(mockCheckSolanaDeposits).not.toHaveBeenCalled();
  });

  it("records a no-op success when no chains are configured", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      makeGetRequest("https://aimarketcap.tech/api/webhooks/chain-deposits?chain=base")
    );

    expect(response.status).toBe(200);
    expect(mockTrackerComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "No chains configured for deposit checking",
        targetChain: "base",
        configuredChains: [],
        processed: 0,
        credited: 0,
      })
    );
  });

  it("records a no-op success when no eligible wallet deposit addresses exist", async () => {
    mockCreateAdminClient.mockReturnValue(createAdminClient({ walletRows: [] }));
    mockIsEvmConfigured.mockImplementation((chain?: string) => chain === "base");

    const { GET } = await import("./route");
    const response = await GET(
      makeGetRequest("https://aimarketcap.tech/api/webhooks/chain-deposits?chain=base")
    );

    expect(response.status).toBe(200);
    expect(mockCheckEvmDeposits).not.toHaveBeenCalled();
    expect(mockTrackerComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "No funded wallet addresses are provisioned for deposit checking",
        targetChain: "base",
        configuredChains: ["base"],
        processed: 0,
        credited: 0,
      })
    );
  });

  it("processes a GET-based base deposit scan and credits new deposits", async () => {
    mockCreateAdminClient.mockReturnValue(
      createAdminClient({
        walletRows: [{ id: "wallet-1", deposit_address_evm: "0xabc" }],
      })
    );
    mockIsEvmConfigured.mockImplementation((chain?: string) => chain === "base");
    mockCheckEvmDeposits.mockResolvedValue([
      {
        txHash: "0xtx1",
        fromAddress: "0xfrom",
        toAddress: "0xabc",
        amount: 25,
        token: "USDC",
        chain: "base",
        blockNumber: 123,
        confirmations: 5,
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET(
      makeGetRequest("https://aimarketcap.tech/api/webhooks/chain-deposits?chain=base")
    );

    expect(response.status).toBe(200);
    expect(mockCheckEvmDeposits).toHaveBeenCalledWith("base", "0xabc");
    expect(mockCreditWallet).toHaveBeenCalledWith(
      "wallet-1",
      25,
      "deposit",
      expect.objectContaining({
        chain: "base",
        txHash: "0xtx1",
        referenceType: "chain_deposit",
      })
    );
    expect(mockTrackerComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        targetChain: "base",
        configuredChains: ["base"],
        processed: 1,
        credited: 1,
        errors: [],
      })
    );
  });
});
