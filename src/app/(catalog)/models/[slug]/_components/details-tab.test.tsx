import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailsTab } from "./details-tab";

describe("DetailsTab", () => {
  it("renders model basics, access flags, and capability badges", () => {
    const expectedDate = new Date("2026-03-01T00:00:00.000Z").toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    render(
      <DetailsTab
        architecture="Transformer"
        parameter_label="70B"
        context_window={200000}
        release_date="2026-03-01T00:00:00.000Z"
        status="active_support"
        license_name="Apache 2.0"
        license={null}
        is_open_weights
        is_api_available
        modalities={["text", "image"]}
        capabilities={{ tool_use: true, reasoning: true, vision: false }}
      />
    );

    expect(screen.getByText("At a Glance")).toBeInTheDocument();
    expect(screen.getByText("Transformer")).toBeInTheDocument();
    expect(screen.getByText("70B")).toBeInTheDocument();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
    expect(screen.getByText("active support")).toBeInTheDocument();
    expect(screen.getByText("Access and License")).toBeInTheDocument();
    expect(screen.getByText("Apache 2.0")).toBeInTheDocument();
    expect(screen.getAllByText("Yes")).toHaveLength(2);
    expect(screen.getByText("text, image")).toBeInTheDocument();
    expect(screen.getByText("tool use")).toBeInTheDocument();
    expect(screen.getByText("reasoning")).toBeInTheDocument();
  });
});
