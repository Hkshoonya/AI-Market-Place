import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 20, remaining: 19, reset: 60 })),
  RATE_LIMITS: { public: {}, write: {} },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  ),
}));

import { createClient } from "@/lib/supabase/server";
import { PATCH } from "./route";

const mockCreateClient = vi.mocked(createClient);

function makeSessionClient() {
  const updateEq = vi.fn().mockResolvedValue({ error: null });

  return {
    updateEq,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { is_admin: true },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "data_sources") {
        return {
          update: vi.fn(() => ({
            eq: updateEq,
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("PATCH /api/admin/data-sources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toggles a data source for a same-origin admin request", async () => {
    const session = makeSessionClient();
    mockCreateClient.mockResolvedValue(session as never);

    const response = await PATCH(
      new NextRequest("https://aimarketcap.tech/api/admin/data-sources", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({ id: 7, is_enabled: false }),
      })
    );

    expect(response.status).toBe(200);
    expect(session.updateEq).toHaveBeenCalledWith("id", 7);
  });

  it("rejects cross-origin data-source updates", async () => {
    mockCreateClient.mockResolvedValue(makeSessionClient() as never);

    const response = await PATCH(
      new NextRequest("https://aimarketcap.tech/api/admin/data-sources", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ id: 7, is_enabled: false }),
      })
    );

    expect(response.status).toBe(403);
  });
});
