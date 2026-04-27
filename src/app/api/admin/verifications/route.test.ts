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

vi.mock("@/lib/logging", () => ({
  systemLog: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
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

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PATCH } from "./route";

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);

function makeSessionClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }),
    },
    from: vi.fn((table: string) => {
      if (table !== "profiles") {
        throw new Error(`Unexpected table ${table}`);
      }

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
    }),
  };
}

function makeAdminClient() {
  const requestUpdateEq = vi.fn().mockResolvedValue({ error: null });
  const profileUpdateEq = vi.fn().mockResolvedValue({ error: null });
  const notifInsert = vi.fn().mockResolvedValue({ error: null });

  return {
    requestUpdateEq,
    profileUpdateEq,
    notifInsert,
    from: vi.fn((table: string) => {
      if (table === "seller_verification_requests") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { user_id: "seller-1", status: "pending" },
                error: null,
              }),
            }),
          }),
          update: vi.fn(() => ({
            eq: requestUpdateEq,
          })),
        };
      }

      if (table === "profiles") {
        return {
          update: vi.fn(() => ({
            eq: profileUpdateEq,
          })),
        };
      }

      if (table === "notifications") {
        return {
          insert: notifInsert,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("PATCH /api/admin/verifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves verification requests for same-origin admin requests", async () => {
    mockCreateClient.mockResolvedValue(makeSessionClient() as never);
    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await PATCH(
      new NextRequest("https://aimarketcap.tech/api/admin/verifications", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({ request_id: "request-1", action: "approve" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("approved");
    expect(admin.requestUpdateEq).toHaveBeenCalledWith("id", "request-1");
    expect(admin.profileUpdateEq).toHaveBeenCalledWith("id", "seller-1");
  });

  it("rejects cross-origin verification updates", async () => {
    mockCreateClient.mockResolvedValue(makeSessionClient() as never);
    mockCreateAdminClient.mockReturnValue(makeAdminClient() as never);

    const response = await PATCH(
      new NextRequest("https://aimarketcap.tech/api/admin/verifications", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ request_id: "request-1", action: "approve" }),
      })
    );

    expect(response.status).toBe(403);
  });
});
