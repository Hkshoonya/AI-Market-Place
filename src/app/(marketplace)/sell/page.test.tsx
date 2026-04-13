import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./sell-content", () => ({
  default: () => <div>Sell content shell</div>,
}));

import SellPage, { metadata } from "./page";

describe("SellPage", () => {
  it("exports sell-page metadata", () => {
    expect(metadata).toMatchObject({
      title: "Sell on AI Market Cap",
      description: expect.stringContaining("listing"),
      openGraph: {
        title: "Sell on AI Market Cap",
      },
      alternates: {
        canonical: expect.stringContaining("/sell"),
      },
    });
  });

  it("renders the sell content wrapper", () => {
    render(<SellPage />);

    expect(screen.getByText("Sell content shell")).toBeInTheDocument();
  });
});
