import { describe, expect, it } from "vitest";

describe("social feed mapping", () => {
  it("maps root posts with actor and reply data into thread cards", async () => {
    const { mapFeedRows } = await import("./feed");

    const result = mapFeedRows({
      communities: [
        { id: "community-1", slug: "global", name: "Global" },
      ],
      threads: [
        {
          id: "thread-1",
          community_id: "community-1",
          title: "Hello world",
          reply_count: 1,
          created_by_actor_id: "actor-1",
          created_at: "2026-03-13T00:00:00.000Z",
          updated_at: "2026-03-13T00:00:00.000Z",
          last_posted_at: "2026-03-13T00:01:00.000Z",
          visibility: "public",
          root_post_id: "post-1",
        },
      ],
      rootPosts: [
        {
          id: "post-1",
          thread_id: "thread-1",
          parent_post_id: null,
          author_actor_id: "actor-1",
          community_id: "community-1",
          content: "Root post",
          language_code: "en",
          status: "published",
          reply_count: 1,
          metadata: {},
          created_at: "2026-03-13T00:00:00.000Z",
          updated_at: "2026-03-13T00:00:00.000Z",
        },
      ],
      replies: [
        {
          id: "post-2",
          thread_id: "thread-1",
          parent_post_id: "post-1",
          author_actor_id: "actor-2",
          community_id: "community-1",
          content: "Reply post",
          language_code: "en",
          status: "published",
          reply_count: 0,
          metadata: {},
          created_at: "2026-03-13T00:01:00.000Z",
          updated_at: "2026-03-13T00:01:00.000Z",
        },
      ],
      actors: [
        {
          id: "actor-1",
          actor_type: "human",
          display_name: "Harshit",
          handle: "harshit_dev",
          avatar_url: null,
          trust_tier: "trusted",
        },
        {
          id: "actor-2",
          actor_type: "agent",
          display_name: "Pipeline Engineer",
          handle: "pipeline-engineer",
          avatar_url: null,
          trust_tier: "basic",
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.thread.title).toBe("Hello world");
    expect(result[0]?.rootPost.author.handle).toBe("harshit_dev");
    expect(result[0]?.replies).toHaveLength(1);
    expect(result[0]?.replies[0]?.author.actor_type).toBe("agent");
  });

  it("preserves thread order so bumped threads stay near the top of the feed", async () => {
    const { mapFeedRows } = await import("./feed");

    const result = mapFeedRows({
      communities: [{ id: "community-1", slug: "global", name: "Global" }],
      threads: [
        {
          id: "thread-new",
          community_id: "community-1",
          title: "Freshly bumped thread",
          reply_count: 2,
          created_by_actor_id: "actor-1",
          created_at: "2026-03-12T00:00:00.000Z",
          updated_at: "2026-03-13T00:05:00.000Z",
          last_posted_at: "2026-03-13T00:05:00.000Z",
          visibility: "public",
          root_post_id: "post-old",
        },
        {
          id: "thread-old",
          community_id: "community-1",
          title: "Recently created thread",
          reply_count: 0,
          created_by_actor_id: "actor-1",
          created_at: "2026-03-13T00:04:00.000Z",
          updated_at: "2026-03-13T00:04:00.000Z",
          last_posted_at: "2026-03-13T00:04:00.000Z",
          visibility: "public",
          root_post_id: "post-new",
        },
      ],
      rootPosts: [
        {
          id: "post-new",
          thread_id: "thread-old",
          parent_post_id: null,
          author_actor_id: "actor-1",
          community_id: "community-1",
          content: "Newer root post",
          language_code: "en",
          status: "published",
          reply_count: 0,
          metadata: {},
          created_at: "2026-03-13T00:04:00.000Z",
          updated_at: "2026-03-13T00:04:00.000Z",
        },
        {
          id: "post-old",
          thread_id: "thread-new",
          parent_post_id: null,
          author_actor_id: "actor-1",
          community_id: "community-1",
          content: "Older root post but fresher thread",
          language_code: "en",
          status: "published",
          reply_count: 2,
          metadata: {},
          created_at: "2026-03-12T00:00:00.000Z",
          updated_at: "2026-03-13T00:05:00.000Z",
        },
      ],
      replies: [],
      actors: [
        {
          id: "actor-1",
          actor_type: "human",
          display_name: "Harshit",
          handle: "harshit_dev",
          avatar_url: null,
          trust_tier: "trusted",
        },
      ],
    });

    expect(result.map((item) => item.thread.id)).toEqual(["thread-new", "thread-old"]);
  });
});
