import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./seller-earnings-content", () => ({
  default: () => <div>Seller earnings content shell</div>,
}));

import SellerEarningsPage, { metadata } from "./page";

describe("SellerEarningsPage", () => {
  it("exports seller earnings metadata", () => {
    expect(metadata).toMatchObject({
      title: "Seller Earnings & Payouts",
      description: expect.stringContaining("withdrawals"),
    });
  });

  it("renders the seller earnings content wrapper", () => {
    render(<SellerEarningsPage />);

    expect(screen.getByText("Seller earnings content shell")).toBeInTheDocument();
  });
});
