import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNotFound = vi.fn();
const mockRedirect = vi.fn();
const mockCreatePublicClient = vi.fn();
const mockGetCommunityBySlug = vi.fn();
const mockGetCommunityStats = vi.fn();
const mockListCommunityDirectory = vi.fn();
const mockListPublicFeed = vi.fn();

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    notFound: (...args: unknown[]) => mockNotFound(...args),
    redirect: (...args: unknown[]) => mockRedirect(...args),
  };
});

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: () => mockCreatePublicClient(),
}));

vi.mock("@/lib/social/communities", () => ({
  getCommunityBySlug: (...args: unknown[]) => mockGetCommunityBySlug(...args),
  getCommunityStats: (...args: unknown[]) => mockGetCommunityStats(...args),
  listCommunityDirectory: (...args: unknown[]) => mockListCommunityDirectory(...args),
}));

vi.mock("@/lib/social/feed", () => ({
  listPublicFeed: (...args: unknown[]) => mockListPublicFeed(...args),
}));

vi.mock("@/components/social/social-feed-view", () => ({
  SocialFeedView: ({
    selectedCommunity,
    selectedMode,
    stats,
  }: {
    selectedCommunity: string;
    selectedMode: string;
    stats: { threadCount: number; postCount: number; actorCount: number };
  }) => (
    <div>
      Community feed {selectedCommunity} {selectedMode} actors={stats.actorCount} threads=
      {stats.threadCount} posts={stats.postCount}
    </div>
  ),
}));

describe("CommonsCommunityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    mockRedirect.mockImplementation((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    });
  });

  it("builds global metadata for the global slug", async () => {
    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: "global" }),
      })
    ).resolves.toMatchObject({
      title: expect.stringContaining("Agent Commons"),
      alternates: {
        canonical: expect.stringContaining("/commons"),
      },
    });
  });

  it("builds community metadata when the slug resolves", async () => {
    mockCreatePublicClient.mockReturnValue({ kind: "public-client" });
    mockGetCommunityBySlug.mockResolvedValue({
      id: "community-1",
      slug: "builders",
      name: "Builders",
      description: "Public topic feed for builders.",
    });

    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: "builders" }),
      })
    ).resolves.toMatchObject({
      title: expect.stringContaining("Builders | Agent Commons"),
      description: expect.stringContaining("builders"),
      alternates: {
        canonical: expect.stringContaining("/commons/communities/builders"),
      },
    });
  });

  it("renders the social feed view for a valid community", async () => {
    const supabase = { kind: "public-client" };
    mockCreatePublicClient.mockReturnValue(supabase);
    mockGetCommunityBySlug.mockResolvedValue({
      id: "community-1",
      slug: "builders",
      name: "Builders",
      description: null,
    });
    mockListPublicFeed.mockResolvedValue({
      communities: [],
      threads: [{ id: "thread-1" }],
    });
    mockListCommunityDirectory.mockResolvedValue([{ slug: "builders" }]);
    mockGetCommunityStats.mockResolvedValue({
      actorCount: 5,
      threadCount: 9,
      postCount: 14,
    });

    const { default: CommonsCommunityPage } = await import("./page");
    render(
      await CommonsCommunityPage({
        params: Promise.resolve({ slug: "builders" }),
        searchParams: Promise.resolve({ mode: "trusted" }),
      })
    );

    expect(
      screen.getByText("Community feed builders trusted actors=5 threads=9 posts=14")
    ).toBeInTheDocument();
  });

  it("redirects the global slug back to /commons", async () => {
    const { default: CommonsCommunityPage } = await import("./page");

    await expect(
      CommonsCommunityPage({
        params: Promise.resolve({ slug: "global" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/commons");
  });

  it("calls notFound when the community slug is invalid", async () => {
    mockCreatePublicClient.mockReturnValue({ kind: "public-client" });
    mockGetCommunityBySlug.mockResolvedValue(null);

    const { default: CommonsCommunityPage } = await import("./page");

    await expect(
      CommonsCommunityPage({
        params: Promise.resolve({ slug: "missing" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
