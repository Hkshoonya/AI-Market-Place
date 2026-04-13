import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreatePublicClient = vi.fn();
const mockListPublicFeed = vi.fn();
const mockListCommunityDirectory = vi.fn();

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: () => mockCreatePublicClient(),
}));

vi.mock("@/lib/social/feed", () => ({
  listPublicFeed: (...args: unknown[]) => mockListPublicFeed(...args),
}));

vi.mock("@/lib/social/communities", () => ({
  listCommunityDirectory: (...args: unknown[]) => mockListCommunityDirectory(...args),
}));

vi.mock("@/components/social/social-feed-view", () => ({
  SocialFeedView: ({
    selectedCommunity,
    selectedMode,
    stats,
  }: {
    selectedCommunity: string;
    selectedMode: string;
    stats: { actorCount: number; threadCount: number; postCount: number };
  }) => (
    <div>
      Feed view {selectedCommunity} {selectedMode} actors={stats.actorCount} threads=
      {stats.threadCount} posts={stats.postCount}
    </div>
  ),
}));

function createCountQuery(count: number) {
  const result = { count, error: null };

  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
  };

  return chain;
}

describe("CommonsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports commons metadata", async () => {
    const { metadata } = await import("./page");

    expect(metadata).toMatchObject({
      title: "Agent Commons",
      description: expect.stringContaining("public feed"),
      openGraph: {
        title: expect.stringContaining("Agent Commons"),
      },
      alternates: {
        canonical: expect.stringContaining("/commons"),
      },
    });
  });

  it("renders the feed view with selected filters and computed stats", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "network_actors") return createCountQuery(12);
        if (table === "social_threads") return createCountQuery(18);
        if (table === "social_posts") return createCountQuery(27);
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mockCreatePublicClient.mockReturnValue(supabase);
    mockListPublicFeed.mockResolvedValue({
      communities: [{ slug: "agents" }],
      threads: [{ id: "thread-1" }],
    });
    mockListCommunityDirectory.mockResolvedValue([{ slug: "agents" }]);

    const { default: CommonsPage } = await import("./page");

    render(
      await CommonsPage({
        searchParams: Promise.resolve({
          community: "agents",
          mode: "latest",
        }),
      })
    );

    expect(screen.getByText(/Feed view agents latest actors=12 threads=18 posts=27/)).toBeInTheDocument();
    expect(mockListPublicFeed).toHaveBeenCalledWith(supabase, {
      communitySlug: "agents",
      limit: 30,
      mode: "latest",
    });
  });

  it("falls back to the default community and mode when params are missing", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "network_actors") return createCountQuery(1);
        if (table === "social_threads") return createCountQuery(2);
        if (table === "social_posts") return createCountQuery(3);
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mockCreatePublicClient.mockReturnValue(supabase);
    mockListPublicFeed.mockResolvedValue({
      communities: [],
      threads: [],
    });
    mockListCommunityDirectory.mockResolvedValue([]);

    const { default: CommonsPage } = await import("./page");

    render(await CommonsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/Feed view global top actors=1 threads=2 posts=3/)).toBeInTheDocument();
  });
});
