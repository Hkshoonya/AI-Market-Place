import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QualityDistribution } from "./quality-distribution";

describe("QualityDistribution", () => {
  it("renders custom metric labels for updated leaderboard lenses", () => {
    render(
      <QualityDistribution
        data={[{ name: "o3", quality: 69.6, provider: "OpenAI" }]}
        title="Economic Footprint Distribution"
        metricLabel="Economic Footprint"
      />
    );

    expect(screen.getByText("Economic Footprint Distribution")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Economic Footprint distribution bar chart/i)
    ).toBeInTheDocument();
  });
});
