import { describe, expect, it } from "vitest";

describe("social feed mapping", () => {
  it("describes each feed mode", async () => {
    const { getFeedModeMeta } = await import("./feed");

    expect(getFeedModeMeta("top")).toEqual(
      expect.objectContaining({ label: "Top" })
    );
    expect(getFeedModeMeta("latest")).toEqual(
      expect.objectContaining({ label: "Latest" })
    );
    expect(getFeedModeMeta("trusted")).toEqual(
      expect.objectContaining({ label: "Trusted" })
    );
  });

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
      media: [
        {
          id: "media-root",
          post_id: "post-1",
          media_type: "image",
          url: "https://images.example.com/root.png",
          alt_text: "Root chart",
          metadata: {},
          created_at: "2026-03-13T00:00:30.000Z",
        },
        {
          id: "media-reply",
          post_id: "post-2",
          media_type: "image",
          url: "https://images.example.com/reply.png",
          alt_text: "Reply chart",
          metadata: {},
          created_at: "2026-03-13T00:01:30.000Z",
        },
        {
          id: "preview-root",
          post_id: "post-1",
          media_type: "link_preview",
          url: "https://x.com/OpenAI/status/12345",
          alt_text: null,
          metadata: {
            source_type: "x",
            label: "X update from @OpenAI",
            source_host: "x.com",
            handle: "OpenAI",
            tweet_id: "12345",
          },
          created_at: "2026-03-13T00:00:45.000Z",
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
    expect(result[0]?.rootPost.media).toEqual([
      expect.objectContaining({
        id: "media-root",
        url: "https://images.example.com/root.png",
        alt_text: "Root chart",
      }),
    ]);
    expect(result[0]?.rootPost.linkPreviews).toEqual([
      expect.objectContaining({
        id: "preview-root",
        label: "X update from @OpenAI",
        handle: "OpenAI",
        tweet_id: "12345",
      }),
    ]);
    expect(result[0]?.replies).toHaveLength(1);
    expect(result[0]?.replies[0]?.author.actor_type).toBe("agent");
    expect(result[0]?.replies[0]?.media).toEqual([
      expect.objectContaining({
        id: "media-reply",
        url: "https://images.example.com/reply.png",
        alt_text: "Reply chart",
      }),
    ]);
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

  it("keeps a thread visible when the root post is removed and maps it as a moderation tombstone", async () => {
    const { mapFeedRows } = await import("./feed");

    const result = mapFeedRows({
      communities: [{ id: "community-1", slug: "global", name: "Global" }],
      threads: [
        {
          id: "thread-1",
          community_id: "community-1",
          title: "A disputed thread",
          reply_count: 2,
          created_by_actor_id: "actor-1",
          created_at: "2026-03-13T00:00:00.000Z",
          updated_at: "2026-03-13T00:03:00.000Z",
          last_posted_at: "2026-03-13T00:03:00.000Z",
          visibility: "public",
          root_post_id: "post-root",
        },
      ],
      rootPosts: [
        {
          id: "post-root",
          thread_id: "thread-1",
          parent_post_id: null,
          author_actor_id: "actor-1",
          community_id: "community-1",
          content: "Original content should not render",
          language_code: "en",
          status: "removed",
          reply_count: 2,
          metadata: { moderation_reason: "spam" },
          created_at: "2026-03-13T00:00:00.000Z",
          updated_at: "2026-03-13T00:02:00.000Z",
        },
      ],
      replies: [
        {
          id: "post-2",
          thread_id: "thread-1",
          parent_post_id: "post-root",
          author_actor_id: "actor-2",
          community_id: "community-1",
          content: "Reply survives",
          language_code: "en",
          status: "published",
          reply_count: 0,
          metadata: {},
          created_at: "2026-03-13T00:03:00.000Z",
          updated_at: "2026-03-13T00:03:00.000Z",
        },
      ],
      actors: [
        {
          id: "actor-1",
          actor_type: "human",
          display_name: "Reporter bait",
          handle: "reporter-bait",
          avatar_url: null,
          trust_tier: "basic",
        },
        {
          id: "actor-2",
          actor_type: "human",
          display_name: "Responder",
          handle: "responder",
          avatar_url: null,
          trust_tier: "trusted",
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.rootPost.status).toBe("removed");
    expect(result[0]?.rootPost.content).toBe("Removed by moderation");
    expect(result[0]?.rootPost.moderation_reason).toBe("spam");
    expect(result[0]?.replies).toHaveLength(1);
  });

  it("omits removed replies from reply previews", async () => {
    const { mapFeedRows } = await import("./feed");

    const result = mapFeedRows({
      communities: [{ id: "community-1", slug: "global", name: "Global" }],
      threads: [
        {
          id: "thread-1",
          community_id: "community-1",
          title: "Preview hygiene",
          reply_count: 2,
          created_by_actor_id: "actor-1",
          created_at: "2026-03-13T00:00:00.000Z",
          updated_at: "2026-03-13T00:02:00.000Z",
          last_posted_at: "2026-03-13T00:02:00.000Z",
          visibility: "public",
          root_post_id: "post-root",
        },
      ],
      rootPosts: [
        {
          id: "post-root",
          thread_id: "thread-1",
          parent_post_id: null,
          author_actor_id: "actor-1",
          community_id: "community-1",
          content: "Root content",
          language_code: "en",
          status: "published",
          reply_count: 2,
          metadata: {},
          created_at: "2026-03-13T00:00:00.000Z",
          updated_at: "2026-03-13T00:00:00.000Z",
        },
      ],
      replies: [
        {
          id: "post-2",
          thread_id: "thread-1",
          parent_post_id: "post-root",
          author_actor_id: "actor-2",
          community_id: "community-1",
          content: "Visible reply",
          language_code: "en",
          status: "published",
          reply_count: 0,
          metadata: {},
          created_at: "2026-03-13T00:01:00.000Z",
          updated_at: "2026-03-13T00:01:00.000Z",
        },
        {
          id: "post-3",
          thread_id: "thread-1",
          parent_post_id: "post-root",
          author_actor_id: "actor-3",
          community_id: "community-1",
          content: "Should not show",
          language_code: "en",
          status: "removed",
          reply_count: 0,
          metadata: { moderation_reason: "abuse" },
          created_at: "2026-03-13T00:02:00.000Z",
          updated_at: "2026-03-13T00:02:00.000Z",
        },
      ],
      actors: [
        {
          id: "actor-1",
          actor_type: "human",
          display_name: "Starter",
          handle: "starter",
          avatar_url: null,
          trust_tier: "trusted",
        },
        {
          id: "actor-2",
          actor_type: "human",
          display_name: "Visible",
          handle: "visible",
          avatar_url: null,
          trust_tier: "basic",
        },
        {
          id: "actor-3",
          actor_type: "agent",
          display_name: "Removed",
          handle: "removed",
          avatar_url: null,
          trust_tier: "basic",
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.replies).toHaveLength(1);
    expect(result[0]?.replies[0]?.id).toBe("post-2");
  });

  it("ranks trusted high-reputation threads above low-trust noise in top mode", async () => {
    const { rankFeedThreads } = await import("./feed");

    const ranked = rankFeedThreads(
      [
        {
          thread: {
            id: "thread-basic",
            community_id: "community-1",
            title: "Fresh but low-trust",
            reply_count: 0,
            created_by_actor_id: "actor-basic",
            created_at: "2026-03-13T00:50:00.000Z",
            updated_at: "2026-03-13T00:58:00.000Z",
            last_posted_at: "2026-03-13T00:58:00.000Z",
            visibility: "public",
            root_post_id: "post-basic",
            community: { id: "community-1", slug: "global", name: "Global" },
          },
          rootPost: {
            id: "post-basic",
            content: "Low trust push",
            created_at: "2026-03-13T00:50:00.000Z",
            language_code: "en",
            status: "published",
            moderation_reason: null,
            reply_count: 0,
            author: {
              id: "actor-basic",
              actor_type: "agent",
              display_name: "Basic Agent",
              handle: "basic-agent",
              avatar_url: null,
              trust_tier: "basic",
              reputation_score: 4,
            },
          },
          replies: [],
        },
        {
          thread: {
            id: "thread-trusted",
            community_id: "community-1",
            title: "Trusted field report",
            reply_count: 6,
            created_by_actor_id: "actor-trusted",
            created_at: "2026-03-13T00:20:00.000Z",
            updated_at: "2026-03-13T00:40:00.000Z",
            last_posted_at: "2026-03-13T00:40:00.000Z",
            visibility: "public",
            root_post_id: "post-trusted",
            community: { id: "community-1", slug: "global", name: "Global" },
          },
          rootPost: {
            id: "post-trusted",
            content: "Verified operator update",
            created_at: "2026-03-13T00:20:00.000Z",
            language_code: "en",
            status: "published",
            moderation_reason: null,
            reply_count: 6,
            author: {
              id: "actor-trusted",
              actor_type: "human",
              display_name: "Trusted Operator",
              handle: "trusted-op",
              avatar_url: null,
              trust_tier: "verified",
              reputation_score: 88,
            },
          },
          replies: [],
        },
      ],
      "top"
    );

    expect(ranked.map((item) => item.thread.id)).toEqual(["thread-trusted", "thread-basic"]);
  });

  it("preserves chronology in latest mode", async () => {
    const { rankFeedThreads } = await import("./feed");

    const ranked = rankFeedThreads(
      [
        {
          thread: {
            id: "thread-old",
            community_id: "community-1",
            title: "Older",
            reply_count: 4,
            created_by_actor_id: "actor-1",
            created_at: "2026-03-13T00:00:00.000Z",
            updated_at: "2026-03-13T00:10:00.000Z",
            last_posted_at: "2026-03-13T00:10:00.000Z",
            visibility: "public",
            root_post_id: "post-old",
            community: { id: "community-1", slug: "global", name: "Global" },
          },
          rootPost: {
            id: "post-old",
            content: "Old",
            created_at: "2026-03-13T00:00:00.000Z",
            language_code: "en",
            status: "published",
            moderation_reason: null,
            reply_count: 4,
            author: {
              id: "actor-1",
              actor_type: "human",
              display_name: "A",
              handle: "a",
              avatar_url: null,
              trust_tier: "verified",
              reputation_score: 90,
            },
          },
          replies: [],
        },
        {
          thread: {
            id: "thread-new",
            community_id: "community-1",
            title: "Newer",
            reply_count: 0,
            created_by_actor_id: "actor-2",
            created_at: "2026-03-13T00:20:00.000Z",
            updated_at: "2026-03-13T00:50:00.000Z",
            last_posted_at: "2026-03-13T00:50:00.000Z",
            visibility: "public",
            root_post_id: "post-new",
            community: { id: "community-1", slug: "global", name: "Global" },
          },
          rootPost: {
            id: "post-new",
            content: "New",
            created_at: "2026-03-13T00:20:00.000Z",
            language_code: "en",
            status: "published",
            moderation_reason: null,
            reply_count: 0,
            author: {
              id: "actor-2",
              actor_type: "agent",
              display_name: "B",
              handle: "b",
              avatar_url: null,
              trust_tier: "basic",
              reputation_score: 5,
            },
          },
          replies: [],
        },
      ],
      "latest"
    );

    expect(ranked.map((item) => item.thread.id)).toEqual(["thread-new", "thread-old"]);
  });
});
