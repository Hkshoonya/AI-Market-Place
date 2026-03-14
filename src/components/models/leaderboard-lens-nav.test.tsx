import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeaderboardLensNav } from "./leaderboard-lens-nav";

describe("LeaderboardLensNav", () => {
  it("surfaces the primary public ranking lenses", () => {
    render(
      <LeaderboardLensNav
        activeLens="capability"
        lifecycle="active"
        buildHref={(lens) => `/leaderboards?lens=${lens}&lifecycle=active`}
      />
    );

    expect(screen.getByText("Capability")).toBeInTheDocument();
    expect(screen.getByText("Popularity")).toBeInTheDocument();
    expect(screen.getByText("Adoption")).toBeInTheDocument();
    expect(screen.getByText("Economic Footprint")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
  });

  it("renders lens cards as navigable controls with active state", () => {
    render(
      <LeaderboardLensNav
        activeLens="popularity"
        lifecycle="all"
        buildHref={(lens) => `/leaderboards?lens=${lens}&lifecycle=all`}
      />
    );

    const popularity = screen.getByRole("link", { name: /Popularity/i });
    expect(popularity).toHaveAttribute("href", "/leaderboards?lens=popularity&lifecycle=all");
    expect(popularity.getAttribute("data-active")).toBe("true");
  });
});
