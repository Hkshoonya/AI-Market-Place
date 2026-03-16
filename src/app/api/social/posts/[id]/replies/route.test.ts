import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/social/auth", () => ({
  resolveSocialActorFromRequest: vi.fn(),
}));

vi.mock("@/lib/social/actors", () => ({
  canActorReplyToThread: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSocialActorFromRequest } from "@/lib/social/auth";
import { canActorReplyToThread } from "@/lib/social/actors";
import { POST } from "./route";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("https://aimarketcap.tech/api/social/posts/post-1/replies", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/social/posts/[id]/replies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no social actor resolves", async () => {
    vi.mocked(resolveSocialActorFromRequest).mockResolvedValue(null);
    vi.mocked(createAdminClient).mockReturnValue({} as never);

    const response = await POST(makeRequest({ content: "reply" }), {
      params: Promise.resolve({ id: "post-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("increments the parent post and thread reply counters when creating a reply", async () => {
    const socialPostUpdateEq = vi.fn(async () => ({ error: null }));
    const socialThreadUpdateEq = vi.fn(async () => ({ error: null }));
    const mediaInsert = vi.fn(async () => ({ error: null }));
    const replySingle = vi.fn(async () => ({
      data: {
        id: "reply-1",
        thread_id: "thread-1",
        parent_post_id: "post-1",
        content: "reply",
      },
      error: null,
    }));

    const admin = {
      from: vi.fn((table: string) => {
        if (table === "social_posts") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "post-1",
                    thread_id: "thread-1",
                    community_id: "community-1",
                    reply_count: 1,
                  },
                  error: null,
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: replySingle,
              }),
            }),
            update: (values: Record<string, unknown>) => ({
              eq: async (column: string, value: string) => {
                await socialPostUpdateEq(values, column, value);
                return { error: null };
              },
            }),
          };
        }
        if (table === "social_post_media") {
          return { insert: mediaInsert };
        }

        if (table === "social_threads") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "thread-1",
                    reply_count: 3,
                  },
                  error: null,
                }),
              }),
            }),
            update: (values: Record<string, unknown>) => ({
              eq: async (column: string, value: string) => {
                await socialThreadUpdateEq(values, column, value);
                return { error: null };
              },
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    vi.mocked(createAdminClient).mockReturnValue(admin as never);
    vi.mocked(resolveSocialActorFromRequest).mockResolvedValue({
      actor: {
        id: "actor-2",
        actor_type: "agent",
        display_name: "Pipeline Engineer",
      },
      authMethod: "api_key",
    } as never);
    vi.mocked(canActorReplyToThread).mockResolvedValue({ allowed: true });

    const response = await POST(
      makeRequest({
        content: "reply https://github.com/openai/openai-node",
        images: [
          {
            url: "https://images.example.com/reply.png",
            alt_text: "Reply attachment",
          },
        ],
      }),
      {
      params: Promise.resolve({ id: "post-1" }),
      }
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.reply.id).toBe("reply-1");
    expect(mediaInsert).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        post_id: "reply-1",
        media_type: "image",
        url: "https://images.example.com/reply.png",
        alt_text: "Reply attachment",
      }),
    ]);
    expect(mediaInsert).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({
        post_id: "reply-1",
        media_type: "link_preview",
        url: "https://github.com/openai/openai-node",
        metadata: expect.objectContaining({
          source_type: "github",
        }),
      }),
    ]);
    expect(socialPostUpdateEq).toHaveBeenCalledWith(
      expect.objectContaining({ reply_count: 2 }),
      "id",
      "post-1"
    );
    expect(socialThreadUpdateEq).toHaveBeenCalledWith(
      expect.objectContaining({ reply_count: 4 }),
      "id",
      "thread-1"
    );
  });
});
