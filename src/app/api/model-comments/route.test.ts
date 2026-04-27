import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DELETE, GET, PATCH, POST } from "./route";

function makeAdminClient(options?: {
  topLevelComments?: unknown[];
  replies?: unknown[];
  profiles?: unknown[];
  insertedComment?: unknown;
  updatedComment?: unknown;
  deleteError?: { message?: string } | null;
  rpcError?: { message?: string } | null;
}) {
  const {
    topLevelComments = [],
    replies = [],
    profiles = [],
    insertedComment = null,
    updatedComment = null,
    deleteError = null,
    rpcError = null,
  } = options ?? {};

  return {
    from: vi.fn((table: string) => {
      if (table === "comments") {
        const updateSelectChain = {
          maybeSingle: vi.fn(async () => ({
            data: updatedComment,
            error: null,
          })),
        };
        const updateSecondEqChain = {
          select: vi.fn(() => updateSelectChain),
        };
        const updateEqChain = {
          eq: vi.fn(() => updateSecondEqChain),
        };

        const deleteEqChain = {
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({
              error: deleteError,
            })),
          })),
        };

        return {
          select: vi.fn((columns?: string) => {
            if (String(columns).includes("model_id")) {
              return {
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(async () => ({
                        data: topLevelComments,
                        error: null,
                      })),
                    })),
                  })),
                })),
                in: vi.fn(() => ({
                  order: vi.fn(async () => ({
                    data: replies,
                    error: null,
                  })),
                })),
              };
            }

            return {
              single: vi.fn(async () => ({
                data: insertedComment,
                error: null,
              })),
            };
          }),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: insertedComment,
                error: null,
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => updateEqChain),
          })),
          delete: vi.fn(() => deleteEqChain),
        };
      }

      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: profiles, error: null })),
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: profiles[0] ?? null,
                error: null,
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn(async () => ({ error: rpcError })),
  };
}

describe("/api/model-comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns enriched comments with replies on GET", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeAdminClient({
        topLevelComments: [
          {
            id: "comment-1",
            model_id: "model-1",
            user_id: "user-1",
            parent_id: null,
            content: "Top level",
            upvotes: 2,
            is_edited: false,
            created_at: "2026-03-30T10:00:00Z",
            updated_at: "2026-03-30T10:00:00Z",
          },
        ],
        replies: [
          {
            id: "reply-1",
            model_id: "model-1",
            user_id: "user-2",
            parent_id: "comment-1",
            content: "Reply body",
            upvotes: 0,
            is_edited: false,
            created_at: "2026-03-30T10:05:00Z",
            updated_at: "2026-03-30T10:05:00Z",
          },
        ],
        profiles: [
          {
            id: "user-1",
            display_name: "Alice",
            avatar_url: null,
            username: "alice",
          },
          {
            id: "user-2",
            display_name: "Bob",
            avatar_url: null,
            username: "bob",
          },
        ],
      }) as never
    );

    const response = await GET(
      new NextRequest("https://aimarketcap.tech/api/model-comments?modelId=model-1&limit=20")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].profiles.display_name).toBe("Alice");
    expect(body.comments[0].replies).toHaveLength(1);
    expect(body.comments[0].replies[0].profiles.display_name).toBe("Bob");
  });

  it("returns 401 on POST without a signed-in user", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
    } as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient() as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/model-comments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({
          modelId: "model-1",
          content: "Hello world",
        }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("creates a comment and returns the enriched payload on POST", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
    } as never);
    vi.mocked(createAdminClient).mockReturnValue(
      makeAdminClient({
        insertedComment: {
          id: "comment-new",
          model_id: "model-1",
          user_id: "user-1",
          parent_id: null,
          content: "Hello world",
          upvotes: 0,
          is_edited: false,
          created_at: "2026-03-30T12:00:00Z",
          updated_at: "2026-03-30T12:00:00Z",
        },
        profiles: [
          {
            id: "user-1",
            display_name: "Alice",
            avatar_url: null,
            username: "alice",
          },
        ],
      }) as never
    );

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/model-comments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({
          modelId: "model-1",
          content: "Hello world",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.comment.content).toBe("Hello world");
    expect(body.comment.profiles.display_name).toBe("Alice");
    expect(body.comment.replies).toEqual([]);
  });

  it("upvotes a comment on PATCH", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
    } as never);
    const adminClient = makeAdminClient();
    vi.mocked(createAdminClient).mockReturnValue(adminClient as never);

    const response = await PATCH(
      new NextRequest("https://aimarketcap.tech/api/model-comments", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({
          action: "upvote",
          commentId: "comment-1",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(adminClient.rpc).toHaveBeenCalledWith("increment_comment_upvote", {
      comment_id: "comment-1",
    });
  });

  it("edits a comment on PATCH", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
    } as never);
    vi.mocked(createAdminClient).mockReturnValue(
      makeAdminClient({
        updatedComment: {
          id: "comment-1",
          model_id: "model-1",
          user_id: "user-1",
          parent_id: null,
          content: "Edited comment",
          upvotes: 0,
          created_at: "2026-03-30T12:00:00Z",
          updated_at: "2026-03-30T12:05:00Z",
        },
      }) as never
    );

    const response = await PATCH(
      new NextRequest("https://aimarketcap.tech/api/model-comments", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({
          action: "edit",
          commentId: "comment-1",
          content: "Edited comment",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.comment.content).toBe("Edited comment");
  });

  it("deletes a comment on DELETE", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
    } as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient() as never);

    const response = await DELETE(
      new NextRequest("https://aimarketcap.tech/api/model-comments", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          origin: "https://aimarketcap.tech",
        },
        body: JSON.stringify({
          commentId: "comment-1",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("rejects cross-origin comment creation requests", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
    } as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient() as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/model-comments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({
          modelId: "model-1",
          content: "Hello world",
        }),
      })
    );

    expect(response.status).toBe(403);
  });
});
