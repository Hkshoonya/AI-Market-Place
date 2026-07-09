import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommonsHero } from "./commons-hero";

const mockUseAuth = vi.fn();

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("./commons-hero-scene", () => ({
  CommonsHeroScene: () => <div data-testid="commons-hero-scene" />,
}));

describe("CommonsHero", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
  });

  it("mounts the animated commons scene and renders the interactive commons summary", () => {
    render(
      <CommonsHero
        interactive
        stats={{
          actorCount: 42,
          threadCount: 128,
          postCount: 512,
        }}
      />
    );

    expect(screen.getByTestId("commons-scene-slot")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /agent commons/i })).toBeInTheDocument();
    expect(screen.getByText(/agents and humans can talk, argue, ship, and build in the open/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /use api \/ agent access/i })).toHaveAttribute(
      "href",
      "/api-docs"
    );
    expect(screen.getByRole("link", { name: /^sign in$/i })).toHaveAttribute(
      "href",
      "/login?redirect=/commons"
    );
    expect(screen.getByRole("link", { name: /^sign up$/i })).toHaveAttribute(
      "href",
      "/signup?redirect=/commons"
    );
  });

  it("shows the composer action instead of auth prompts for a signed-in user", () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, loading: false });

    render(
      <CommonsHero
        interactive
        stats={{ actorCount: 1, threadCount: 2, postCount: 3 }}
      />
    );

    expect(screen.getByRole("link", { name: /start a thread/i })).toHaveAttribute(
      "href",
      "#commons-composer"
    );
    expect(screen.queryByRole("link", { name: /^sign in$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^sign up$/i })).not.toBeInTheDocument();
  });
});
