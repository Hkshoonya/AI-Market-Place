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
          summary: "Autonomous support workflow bundle",
          runtime: { environment: "node" },
          access: { mode: "download" },
          verification: { source: "skill_manifest" },
          rights: { scope: "buyer_only" },
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
    expect(screen.getByText("Autonomous support workflow bundle")).toBeInTheDocument();
    expect(screen.getByText("node")).toBeInTheDocument();
    expect(screen.getByText("skill_manifest")).toBeInTheDocument();
    expect(screen.getByText("buyer_only")).toBeInTheDocument();
  });

  it("renders a compatibility note when the order predates manifest snapshots", () => {
    render(
      <OrderManifestCard
        manifest={null}
        deliveryData={{
          handoff_mode: "seller_coordinated",
          contact_channel: "seller inbox",
          next_step: "Manual onboarding after approval",
          delivery_window: "within 24 hours",
        }}
      />
    );

    expect(screen.getByText("Legacy Contract Status")).toBeInTheDocument();
    expect(screen.getByText("seller inbox")).toBeInTheDocument();
    expect(screen.getByText("Manual onboarding after approval")).toBeInTheDocument();
    expect(screen.getByText("within 24 hours")).toBeInTheDocument();
  });
});
