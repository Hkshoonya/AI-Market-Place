import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNotFound = vi.fn();
const mockCreatePublicClient = vi.fn();
const mockGetPublicActorByHandle = vi.fn();
const mockGetPublicActorStats = vi.fn();
const mockListPublicActorThreads = vi.fn();

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    notFound: (...args: unknown[]) => mockNotFound(...args),
  };
});

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: () => mockCreatePublicClient(),
}));

vi.mock("@/lib/social/actors", () => ({
  getPublicActorByHandle: (...args: unknown[]) => mockGetPublicActorByHandle(...args),
  getPublicActorStats: (...args: unknown[]) => mockGetPublicActorStats(...args),
}));

vi.mock("@/lib/social/feed", () => ({
  listPublicActorThreads: (...args: unknown[]) => mockListPublicActorThreads(...args),
}));

vi.mock("@/components/social/social-actor-wall-view", () => ({
  SocialActorWallView: ({
    actor,
    stats,
    threads,
  }: {
    actor: { display_name: string; handle: string };
    stats: { threadCount: number };
    threads: Array<{ id: string }>;
  }) => (
    <div>
      Actor wall {actor.display_name} @{actor.handle} threads={threads.length} stat=
      {stats.threadCount}
    </div>
  ),
}));

describe("CommonsActorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("builds actor metadata when the handle resolves", async () => {
    const supabase = { kind: "public-client" };
    mockCreatePublicClient.mockReturnValue(supabase);
    mockGetPublicActorByHandle.mockResolvedValue({
      id: "actor-1",
      handle: "operator",
      display_name: "Operator",
      bio: "Public operator working with autonomous systems.",
    });

    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        params: Promise.resolve({ handle: "operator" }),
      })
    ).resolves.toMatchObject({
      title: expect.stringContaining("Operator (@operator)"),
      description: expect.stringContaining("Public operator"),
      alternates: {
        canonical: expect.stringContaining("/commons/actors/operator"),
      },
    });
  });

  it("returns not-found metadata when the actor handle is missing", async () => {
    mockCreatePublicClient.mockReturnValue({ kind: "public-client" });
    mockGetPublicActorByHandle.mockResolvedValue(null);

    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        params: Promise.resolve({ handle: "missing" }),
      })
    ).resolves.toMatchObject({
      title: expect.stringContaining("Identity not found"),
    });
  });

  it("renders the actor wall view with stats and threads", async () => {
    const supabase = { kind: "public-client" };
    mockCreatePublicClient.mockReturnValue(supabase);
    mockGetPublicActorByHandle.mockResolvedValue({
      id: "actor-1",
      handle: "operator",
      display_name: "Operator",
      bio: null,
    });
    mockGetPublicActorStats.mockResolvedValue({ threadCount: 4 });
    mockListPublicActorThreads.mockResolvedValue([{ id: "thread-1" }, { id: "thread-2" }]);

    const { default: CommonsActorPage } = await import("./page");
    render(
      await CommonsActorPage({
        params: Promise.resolve({ handle: "operator" }),
      })
    );

    expect(screen.getByText("Actor wall Operator @operator threads=2 stat=4")).toBeInTheDocument();
  });

  it("calls notFound when the actor handle is invalid", async () => {
    mockCreatePublicClient.mockReturnValue({ kind: "public-client" });
    mockGetPublicActorByHandle.mockResolvedValue(null);

    const { default: CommonsActorPage } = await import("./page");

    await expect(
      CommonsActorPage({
        params: Promise.resolve({ handle: "missing" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });
});
