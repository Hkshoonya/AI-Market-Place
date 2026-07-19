import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockCheckAffiliateDestination = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock("@/lib/affiliate/health", () => ({
  checkAffiliateDestination: (...args: unknown[]) =>
    mockCheckAffiliateDestination(...args),
}));

import { PATCH } from "./route";

function session(options: { user: { id: string } | null; isAdmin?: boolean }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: options.user }, error: null }),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: { is_admin: options.isAdmin ?? false }, error: null }),
        }),
      }),
    })),
  };
}

describe("admin affiliate link mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects authenticated non-admin users before service-role access", async () => {
    mockCreateClient.mockResolvedValue(
      session({ user: { id: "user-1" }, isAdmin: false })
    );

    const response = await PATCH(
      new Request("https://aimarketcap.tech/api/admin/affiliate-links", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({
          id: "11111111-1111-4111-8111-111111111111",
          status: "paused",
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("rejects cross-origin admin mutations before destination checks", async () => {
    mockCreateClient.mockResolvedValue(
      session({ user: { id: "admin-1" }, isAdmin: true })
    );

    const response = await PATCH(
      new Request("https://aimarketcap.tech/api/admin/affiliate-links", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({
          id: "11111111-1111-4111-8111-111111111111",
          status: "active",
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockCheckAffiliateDestination).not.toHaveBeenCalled();
  });
});
