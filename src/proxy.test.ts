import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/constants/site", () => ({
  buildCanonicalUrl: (path: string) => `https://aimarketcap.tech${path}`,
  getCanonicalWwwHost: () => "www.aimarketcap.tech",
}));

import { proxy } from "./proxy";

function makeRequest(pathname: string) {
  return new NextRequest(`https://aimarketcap.tech${pathname}`);
}

function makeSupabaseClient(options: {
  user: { id: string } | null;
  isAdmin?: boolean;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user },
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { is_admin: options.isAdmin ?? false },
      }),
    })),
  };
}

describe("proxy admin protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("redirects anonymous exact /admin requests to login", async () => {
    createServerClientMock.mockReturnValue(
      makeSupabaseClient({ user: null })
    );

    const response = await proxy(makeRequest("/admin"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://aimarketcap.tech/login?redirect=%2Fadmin"
    );
  });

  it("redirects authenticated non-admin exact /admin requests to home", async () => {
    createServerClientMock.mockReturnValue(
      makeSupabaseClient({ user: { id: "user-1" }, isAdmin: false })
    );

    const response = await proxy(makeRequest("/admin"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://aimarketcap.tech/");
  });

  it("skips Supabase user resolution for anonymous public routes", async () => {
    const supabase = makeSupabaseClient({ user: null });
    createServerClientMock.mockReturnValue(supabase);

    const response = await proxy(makeRequest("/"));

    expect(response.status).toBe(200);
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it("still resolves Supabase user state when a public route carries sb cookies", async () => {
    const supabase = makeSupabaseClient({ user: { id: "user-1" } });
    createServerClientMock.mockReturnValue(supabase);

    const request = new NextRequest("https://aimarketcap.tech/", {
      headers: {
        cookie: "sb-access-token=valid-session-cookie",
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
  });
});
