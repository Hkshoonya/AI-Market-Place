import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderDeliverySummaryCard } from "./order-delivery-summary-card";

describe("OrderDeliverySummaryCard", () => {
  it("shows snapshot-backed delivery details for completed orders", () => {
    render(
      <OrderDeliverySummaryCard
        status="completed"
        deliveryData={{ artifact_url: "https://example.com/file.zip" }}
        manifest={{
          fulfillment_type: "api_access",
          access: {
            mode: "hosted_api",
            endpoint: "https://api.example.com/v1",
          },
          support: {
            level: "priority",
          },
          rights: {
            scope: "commercial_use",
          },
        }}
      />
    );

    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("Api Access Contract")).toBeInTheDocument();
    expect(screen.getByText("Hosted Api")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/api\.example\.com\/v1/i)).toBeInTheDocument();
    expect(screen.getByText(/Rights scope: commercial_use/i)).toBeInTheDocument();
  });

  it("falls back to legacy/manual states when no manifest is present", () => {
    render(
      <OrderDeliverySummaryCard
        status="pending"
        deliveryData={{
          handoff_mode: "seller_coordinated",
          contact_channel: "support@agentprotocol.test",
          next_step: "Seller will arrange onboarding through the order thread.",
          support_level: "community",
          rights_scope: "buyer_internal_use",
        }}
        manifest={null}
      />
    );

    expect(screen.getByText("Awaiting Approval")).toBeInTheDocument();
    expect(screen.getByText("Legacy Fulfillment")).toBeInTheDocument();
    expect(screen.getByText("Seller Coordinated")).toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText(/support@agentprotocol\.test/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Seller will arrange onboarding through the order thread/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Rights scope: buyer_internal_use/i)).toBeInTheDocument();
  });
});
