import { render, screen } from "@testing-library/react";
import { Cpu, DollarSign } from "lucide-react";
import { describe, expect, it } from "vitest";

import { ModelStatsRow } from "./model-stats-row";

describe("ModelStatsRow", () => {
  it("renders all stat cards with labels and values", () => {
    render(
      <ModelStatsRow
        stats={[
          { label: "Parameters", value: "70B", icon: Cpu },
          { label: "Price", value: "$0.40 / 1M", icon: DollarSign },
        ]}
      />
    );

    expect(screen.getByText("70B")).toBeInTheDocument();
    expect(screen.getByText("Parameters")).toBeInTheDocument();
    expect(screen.getByText("$0.40 / 1M")).toBeInTheDocument();
    expect(screen.getByText("Price")).toBeInTheDocument();
  });
});
