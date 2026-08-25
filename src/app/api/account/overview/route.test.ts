import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/logging", () => ({
  systemLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createTaggedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 60, remaining: 59, reset: 60 })),
  RATE_LIMITS: { api: { limit: 60, windowMs: 60_000 } },
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);
const USER_ID = "22222222-2222-4222-8222-222222222222";

function request() {
  return new NextRequest("http://localhost/api/account/overview");
}

function makeServerClient(user: { id: string; email: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: user
          ? {
              display_name: "Test User",
              username: "tester",
              joined_at: "2026-01-01T00:00:00.000Z",
              is_seller: false,
              seller_verified: false,
              is_banned: false,
            }
          : null,
        error: null,
      }),
    })),
  };
}

function queryBuilder(result: { data: unknown; count?: number; error: null }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "order", "limit"] as const) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (
    resolve: (value: typeof result) => unknown,
    reject: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

function makeAdminClient() {
  const results: Record<string, { data: unknown; count?: number; error: null }> = {
    watchlists: { data: null, count: 1, error: null },
    user_bookmarks: { data: null, count: 1, error: null },
    api_keys: { data: null, count: 1, error: null },
    provider_connections: { data: null, count: 0, error: null },
    workspace_deployments: { data: [], error: null },
    data_api_subscriptions: {
      data: [
        {
          plan_slug: "free",
          status: "active",
          current_period_end: null,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    },
    data_api_usage_monthly: {
      data: { request_count: 12, last_request_at: "2026-08-20T00:00:00.000Z" },
      error: null,
    },
    marketplace_orders: { data: null, count: 0, error: null },
    marketplace_listings: { data: null, count: 0, error: null },
  };

  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => queryBuilder(results[table]!)),
    })),
  };
}

describe("GET /api/account/overview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated requests before using the service client", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("returns only the authenticated user's product progress", async () => {
    mockCreateClient.mockResolvedValue(
      makeServerClient({ id: USER_ID, email: "user@example.com" }) as never
    );
    const admin = makeAdminClient();
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.account).toMatchObject({
      email: "user@example.com",
      displayName: "Test User",
    });
    expect(body.progress).toMatchObject({
      trackedModels: 2,
      activeApiKeys: 1,
      providerConnections: 0,
      deployments: 0,
    });
    expect(body.usage.dataRequestsThisMonth).toBe(12);
    expect(body.plan.slug).toBe("free");

    for (const table of [
      "watchlists",
      "user_bookmarks",
      "api_keys",
      "provider_connections",
      "workspace_deployments",
      "data_api_subscriptions",
    ]) {
      expect(admin.from).toHaveBeenCalledWith(table);
    }
  });
});
