import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  systemLog: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createTaggedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
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

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET, PATCH } from "./route";

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);

function makeRequest(
  method: "GET" | "PATCH",
  options?: {
    query?: Record<string, string>;
    body?: unknown;
  }
) {
  const url = new URL("http://localhost/api/admin/users");
  for (const [key, value] of Object.entries(options?.query ?? {})) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url, {
    method,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    headers: options?.body ? { "content-type": "application/json" } : undefined,
  });
}

function makeSessionClient(options: { user: { id: string } | null; isAdmin: boolean }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: options.user } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: options.user ? { is_admin: options.isAdmin } : null,
      }),
    })),
  };
}

describe("admin users route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns users from the admin client", async () => {
    mockCreateClient.mockResolvedValue(
      makeSessionClient({
        user: { id: "admin-1" },
        isAdmin: true,
      }) as never
    );

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [
            {
              id: "user-2",
              display_name: "User Two",
              username: "user-two",
              email: "user2@example.com",
              is_admin: false,
              is_seller: true,
              seller_verified: false,
              is_banned: false,
              joined_at: "2026-03-01T00:00:00.000Z",
              total_sales: 0,
            },
          ],
          count: 1,
          error: null,
        }),
      })),
    } as never);

    const response = await GET(makeRequest("GET", { query: { page: "1" } }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      users: [
        expect.objectContaining({
          id: "user-2",
          email: "user2@example.com",
        }),
      ],
      totalCount: 1,
    });
  });

  it("uses the admin client for profile updates", async () => {
    const updateEqMock = vi.fn().mockResolvedValue({
      data: [{ id: "user-2" }],
      error: null,
    });

    mockCreateClient.mockResolvedValue(
      makeSessionClient({
        user: { id: "admin-1" },
        isAdmin: true,
      }) as never
    );

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn((payload: unknown) => {
          expect(payload).toMatchObject({
            is_admin: true,
          });
          return {
            eq: updateEqMock,
          };
        }),
      })),
    } as never);

    const response = await PATCH(
      makeRequest("PATCH", {
        body: { userId: "11111111-1111-1111-1111-111111111111", isAdmin: true },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(updateEqMock).toHaveBeenCalledWith(
      "id",
      "11111111-1111-1111-1111-111111111111"
    );
  });
});
