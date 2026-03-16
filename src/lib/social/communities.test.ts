import { describe, expect, it } from "vitest";
import { buildCommunityDirectory, buildCommunityFeedHref } from "./communities";

describe("buildCommunityDirectory", () => {
  it("keeps global first and rolls null-community activity into it", () => {
    const result = buildCommunityDirectory({
      communities: [
        {
          id: "community-global",
          slug: "global",
          name: "Global",
          description: "All conversations",
          is_global: true,
          created_at: "2026-03-16T00:00:00Z",
          updated_at: "2026-03-16T00:00:00Z",
          created_by_actor_id: null,
        },
        {
          id: "community-agents",
          slug: "agents",
          name: "Agents",
          description: "Agent conversations",
          is_global: false,
          created_at: "2026-03-16T00:00:00Z",
          updated_at: "2026-03-16T00:00:00Z",
          created_by_actor_id: null,
        },
      ],
      threads: [
        {
          community_id: null,
          last_posted_at: "2026-03-16T12:00:00Z",
        },
        {
          community_id: "community-agents",
          last_posted_at: "2026-03-15T12:00:00Z",
        },
      ],
      posts: [
        {
          community_id: null,
          status: "published",
        },
        {
          community_id: "community-agents",
          status: "published",
        },
        {
          community_id: "community-agents",
          status: "removed",
        },
      ],
    });

    expect(result[0]?.slug).toBe("global");
    expect(result[0]?.threadCount).toBe(1);
    expect(result[0]?.postCount).toBe(1);
    expect(result[1]?.slug).toBe("agents");
    expect(result[1]?.threadCount).toBe(1);
    expect(result[1]?.postCount).toBe(1);
  });

  it("sorts non-global communities by activity", () => {
    const result = buildCommunityDirectory({
      communities: [
        {
          id: "community-global",
          slug: "global",
          name: "Global",
          description: "All conversations",
          is_global: true,
          created_at: "2026-03-16T00:00:00Z",
          updated_at: "2026-03-16T00:00:00Z",
          created_by_actor_id: null,
        },
        {
          id: "community-agents",
          slug: "agents",
          name: "Agents",
          description: "Agent conversations",
          is_global: false,
          created_at: "2026-03-16T00:00:00Z",
          updated_at: "2026-03-16T00:00:00Z",
          created_by_actor_id: null,
        },
        {
          id: "community-launches",
          slug: "launches",
          name: "Launches",
          description: "Launch chatter",
          is_global: false,
          created_at: "2026-03-16T00:00:00Z",
          updated_at: "2026-03-16T00:00:00Z",
          created_by_actor_id: null,
        },
      ],
      threads: [
        {
          community_id: "community-launches",
          last_posted_at: "2026-03-16T11:00:00Z",
        },
        {
          community_id: "community-launches",
          last_posted_at: "2026-03-16T10:00:00Z",
        },
        {
          community_id: "community-agents",
          last_posted_at: "2026-03-16T09:00:00Z",
        },
      ],
      posts: [
        {
          community_id: "community-agents",
          status: "published",
        },
        {
          community_id: "community-launches",
          status: "published",
        },
      ],
    });

    expect(result.map((community) => community.slug)).toEqual([
      "global",
      "launches",
      "agents",
    ]);
  });
});

describe("buildCommunityFeedHref", () => {
  it("routes global feeds through /commons and topic feeds through dedicated community pages", () => {
    expect(buildCommunityFeedHref("global")).toBe("/commons");
    expect(buildCommunityFeedHref("agents")).toBe("/commons/communities/agents");
    expect(buildCommunityFeedHref("agents", "trusted")).toBe(
      "/commons/communities/agents?mode=trusted"
    );
    expect(buildCommunityFeedHref("global", "latest")).toBe("/commons?mode=latest");
  });
});
