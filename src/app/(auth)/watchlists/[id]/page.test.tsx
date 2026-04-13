import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./watchlist-detail-content", () => ({
  default: () => <div>Watchlist detail content shell</div>,
}));

import WatchlistDetailPage, { metadata } from "./page";

describe("WatchlistDetailPage", () => {
  it("exports watchlist-detail metadata", () => {
    expect(metadata).toMatchObject({
      title: "Watchlist Details",
      description: expect.stringContaining("watchlist"),
    });
  });

  it("renders the watchlist detail content wrapper", () => {
    render(<WatchlistDetailPage />);

    expect(screen.getByText("Watchlist detail content shell")).toBeInTheDocument();
  });
});
