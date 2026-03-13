import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import { GET } from "./route";

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://aimarketcap.tech";
  });

  afterEach(() => {
    if (ORIGINAL_SITE_URL === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      return;
    }

    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
  });

  it("redirects successful auth callbacks to the canonical site origin", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      },
    });

    const response = await GET(
      new Request(
        "https://spoofed.example/auth/callback?code=test-code&next=%2Fdashboard"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://aimarketcap.tech/dashboard"
    );
  });

  it("redirects failed auth callbacks to the canonical login URL", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          error: new Error("exchange failed"),
        }),
      },
    });

    const response = await GET(
      new Request(
        "https://spoofed.example/auth/callback?code=test-code&next=%2Fdashboard"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://aimarketcap.tech/login?error=auth_callback_failed"
    );
  });
});
