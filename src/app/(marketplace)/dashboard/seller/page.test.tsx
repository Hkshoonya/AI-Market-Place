import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./seller-dashboard-content", () => ({
  default: () => <div>Seller dashboard content shell</div>,
}));

import SellerDashboardPage, { metadata } from "./page";

describe("SellerDashboardPage", () => {
  it("exports seller dashboard metadata", () => {
    expect(metadata).toMatchObject({
      title: "Seller Dashboard",
      description: expect.stringContaining("seller verification"),
    });
  });

  it("renders the seller dashboard content wrapper", () => {
    render(<SellerDashboardPage />);

    expect(screen.getByText("Seller dashboard content shell")).toBeInTheDocument();
  });
});
