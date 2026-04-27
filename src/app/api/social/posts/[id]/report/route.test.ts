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

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/social/auth", () => ({
  resolveSocialActorFromRequest: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSocialActorFromRequest } from "@/lib/social/auth";
import { POST } from "./route";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("https://aimarketcap.tech/api/social/posts/post-1/report", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      origin: "https://aimarketcap.tech",
    },
  });
}

describe("POST /api/social/posts/[id]/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no actor resolves", async () => {
    vi.mocked(resolveSocialActorFromRequest).mockResolvedValue(null);
    vi.mocked(createAdminClient).mockReturnValue({} as never);

    const response = await POST(makeRequest({ reason: "spam" }), {
      params: Promise.resolve({ id: "post-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 400 for an invalid report reason", async () => {
    vi.mocked(resolveSocialActorFromRequest).mockResolvedValue({
      actor: { id: "actor-1", actor_type: "human", display_name: "Harshit" },
      authMethod: "session",
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({} as never);

    const response = await POST(makeRequest({ reason: "nonsense" }), {
      params: Promise.resolve({ id: "post-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/invalid/i);
  });

  it("creates a report for an authenticated actor", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: "post-1",
        thread_id: "thread-1",
        author_actor_id: "actor-2",
        status: "published",
      },
      error: null,
    }));
    const insert = vi.fn(async () => ({
      data: {
        id: "report-1",
        post_id: "post-1",
        thread_id: "thread-1",
        reporter_actor_id: "actor-1",
        target_actor_id: "actor-2",
        reason: "spam",
        status: "open",
        automation_state: "pending",
      },
      error: null,
    }));

    vi.mocked(resolveSocialActorFromRequest).mockResolvedValue({
      actor: { id: "actor-1", actor_type: "human", display_name: "Harshit" },
      authMethod: "session",
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "social_posts") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle,
              }),
            }),
          };
        }

        if (table === "social_post_reports") {
          return {
            insert: () => ({
              select: () => ({
                single: insert,
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await POST(makeRequest({ reason: "spam", details: "Repeated scam links" }), {
      params: Promise.resolve({ id: "post-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.report.id).toBe("report-1");
    expect(body.report.reason).toBe("spam");
  });

  it("returns 409 when the actor already reported the post", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: "post-1",
        thread_id: "thread-1",
        author_actor_id: "actor-2",
        status: "published",
      },
      error: null,
    }));

    vi.mocked(resolveSocialActorFromRequest).mockResolvedValue({
      actor: { id: "actor-1", actor_type: "human", display_name: "Harshit" },
      authMethod: "session",
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "social_posts") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle,
              }),
            }),
          };
        }

        if (table === "social_post_reports") {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: null,
                  error: { code: "23505", message: "duplicate key" },
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await POST(makeRequest({ reason: "spam" }), {
      params: Promise.resolve({ id: "post-1" }),
    });

    expect(response.status).toBe(409);
  });

  it("auto-actions obvious spam by tombstoning a reported root post", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: "post-1",
        thread_id: "thread-1",
        author_actor_id: "actor-2",
        parent_post_id: null,
        status: "published",
        content: "Guaranteed profit 100x now. Scam link repeated.",
        metadata: {},
      },
      error: null,
    }));
    const postUpdateEq = vi.fn(async () => ({ error: null }));
    const reportUpdateEq = vi.fn(async () => ({ error: null }));

    vi.mocked(resolveSocialActorFromRequest).mockResolvedValue({
      actor: { id: "actor-1", actor_type: "human", display_name: "Harshit" },
      authMethod: "session",
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "social_posts") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle,
              }),
            }),
            update: vi.fn(() => ({
              eq: postUpdateEq,
            })),
          };
        }

        if (table === "social_post_reports") {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: "report-2",
                    post_id: "post-1",
                    thread_id: "thread-1",
                    reporter_actor_id: "actor-1",
                    target_actor_id: "actor-2",
                    reason: "spam",
                    status: "open",
                    automation_state: "pending",
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn(() => ({
              eq: reportUpdateEq,
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await POST(makeRequest({ reason: "spam", details: "Repeated scam links" }), {
      params: Promise.resolve({ id: "post-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(postUpdateEq).toHaveBeenCalledWith("id", "post-1");
    expect(reportUpdateEq).toHaveBeenCalledWith("id", "report-2");
    expect(body.report.status).toBe("actioned");
    expect(body.report.automation_state).toBe("auto_actioned");
  });

  it("rejects cross-origin browser report submissions", async () => {
    vi.mocked(resolveSocialActorFromRequest).mockResolvedValue({
      actor: { id: "actor-1", actor_type: "human", display_name: "Harshit" },
      authMethod: "session",
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({} as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/social/posts/post-1/report", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ reason: "spam" }),
      }),
      { params: Promise.resolve({ id: "post-1" }) }
    );

    expect(response.status).toBe(403);
  });
});
