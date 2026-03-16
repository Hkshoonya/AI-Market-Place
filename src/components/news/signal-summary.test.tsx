import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SignalSummary } from "./signal-summary";

describe("SignalSummary", () => {
  it("renders counts and importance badges", () => {
    render(
      <SignalSummary
        buckets={[
          { type: "launch", label: "Launches", count: 4, importance: "high" },
          { type: "api", label: "API", count: 2, importance: "medium" },
        ]}
      />
    );

    expect(screen.getByText("Launches")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("API")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
