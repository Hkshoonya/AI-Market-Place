import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateAdminClient = vi.fn();
const mockCreateServerClient = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

vi.mock("@/lib/payments/wallet", () => ({
  debitWallet: vi.fn(),
  getWalletByOwner: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 60, remaining: 59, reset: 60 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

import { checkPaywall } from "./api-paywall";

const ORIGINAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createMockAdminSupabase() {
  return {
    from: () => {
      const result = { data: [], error: null };
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
