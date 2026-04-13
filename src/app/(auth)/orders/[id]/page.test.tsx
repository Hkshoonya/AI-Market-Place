import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./order-detail-content", () => ({
  default: ({
    params,
  }: {
    params: Promise<{ id: string }>;
  }) => <div>Order detail shell {String(params instanceof Promise)}</div>,
}));

import OrderDetailPage, { metadata } from "./page";

describe("OrderDetailPage", () => {
  it("exports order-detail metadata", () => {
    expect(metadata).toMatchObject({
      title: "Order Details",
      description: expect.stringContaining("order details"),
    });
  });

  it("passes params through to the order detail content", () => {
    render(<OrderDetailPage params={Promise.resolve({ id: "order-123" })} />);

    expect(screen.getByText("Order detail shell true")).toBeInTheDocument();
  });
});
