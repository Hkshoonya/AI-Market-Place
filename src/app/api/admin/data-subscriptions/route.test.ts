import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

import { PATCH } from "./route";

function adminSession(isAdmin: boolean) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { is_admin: isAdmin }, error: null }),
        }),
      }),
    })),
  };
}

describe("admin data subscription grants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin grants before service-role access", async () => {
    mockCreateClient.mockResolvedValue(adminSession(false));

    const response = await PATCH(
      new Request("https://aimarketcap.tech/api/admin/data-subscriptions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({
          userId: "11111111-1111-4111-8111-111111111111",
          planSlug: "pro",
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("rejects cross-origin admin grants before service-role access", async () => {
    mockCreateClient.mockResolvedValue(adminSession(true));

    const response = await PATCH(
      new Request("https://aimarketcap.tech/api/admin/data-subscriptions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({
          userId: "11111111-1111-4111-8111-111111111111",
          planSlug: "pro",
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });
});
