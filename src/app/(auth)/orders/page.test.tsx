import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./orders-content", () => ({
  default: () => <div>Orders content shell</div>,
}));

import OrdersPage, { metadata } from "./page";

describe("OrdersPage", () => {
  it("exports order-list metadata", () => {
    expect(metadata).toMatchObject({
      title: "My Orders",
      description: expect.stringContaining("orders"),
    });
  });

  it("renders the orders content wrapper", () => {
    render(<OrdersPage />);

    expect(screen.getByText("Orders content shell")).toBeInTheDocument();
  });
});
