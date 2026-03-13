import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 20, remaining: 19, reset: 60 })),
  RATE_LIMITS: {
    public: { limit: 30, windowMs: 60_000 },
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
import { GET } from "./route";

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);

function makeRequest() {
  return new NextRequest("https://aimarketcap.tech/api/admin/social/reports");
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

describe("GET /api/admin/social/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no authenticated admin session", async () => {
    mockCreateClient.mockResolvedValue(
      makeSessionClient({
        user: null,
        isAdmin: false,
      }) as never
    );
    mockCreateAdminClient.mockReturnValue({} as never);

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-admin session", async () => {
    mockCreateClient.mockResolvedValue(
      makeSessionClient({
        user: { id: "user-1" },
        isAdmin: false,
      }) as never
    );
    mockCreateAdminClient.mockReturnValue({} as never);

    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
  });

  it("returns recent social moderation reports for admins", async () => {
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
              order: vi.fn(async () => ({
                data: [
                  {
                    id: "report-1",
                    post_id: "post-1",
                    thread_id: "thread-1",
                    reporter_actor_id: "actor-1",
                    target_actor_id: "actor-2",
                    reason: "spam",
                    status: "open",
                    automation_state: "pending",
                    created_at: "2026-03-13T00:00:00.000Z",
                  },
                ],
                error: null,
              })),
            })),
          };
        }

        if (table === "social_posts") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [
                  {
                    id: "post-1",
                    thread_id: "thread-1",
                    author_actor_id: "actor-2",
                    content: "Spam content",
                    status: "published",
                  },
                ],
                error: null,
              })),
            })),
          };
        }

        if (table === "social_threads") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [{ id: "thread-1", title: "Spam thread" }],
                error: null,
              })),
            })),
          };
        }

        if (table === "network_actors") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [
                  { id: "actor-1", display_name: "Reporter", handle: "reporter", actor_type: "human" },
                  { id: "actor-2", display_name: "Target", handle: "target", actor_type: "agent" },
                ],
                error: null,
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0].post.id).toBe("post-1");
    expect(body.reports[0].thread.title).toBe("Spam thread");
  });
});
