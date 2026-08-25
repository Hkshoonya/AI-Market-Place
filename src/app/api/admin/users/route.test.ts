import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

vi.mock("@/lib/logging", () => ({
  systemLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createTaggedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 60, remaining: 59, reset: 60 })),
  RATE_LIMITS: {
    public: { limit: 60, windowMs: 60_000 },
    write: { limit: 20, windowMs: 60_000 },
  },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { requireAdminSession } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET, PATCH } from "./route";

const mockRequireAdminSession = vi.mocked(requireAdminSession);
const mockCreateAdminClient = vi.mocked(createAdminClient);

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function makeRequest(
  method: "GET" | "PATCH",
  options?: { query?: Record<string, string>; body?: unknown; origin?: string }
) {
  const url = new URL("http://localhost/api/admin/users");
  for (const [key, value] of Object.entries(options?.query ?? {})) {
    url.searchParams.set(key, value);
  }

  return new NextRequest(url, {
    method,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    headers: options?.body
      ? {
          "content-type": "application/json",
          origin: options.origin ?? "http://localhost",
        }
      : undefined,
  });
}

function makeGetAdminClient() {
  const profileSelectColumns: string[] = [];
  const profile = {
    id: USER_ID,
    display_name: "User Two",
    username: "user-two",
    email: "user2@example.com",
    is_admin: false,
    is_approved: true,
    is_seller: false,
    seller_verified: false,
    is_banned: false,
    joined_at: "2026-03-01T00:00:00.000Z",
    last_login: null,
    total_sales: 0,
  };

  const activationRows: Record<string, unknown[]> = {
    watchlists: [],
    user_bookmarks: [],
    api_keys: [
      {
        owner_id: USER_ID,
        is_active: true,
        created_at: "2026-03-02T00:00:00.000Z",
        last_used_at: null,
      },
    ],
    provider_connections: [
      {
        user_id: USER_ID,
        status: "active",
        created_at: "2026-03-03T00:00:00.000Z",
        last_used_at: null,
      },
    ],
    workspace_runtimes: [],
    workspace_deployments: [],
    data_api_subscriptions: [],
    data_api_usage_monthly: [],
  };

  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn((columns: string, options?: { head?: boolean }) => {
          profileSelectColumns.push(columns);
          if (options?.head) {
            return {
              eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
            };
          }

          const builder = {
            eq: vi.fn(),
            or: vi.fn(),
            order: vi.fn(),
            range: vi.fn(),
          };
          builder.eq.mockReturnValue(builder);
          builder.or.mockReturnValue(builder);
          builder.order.mockReturnValue(builder);
          builder.range.mockResolvedValue({
            data: [profile],
            count: 1,
            error: null,
          });
          return builder;
        }),
      };
    }

    return {
      select: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({
          data: activationRows[table] ?? [],
          error: null,
        }),
      })),
    };
  });

  const listUsers = vi.fn().mockResolvedValue({
    data: {
      users: [
        {
          id: USER_ID,
          email: "user2@example.com",
          email_confirmed_at: "2026-03-01T00:01:00.000Z",
          phone_confirmed_at: null,
          last_sign_in_at: new Date().toISOString(),
          banned_until: null,
          created_at: "2026-03-01T00:00:00.000Z",
          app_metadata: { provider: "email" },
          user_metadata: {},
          aud: "authenticated",
        },
      ],
      total: 1,
      aud: "authenticated",
    },
    error: null,
  });

  return {
    client: {
      from,
      auth: {
        admin: {
          listUsers,
          getUserById: vi.fn(),
        },
      },
    },
    profileSelectColumns,
  };
}

describe("admin users route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({ user: { id: ADMIN_ID } });
  });

  it("returns auth and activation signals without querying removed profile fields", async () => {
    const { client, profileSelectColumns } = makeGetAdminClient();
    mockCreateAdminClient.mockReturnValue(client as never);

    const response = await GET(makeRequest("GET", { query: { page: "1" } }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.users[0]).toEqual(
      expect.objectContaining({
        id: USER_ID,
        email: "user2@example.com",
        auth: expect.objectContaining({ confirmed: true, provider: "email" }),
        activation: expect.objectContaining({
          stage: "activated",
          apiKeys: 1,
          providerConnections: 1,
        }),
      })
    );
    expect(body.summary).toEqual(
      expect.objectContaining({ registered: 1, confirmed: 1, active30d: 1 })
    );
    expect(body.totalCount).toBe(1);
    expect(profileSelectColumns[0]).toContain("is_approved");
    expect(profileSelectColumns[0]).not.toContain("reputation_score");
  });

  it("uses the admin client for profile updates", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: USER_ID,
        is_admin: true,
        is_seller: false,
        seller_verified: false,
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn((payload: unknown) => {
      expect(payload).toMatchObject({ is_admin: true });
      return { eq };
    });

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({ update })),
    } as never);

    const response = await PATCH(
      makeRequest("PATCH", {
        body: { userId: USER_ID, isAdmin: true },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(eq).toHaveBeenCalledWith("id", USER_ID);
  });

  it("prevents an administrator from removing their own access", async () => {
    const response = await PATCH(
      makeRequest("PATCH", {
        body: { userId: ADMIN_ID, isAdmin: false },
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("own admin"),
    });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("rejects cross-origin admin user updates before authorization", async () => {
    const response = await PATCH(
      makeRequest("PATCH", {
        origin: "https://evil.example",
        body: { userId: USER_ID, isAdmin: true },
      })
    );

    expect(response.status).toBe(403);
    expect(mockRequireAdminSession).not.toHaveBeenCalled();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });
});
