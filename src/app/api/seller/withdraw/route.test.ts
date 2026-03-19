import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockResolveAuthUser = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockWarn = vi.fn();

vi.mock("@/lib/auth/resolve-user", () => ({
  resolveAuthUser: (...args: unknown[]) => mockResolveAuthUser(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 20, remaining: 19, reset: 60 })),
  RATE_LIMITS: {
    write: { limit: 20, windowMs: 60_000 },
    public: { limit: 60, windowMs: 60_000 },
  },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/payments/wallet", () => ({
  getOrCreateWallet: vi.fn().mockResolvedValue({ id: "wallet-1" }),
  getWalletBalance: vi.fn().mockResolvedValue({ available: 100, held: 0 }),
}));

vi.mock("@/lib/payments/withdraw", () => ({
  processWithdrawal: vi.fn().mockResolvedValue({
    success: true,
    txId: "tx-1",
    txHash: "hash-1",
  }),
  getWithdrawalFee: vi.fn((chain: string) => {
    if (chain === "base") return 0.5;
    if (chain === "polygon") return 0.1;
    return 0.01;
  }),
  getSupportedChains: vi.fn(() => []),
}));

vi.mock("@/lib/logging", () => ({
  systemLog: {
    warn: (...args: unknown[]) => mockWarn(...args),
    info: vi.fn(),
    error: vi.fn(),
  },
  createTaggedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  ),
}));

import { getWalletBalance } from "@/lib/payments/wallet";
import { GET, POST } from "./route";

const ORIGINAL_ENFORCE_WITHDRAW_SCOPE = process.env.ENFORCE_WITHDRAW_SCOPE;
const mockGetWalletBalance = vi.mocked(getWalletBalance);

function createMockAdminClient() {
  return {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { is_seller: true, seller_verified: true },
                  error: null,
                }),
            }),
          }),
        };
      }

      return {};
    },
  };
}

function createMockAdminClientWithProfile(profile: {
  is_seller: boolean;
  seller_verified: boolean;
}) {
  return {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: profile,
                  error: null,
                }),
            }),
          }),
        };
      }

      return {};
    },
  };
}

function makeRequest(): NextRequest {
  return new NextRequest("https://aimarketcap.tech/api/seller/withdraw", {
    method: "POST",
    headers: {
      authorization: "Bearer aimk_legacy",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: 25,
      chain: "solana",
      wallet_address: "11111111111111111111111111111111",
    }),
  });
}

describe("POST /api/seller/withdraw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAdminClient.mockReturnValue(createMockAdminClient());
    delete process.env.ENFORCE_WITHDRAW_SCOPE;
  });

  afterEach(() => {
    if (ORIGINAL_ENFORCE_WITHDRAW_SCOPE === undefined) {
      delete process.env.ENFORCE_WITHDRAW_SCOPE;
    } else {
      process.env.ENFORCE_WITHDRAW_SCOPE = ORIGINAL_ENFORCE_WITHDRAW_SCOPE;
    }
  });

  it("uses a compatibility scope set and logs legacy API-key withdraw usage while enforcement is off", async () => {
    mockResolveAuthUser.mockResolvedValue({
      userId: "seller-1",
      authMethod: "api_key",
      apiKeyId: "key-1",
      apiKeyScopes: ["marketplace"],
    });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(mockResolveAuthUser).toHaveBeenCalledWith(
      expect.any(NextRequest),
      ["withdraw", "marketplace", "write"]
    );
    expect(mockWarn).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("requires the dedicated withdraw scope when enforcement is enabled", async () => {
    process.env.ENFORCE_WITHDRAW_SCOPE = "true";
    mockResolveAuthUser.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(mockResolveAuthUser).toHaveBeenCalledWith(
      expect.any(NextRequest),
      ["withdraw"]
    );
    expect(response.status).toBe(401);
  });

  it("rejects invalid EVM destination addresses before processing a withdrawal", async () => {
    mockResolveAuthUser.mockResolvedValue({
      userId: "seller-1",
      authMethod: "session",
    });

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/seller/withdraw", {
        method: "POST",
        headers: {
          authorization: "Bearer session-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: 25,
          chain: "base",
          wallet_address: "not-a-real-evm-address",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Validation failed");
  });

  it("requires seller verification before allowing a withdrawal", async () => {
    mockResolveAuthUser.mockResolvedValue({
      userId: "seller-1",
      authMethod: "session",
    });
    mockCreateAdminClient.mockReturnValue(
      createMockAdminClientWithProfile({
        is_seller: true,
        seller_verified: false,
      })
    );

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/verification is required/i);
  });

  it("accounts for chain fees in available balance checks", async () => {
    mockResolveAuthUser.mockResolvedValue({
      userId: "seller-1",
      authMethod: "session",
    });
    mockGetWalletBalance.mockResolvedValueOnce({
      available: 25.2,
      held: 0,
      total: 25.2,
      totalEarned: 0,
      totalSpent: 0,
    });

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/seller/withdraw", {
        method: "POST",
        headers: {
          authorization: "Bearer session-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: 25,
          chain: "base",
          wallet_address: "0x000000000000000000000000000000000000dEaD",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/network fee/i);
    expect(body.error).toMatch(/total debit/i);
  });
});

describe("GET /api/seller/withdraw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAdminClient.mockReturnValue(createMockAdminClient());
  });

  it("requires seller verification before exposing withdrawal options", async () => {
    mockResolveAuthUser.mockResolvedValue({
      userId: "seller-1",
      authMethod: "session",
    });
    mockCreateAdminClient.mockReturnValue(
      createMockAdminClientWithProfile({
        is_seller: true,
        seller_verified: false,
      })
    );

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/seller/withdraw", {
        method: "GET",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/verification is required/i);
  });
});
