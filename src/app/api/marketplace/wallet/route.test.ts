import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateClient = vi.fn();
const mockGetOrCreateWallet = vi.fn();
const mockEnsureWalletDepositAddresses = vi.fn();
const mockGetWalletBalance = vi.fn();
const mockGetTransactionHistory = vi.fn();
const mockGetTransactionHistoryCount = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock("@/lib/payments/wallet", () => ({
  getOrCreateWallet: (...args: unknown[]) => mockGetOrCreateWallet(...args),
  ensureWalletDepositAddresses: (...args: unknown[]) =>
    mockEnsureWalletDepositAddresses(...args),
  getWalletBalance: (...args: unknown[]) => mockGetWalletBalance(...args),
  getTransactionHistory: (...args: unknown[]) => mockGetTransactionHistory(...args),
  getTransactionHistoryCount: (...args: unknown[]) =>
    mockGetTransactionHistoryCount(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true })),
  RATE_LIMITS: { public: {}, write: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  ),
}));

import { GET, POST } from "./route";

describe("GET /api/marketplace/wallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
    });

    mockGetOrCreateWallet.mockResolvedValue({
      id: "wallet-1",
      primary_chain: "solana",
      deposit_address_solana: "So11111111111111111111111111111111111111112",
      deposit_address_evm: "0x1111111111111111111111111111111111111111",
    });
    mockEnsureWalletDepositAddresses.mockImplementation(async (wallet) => wallet);
    mockGetWalletBalance.mockResolvedValue({
      available: 125,
      held: 20,
      totalEarned: 400,
      totalSpent: 275,
    });
    mockGetTransactionHistory.mockResolvedValue([
      {
        id: "tx-1",
        type: "deposit",
        amount: 50,
      },
    ]);
    mockGetTransactionHistoryCount.mockResolvedValue(17);
  });

  it("forwards pagination and type filters to wallet history helpers", async () => {
    const response = await GET(
      new NextRequest(
        "https://aimarketcap.tech/api/marketplace/wallet?type=deposit&page=2&limit=5"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetTransactionHistory).toHaveBeenCalledWith("wallet-1", {
      limit: 5,
      offset: 5,
      type: "deposit",
    });
    expect(mockGetTransactionHistoryCount).toHaveBeenCalledWith("wallet-1", {
      type: "deposit",
    });
    expect(body.total_transactions).toBe(17);
    expect(body.page).toBe(2);
    expect(body.limit).toBe(5);
    expect(body.type).toBe("deposit");
  });

  it("falls back to safe defaults when query params are invalid", async () => {
    const response = await GET(
      new NextRequest(
        "https://aimarketcap.tech/api/marketplace/wallet?type=bogus&page=-4&limit=9999"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetTransactionHistory).toHaveBeenCalledWith("wallet-1", {
      limit: 100,
      offset: 0,
      type: undefined,
    });
    expect(mockGetTransactionHistoryCount).toHaveBeenCalledWith("wallet-1", {
      type: undefined,
    });
    expect(body.type).toBe("all");
  });
});

describe("POST /api/marketplace/wallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
    });

    mockGetOrCreateWallet.mockResolvedValue({
      id: "wallet-1",
      primary_chain: "solana",
      deposit_address_solana: null,
      deposit_address_evm: null,
    });
    mockGetWalletBalance.mockResolvedValue({
      available: 0,
      held: 0,
      totalEarned: 0,
      totalSpent: 0,
    });
  });

  it("provisions deposit addresses before returning wallet details", async () => {
    mockEnsureWalletDepositAddresses.mockResolvedValue({
      id: "wallet-1",
      primary_chain: "solana",
      deposit_address_solana: "So11111111111111111111111111111111111111112",
      deposit_address_evm: "0x1111111111111111111111111111111111111111",
    });

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/wallet", {
        method: "POST",
        headers: {
          origin: "https://aimarketcap.tech",
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockEnsureWalletDepositAddresses).toHaveBeenCalledWith(
      expect.objectContaining({ id: "wallet-1" })
    );
    expect(body.solana_deposit_address).toBe(
      "So11111111111111111111111111111111111111112"
    );
    expect(body.evm_deposit_address).toBe(
      "0x1111111111111111111111111111111111111111"
    );
  });

  it("returns a configuration error when no chain address can be provisioned", async () => {
    mockEnsureWalletDepositAddresses.mockResolvedValue({
      id: "wallet-1",
      primary_chain: "solana",
      deposit_address_solana: null,
      deposit_address_evm: null,
    });

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/wallet", {
        method: "POST",
        headers: {
          origin: "https://aimarketcap.tech",
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toMatch(/not configured/i);
  });

  it("rejects cross-origin wallet creation requests", async () => {
    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/marketplace/wallet", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
        },
      })
    );

    expect(response.status).toBe(403);
  });
});
