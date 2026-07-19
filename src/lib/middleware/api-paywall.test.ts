import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateAdminClient = vi.fn();
const mockCreateServerClient = vi.fn();
const mockConsumeDataApiQuota = vi.fn();
const mockGetDataApiEntitlement = vi.fn();
const mockGetWalletByOwner = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

vi.mock("@/lib/payments/wallet", () => ({
  debitWallet: vi.fn(),
  getWalletByOwner: (...args: unknown[]) => mockGetWalletByOwner(...args),
}));

vi.mock("@/lib/data-api/entitlements", () => ({
  consumeDataApiQuota: (...args: unknown[]) => mockConsumeDataApiQuota(...args),
  getDataApiEntitlement: (...args: unknown[]) => mockGetDataApiEntitlement(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 60, remaining: 59, reset: 60 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

import { checkPaywall } from "./api-paywall";

const ORIGINAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createChain(result: unknown) {
  const chain = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (value: unknown) => void) => resolve(result);
        }
        return (..._args: unknown[]) => chain;
      },
    }
  );
  return chain;
}

function createMockAdminSupabase(keyRecord?: Record<string, unknown> | null) {
  return {
    from: (table: string) => {
      if (table === "api_endpoint_pricing") {
        return createChain({ data: [], error: null });
      }
      if (table === "api_keys") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: keyRecord ?? null, error: null }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("checkPaywall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    mockCreateAdminClient.mockReturnValue(createMockAdminSupabase());
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });
    mockGetDataApiEntitlement.mockResolvedValue({
      plan: {
        slug: "free",
        rateLimitPerMinute: 30,
        maxPageSize: 100,
        historyDays: 30,
      },
    });
    mockConsumeDataApiQuota.mockResolvedValue({
      allowed: true,
      planSlug: "free",
      requestCount: 1,
      requestLimit: 2500,
    });
  });

  it("treats fake sb-* cookies without a valid session as public traffic", async () => {
    const request = new NextRequest("https://aimarketcap.tech/api/models", {
      headers: {
        cookie: "sb-fake-auth-token=totally-made-up",
      },
    });

    const result = await checkPaywall(request);

    expect(result.allowed).toBe(true);
    expect(result.callerType).toBe("public");
  });

  it("treats requests with a valid resolved Supabase session as human traffic", async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    });

    const request = new NextRequest("https://aimarketcap.tech/api/models", {
      headers: {
        cookie: "sb-access-token=valid-session-cookie",
      },
    });

    const result = await checkPaywall(request);

    expect(result.allowed).toBe(true);
    expect(result.callerType).toBe("human");
  });

  it("rejects a data request when the API key lacks a data-capable scope", async () => {
    mockCreateAdminClient.mockReturnValue(
      createMockAdminSupabase({
        id: "key-1",
        owner_id: "user-1",
        is_active: true,
        rate_limit_per_minute: 60,
        expires_at: null,
        scopes: ["agent"],
      })
    );

    const result = await checkPaywall(
      new NextRequest("https://aimarketcap.tech/api/models", {
        headers: { authorization: "Bearer aimk_test_key" },
      })
    );

    expect(result).toMatchObject({
      allowed: false,
      callerType: "bot",
      statusCode: 403,
    });
    expect(mockConsumeDataApiQuota).not.toHaveBeenCalled();
  });

  it("enforces the monthly quota before a keyed data response is served", async () => {
    mockCreateAdminClient.mockReturnValue(
      createMockAdminSupabase({
        id: "key-1",
        owner_id: "user-1",
        is_active: true,
        rate_limit_per_minute: 300,
        expires_at: null,
        scopes: ["data"],
      })
    );
    mockConsumeDataApiQuota.mockResolvedValue({
      allowed: false,
      planSlug: "free",
      requestCount: 2500,
      requestLimit: 2500,
    });

    const result = await checkPaywall(
      new NextRequest("https://aimarketcap.tech/api/models", {
        headers: { authorization: "Bearer aimk_test_key" },
      })
    );

    expect(result).toMatchObject({
      allowed: false,
      statusCode: 429,
      planSlug: "free",
      quotaRemaining: 0,
      quotaLimit: 2500,
    });
    expect(mockGetWalletByOwner).not.toHaveBeenCalled();
  });

  it("returns plan limits for an allowed keyed data request without wallet billing", async () => {
    mockCreateAdminClient.mockReturnValue(
      createMockAdminSupabase({
        id: "key-1",
        owner_id: "user-1",
        is_active: true,
        rate_limit_per_minute: 300,
        expires_at: null,
        scopes: ["read"],
      })
    );
    mockConsumeDataApiQuota.mockResolvedValue({
      allowed: true,
      planSlug: "free",
      requestCount: 2,
      requestLimit: 2500,
    });

    const result = await checkPaywall(
      new NextRequest("https://aimarketcap.tech/api/rankings", {
        headers: { authorization: "Bearer aimk_test_key" },
      })
    );

    expect(result).toMatchObject({
      allowed: true,
      planSlug: "free",
      quotaRemaining: 2498,
      quotaLimit: 2500,
      maxPageSize: 100,
      historyDays: 30,
    });
    expect(mockGetWalletByOwner).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  if (ORIGINAL_SUPABASE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_SUPABASE_URL;
  }

  if (ORIGINAL_SUPABASE_ANON_KEY === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_SUPABASE_ANON_KEY;
  }
});
