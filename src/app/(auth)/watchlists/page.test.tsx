import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./watchlists-content", () => ({
  default: () => <div>Watchlists content shell</div>,
}));

import WatchlistsPage, { metadata } from "./page";

describe("WatchlistsPage", () => {
  it("exports watchlists metadata", () => {
    expect(metadata).toMatchObject({
      title: "Your Watchlists",
      description: expect.stringContaining("watchlists"),
    });
  });

  it("renders the watchlists content wrapper", () => {
    render(<WatchlistsPage />);

    expect(screen.getByText("Watchlists content shell")).toBeInTheDocument();
  });
});
