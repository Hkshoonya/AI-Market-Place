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
        deliveryData={null}
        manifest={null}
      />
    );

    expect(screen.getByText("Awaiting Approval")).toBeInTheDocument();
    expect(screen.getByText("Legacy Order")).toBeInTheDocument();
    expect(screen.getByText("Manual Handoff")).toBeInTheDocument();
    expect(screen.getByText("Standard Terms")).toBeInTheDocument();
  });
});
