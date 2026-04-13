import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNotFound = vi.fn();
const mockCreatePublicClient = vi.fn();
const mockGetPublicThreadDetail = vi.fn();

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

vi.mock("@/lib/social/feed", () => ({
  getPublicThreadDetail: (...args: unknown[]) => mockGetPublicThreadDetail(...args),
}));

vi.mock("@/components/social/social-thread-detail-view", () => ({
  SocialThreadDetailView: ({
    thread,
  }: {
    thread: { thread: { id: string; title: string | null } };
  }) => <div>Thread detail {thread.thread.id}</div>,
}));

describe("CommonsThreadPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("builds metadata from the thread detail", async () => {
    mockCreatePublicClient.mockReturnValue({ kind: "public-client" });
    mockGetPublicThreadDetail.mockResolvedValue({
      thread: { id: "thread-1", title: "Agent planning thread" },
      rootPost: {
        content: "Root content for the thread.",
        status: "published",
      },
    });

    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        params: Promise.resolve({ id: "thread-1" }),
      })
    ).resolves.toMatchObject({
      title: expect.stringContaining("Agent planning thread"),
      description: expect.stringContaining("Root content"),
      alternates: {
        canonical: expect.stringContaining("/commons/threads/thread-1"),
      },
    });
  });

  it("returns not-found metadata when the thread is missing", async () => {
    mockCreatePublicClient.mockReturnValue({ kind: "public-client" });
    mockGetPublicThreadDetail.mockResolvedValue(null);

    const { generateMetadata } = await import("./page");

    await expect(
      generateMetadata({
        params: Promise.resolve({ id: "missing" }),
      })
    ).resolves.toMatchObject({
      title: expect.stringContaining("Thread not found"),
    });
  });

  it("renders the thread detail view for a valid thread", async () => {
    mockCreatePublicClient.mockReturnValue({ kind: "public-client" });
    mockGetPublicThreadDetail.mockResolvedValue({
      thread: { id: "thread-2", title: null },
      rootPost: {
        content: "Root content for another thread.",
        status: "published",
      },
    });

    const { default: CommonsThreadPage } = await import("./page");
    render(
      await CommonsThreadPage({
        params: Promise.resolve({ id: "thread-2" }),
      })
    );

    expect(screen.getByText("Thread detail thread-2")).toBeInTheDocument();
  });

  it("calls notFound when the thread is invalid", async () => {
    mockCreatePublicClient.mockReturnValue({ kind: "public-client" });
    mockGetPublicThreadDetail.mockResolvedValue(null);

    const { default: CommonsThreadPage } = await import("./page");

    await expect(
      CommonsThreadPage({
        params: Promise.resolve({ id: "missing" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
