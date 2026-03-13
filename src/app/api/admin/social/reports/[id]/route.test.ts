import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 20, remaining: 19, reset: 60 })),
  RATE_LIMITS: {
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
import { PATCH } from "./route";

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);

function makeRequest(body: unknown) {
  return new NextRequest("https://aimarketcap.tech/api/admin/social/reports/report-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
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

describe("PATCH /api/admin/social/reports/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for a non-admin session", async () => {
    mockCreateClient.mockResolvedValue(
      makeSessionClient({
        user: { id: "user-1" },
        isAdmin: false,
      }) as never
    );
    mockCreateAdminClient.mockReturnValue({} as never);

    const response = await PATCH(makeRequest({ action: "dismiss" }), {
      params: Promise.resolve({ id: "report-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("dismisses a report without mutating the post", async () => {
    const reportMaybeSingle = vi.fn(async () => ({
      data: {
        id: "report-1",
        post_id: "post-1",
        thread_id: "thread-1",
      },
      error: null,
    }));
    const reportUpdateEq = vi.fn(async () => ({ error: null }));

    mockCreateClient.mockResolvedValue(
      makeSessionClient({
        user: { id: "admin-1" },
        isAdmin: true,
      }) as never
    );
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "social_post_reports") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: reportMaybeSingle,
              })),
            })),
            update: vi.fn(() => ({
              eq: reportUpdateEq,
            })),
          };
        }

        if (table === "social_posts") {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await PATCH(makeRequest({ action: "dismiss", note: "Looks benign" }), {
      params: Promise.resolve({ id: "report-1" }),
    });

    expect(response.status).toBe(200);
    expect(reportUpdateEq).toHaveBeenCalledWith("id", "report-1");
  });

  it("removes a reported root post and resolves the report", async () => {
    const reportMaybeSingle = vi.fn(async () => ({
      data: {
        id: "report-1",
        post_id: "post-1",
        thread_id: "thread-1",
      },
      error: null,
    }));
    const postMaybeSingle = vi.fn(async () => ({
      data: {
        id: "post-1",
        parent_post_id: null,
        metadata: {},
      },
      error: null,
    }));
    const reportUpdateEq = vi.fn(async () => ({ error: null }));
    const postUpdateEq = vi.fn(async () => ({ error: null }));

    mockCreateClient.mockResolvedValue(
      makeSessionClient({
        user: { id: "admin-1" },
        isAdmin: true,
      }) as never
    );
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "social_post_reports") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: reportMaybeSingle,
              })),
            })),
            update: vi.fn(() => ({
              eq: reportUpdateEq,
            })),
          };
        }

        if (table === "social_posts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: postMaybeSingle,
              })),
            })),
            update: vi.fn(() => ({
              eq: postUpdateEq,
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await PATCH(makeRequest({ action: "remove", note: "Confirmed spam" }), {
      params: Promise.resolve({ id: "report-1" }),
    });

    expect(response.status).toBe(200);
    expect(postUpdateEq).toHaveBeenCalledWith("id", "post-1");
    expect(reportUpdateEq).toHaveBeenCalledWith("id", "report-1");
  });
});
