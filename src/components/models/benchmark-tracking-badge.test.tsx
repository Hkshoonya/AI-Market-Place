import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BenchmarkTrackingBadge } from "./benchmark-tracking-badge";

describe("BenchmarkTrackingBadge", () => {
  it("renders the supplied benchmark summary label and title", () => {
    render(
      <BenchmarkTrackingBadge
        summary={{
          status: "structured",
          badgeLabel: "Benchmark-backed",
          summary: "Structured benchmark coverage is available.",
        }}
      />
    );

    expect(screen.getByText("Benchmark-backed")).toBeInTheDocument();
    expect(screen.getByTitle("Structured benchmark coverage is available.")).toBeInTheDocument();
  });

  it("returns nothing when no summary is present", () => {
    const { container } = render(<BenchmarkTrackingBadge summary={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
