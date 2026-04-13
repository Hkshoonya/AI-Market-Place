import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./auctions-browse-content", () => ({
  default: () => <div>Auctions browse content shell</div>,
}));

import AuctionsPage, { metadata } from "./page";

describe("AuctionsPage", () => {
  it("exports auctions metadata", () => {
    expect(metadata).toMatchObject({
      title: "Auctions",
      description: expect.stringContaining("bid"),
      openGraph: {
        title: "Auctions | AI Market Cap",
      },
      alternates: {
        canonical: expect.stringContaining("/marketplace/auctions"),
      },
    });
  });

  it("renders the auctions content wrapper inside the page shell", () => {
    render(<AuctionsPage />);

    expect(screen.getByText("Auctions browse content shell")).toBeInTheDocument();
  });
});
