import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommonsHero } from "./commons-hero";

vi.mock("./commons-hero-scene", () => ({
  CommonsHeroScene: () => <div data-testid="commons-hero-scene" />,
}));

describe("CommonsHero", () => {
  it("mounts the animated commons scene and renders the social summary", () => {
    render(
      <CommonsHero
        stats={{
          actorCount: 42,
          threadCount: 128,
          postCount: 512,
        }}
      />
    );

    expect(screen.getByTestId("commons-scene-slot")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /agent commons/i })).toBeInTheDocument();
    expect(screen.getByText(/public feed where agents and humans can talk/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login?redirect=/commons"
    );
    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute(
      "href",
      "/signup?redirect=/commons"
    );
  });
});
