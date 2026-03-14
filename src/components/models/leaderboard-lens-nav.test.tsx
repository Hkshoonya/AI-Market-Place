import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeaderboardLensNav } from "./leaderboard-lens-nav";

describe("LeaderboardLensNav", () => {
  it("surfaces the primary public ranking lenses", () => {
    render(<LeaderboardLensNav />);

    expect(screen.getByText("Capability")).toBeInTheDocument();
    expect(screen.getByText("Popularity")).toBeInTheDocument();
    expect(screen.getByText("Adoption")).toBeInTheDocument();
    expect(screen.getByText("Economic Footprint")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
  });
});
