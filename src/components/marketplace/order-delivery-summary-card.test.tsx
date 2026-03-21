import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderDeliverySummaryCard } from "./order-delivery-summary-card";

describe("OrderDeliverySummaryCard", () => {
  it("renders legacy coordination details with clean readable separators", () => {
    render(
      <OrderDeliverySummaryCard
        status="approved"
        manifest={null}
        deliveryData={{
          handoff_mode: "manual_handoff",
          contact_channel: "seller@example.com",
          next_step: "Review the access checklist",
        }}
      />
    );

    expect(screen.getByText(/seller coordinated/i)).toBeInTheDocument();
    expect(
      screen.getByText("seller@example.com - Review the access checklist")
    ).toBeInTheDocument();
  });
});
