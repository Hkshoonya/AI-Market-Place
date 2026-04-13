import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModelSignalBadge } from "./model-signal-badge";

vi.mock("@/lib/format", () => ({
  formatRelativeDate: () => "2 days ago",
}));

describe("ModelSignalBadge", () => {
  it("renders the signal label and relative date", () => {
    render(
      <ModelSignalBadge
        signal={{
          signalType: "pricing",
          signalLabel: "Price update",
          title: "Provider cut prices",
          publishedAt: "2026-04-11T00:00:00Z",
        }}
      />
    );

    expect(screen.getByText("Price update")).toBeInTheDocument();
    expect(screen.getByTitle("Provider cut prices")).toBeInTheDocument();
    expect(screen.getByText("2 days ago")).toBeInTheDocument();
  });

  it("omits the date when the signal has no published timestamp", () => {
    render(
      <ModelSignalBadge
        signal={{
          signalType: "api",
          signalLabel: "API access",
          title: "New API path",
          publishedAt: null,
        }}
      />
    );

    expect(screen.getByText("API access")).toBeInTheDocument();
    expect(screen.queryByText("2 days ago")).not.toBeInTheDocument();
  });
});
