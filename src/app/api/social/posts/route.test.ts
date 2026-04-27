import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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
  return new NextRequest("https://aimarketcap.tech/api/social/posts", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      origin: "https://aimarketcap.tech",
    },
  });
}

describe("POST /api/social/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no social actor resolves", async () => {
    vi.mocked(resolveSocialActorFromRequest).mockResolvedValue(null);
    vi.mocked(createAdminClient).mockReturnValue({} as never);

    const response = await POST(makeRequest({ content: "Hello world" }));

    expect(response.status).toBe(401);
  });

  it("creates a root thread for an authenticated actor", async () => {
    const update = vi.fn(async () => ({ error: null }));
    const mediaInsert = vi.fn(async () => ({ error: null }));
    const threadInsert = vi
      .fn(() => ({
        select: () => ({
          single: async () => ({
            data: {
              id: "thread-1",
              title: "Hello",
              community_id: "community-1",
            },
            error: null,
          }),
        }),
      }));
    const postInsert = vi
      .fn(() => ({
        select: () => ({
          single: async () => ({
            data: {
              id: "post-1",
              thread_id: "thread-1",
              content: "Hello world",
            },
            error: null,
          }),
        }),
      }));
    const maybeSingle = vi.fn(async () => ({
      data: { id: "community-1", slug: "global", name: "Global" },
      error: null,
    }));
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "social_threads") {
          return { insert: threadInsert, update: () => ({ eq: update }) };
        }
        if (table === "social_posts") {
          return { insert: postInsert };
        }
        if (table === "social_post_media") {
          return { insert: mediaInsert };
        }
        if (table === "social_communities") {
          return {
            select: () => ({
              eq: () => ({ maybeSingle }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    vi.mocked(createAdminClient).mockReturnValue(admin as never);
    vi.mocked(resolveSocialActorFromRequest).mockResolvedValue({
      actor: {
        id: "actor-1",
        actor_type: "human",
        display_name: "Harshit",
      },
      authMethod: "session",
    } as never);

    const response = await POST(
      makeRequest({
        title: "Hello",
        content: "Hello world https://x.com/OpenAI/status/12345",
        community_slug: "global",
        images: [
          {
            url: "https://images.example.com/sunrise.png",
            alt_text: "Sunrise dashboard",
          },
        ],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.thread.id).toBe("thread-1");
    expect(body.post.id).toBe("post-1");
    expect(mediaInsert).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        post_id: "post-1",
        media_type: "image",
        url: "https://images.example.com/sunrise.png",
        alt_text: "Sunrise dashboard",
      }),
    ]);
    expect(mediaInsert).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({
        post_id: "post-1",
        media_type: "link_preview",
        url: "https://x.com/OpenAI/status/12345",
        metadata: expect.objectContaining({
          source_type: "x",
          handle: "OpenAI",
          tweet_id: "12345",
        }),
      }),
    ]);
  });

  it("rejects cross-origin browser social post creation", async () => {
    vi.mocked(resolveSocialActorFromRequest).mockResolvedValue({
      actor: {
        id: "actor-1",
        actor_type: "human",
        display_name: "Harshit",
      },
      authMethod: "session",
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({} as never);

    const response = await POST(
      new NextRequest("https://aimarketcap.tech/api/social/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ content: "Hello world" }),
      })
    );

    expect(response.status).toBe(403);
  });
});
