import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ManifestPreviewCard } from "./manifest-preview-card";

describe("ManifestPreviewCard", () => {
  it("renders the public fulfillment preview", () => {
    render(
      <ManifestPreviewCard
        manifest={{
          schema_version: "1.0",
          fulfillment_type: "agent_package",
          title: "Agent Protocol Kit",
          summary: "Autonomous workflow package",
          capabilities: ["automation", "orchestration"],
          pricing_model: {
            model: "one_time",
            price: 49,
            currency: "USD",
          },
          runtime: {
            environment: "node",
          },
        }}
      />
    );

    expect(screen.getByText("Fulfillment Preview")).toBeInTheDocument();
    expect(screen.getByText("Autonomous workflow package")).toBeInTheDocument();
    expect(screen.getByText("automation")).toBeInTheDocument();
    expect(screen.getByText("node")).toBeInTheDocument();
  });
});
