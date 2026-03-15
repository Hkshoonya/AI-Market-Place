import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrderManifestCard } from "./order-manifest-card";

describe("OrderManifestCard", () => {
  it("renders the purchased fulfillment contract", () => {
    render(
      <OrderManifestCard
        manifest={{
          schema_version: "1.0",
          listing_slug: "agent-protocol-kit",
          fulfillment_type: "agent_package",
          purchased_at: "2026-03-14T12:00:00Z",
          pricing_model: {
            model: "one_time",
            price: 49,
            currency: "USD",
          },
          capabilities: ["automation"],
        }}
      />
    );

    expect(screen.getByText("Purchased Contract")).toBeInTheDocument();
    expect(screen.getByText("agent-protocol-kit")).toBeInTheDocument();
    expect(screen.getByText("automation")).toBeInTheDocument();
  });

  it("renders a compatibility note when the order predates manifest snapshots", () => {
    render(<OrderManifestCard manifest={null} />);

    expect(
      screen.getByText(/This order was completed before manifest snapshots were enabled/i)
    ).toBeInTheDocument();
  });
});
