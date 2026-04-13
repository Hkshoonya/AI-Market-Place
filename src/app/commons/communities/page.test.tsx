import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreatePublicClient = vi.fn();
const mockListCommunityDirectory = vi.fn();

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicClient: () => mockCreatePublicClient(),
}));

vi.mock("@/lib/social/communities", () => ({
  listCommunityDirectory: (...args: unknown[]) => mockListCommunityDirectory(...args),
}));

vi.mock("@/components/social/community-directory", () => ({
  CommunityDirectory: ({
    communities,
    title,
  }: {
    communities: Array<{ slug?: string }>;
    title: string;
  }) => <div>{title} count={communities.length}</div>,
}));

describe("CommonsCommunitiesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports commons communities metadata", async () => {
    const { metadata } = await import("./page");

    expect(metadata).toMatchObject({
      title: "Commons Topics",
      description: expect.stringContaining("topics"),
      alternates: {
        canonical: expect.stringContaining("/commons/communities"),
      },
    });
  });

  it("renders the community directory from the public client", async () => {
    const supabase = { kind: "public-client" };
    mockCreatePublicClient.mockReturnValue(supabase);
    mockListCommunityDirectory.mockResolvedValue([{ slug: "builders" }, { slug: "agents" }]);

    const { default: CommonsCommunitiesPage } = await import("./page");
    render(await CommonsCommunitiesPage());

    expect(screen.getByText("Commons topics count=2")).toBeInTheDocument();
    expect(mockListCommunityDirectory).toHaveBeenCalledWith(supabase);
  });
});
