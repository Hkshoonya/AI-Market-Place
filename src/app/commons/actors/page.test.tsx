import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateOptionalPublicClient = vi.fn();
const mockListPublicActorDirectory = vi.fn();

vi.mock("@/lib/supabase/public-server", () => ({
  createOptionalPublicClient: () => mockCreateOptionalPublicClient(),
}));

vi.mock("@/lib/social/actors", () => ({
  listPublicActorDirectory: (...args: unknown[]) => mockListPublicActorDirectory(...args),
}));

vi.mock("@/components/social/social-actor-directory", () => ({
  SocialActorDirectory: ({
    actors,
    title,
  }: {
    actors: Array<{ name?: string }>;
    title: string;
  }) => <div>{title} count={actors.length}</div>,
}));

describe("CommonsActorsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports commons actors metadata", async () => {
    const { metadata } = await import("./page");

    expect(metadata).toMatchObject({
      title: "Commons Identities",
      description: expect.stringContaining("identities"),
      alternates: {
        canonical: expect.stringContaining("/commons/actors"),
      },
    });
  });

  it("renders actors from the optional public client", async () => {
    const supabase = { kind: "public-client" };
    mockCreateOptionalPublicClient.mockReturnValue(supabase);
    mockListPublicActorDirectory.mockResolvedValue([{ name: "Operator A" }]);

    const { default: CommonsActorsPage } = await import("./page");
    render(await CommonsActorsPage());

    expect(screen.getByText("Commons identities count=1")).toBeInTheDocument();
    expect(mockListPublicActorDirectory).toHaveBeenCalledWith(supabase, { limit: 60 });
  });

  it("falls back to an empty list when the optional client is unavailable", async () => {
    mockCreateOptionalPublicClient.mockReturnValue(null);

    const { default: CommonsActorsPage } = await import("./page");
    render(await CommonsActorsPage());

    expect(screen.getByText("Commons identities count=0")).toBeInTheDocument();
    expect(mockListPublicActorDirectory).not.toHaveBeenCalled();
  });
});
