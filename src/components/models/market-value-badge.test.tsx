import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketValueBadge } from "./market-value-badge";

describe("MarketValueBadge", () => {
  it("shows a dollar estimate and expands into methodology details", () => {
    render(
      <MarketValueBadge
        marketCapEstimate={12_400_000}
        popularityScore={82}
        adoptionScore={78}
        economicFootprintScore={80}
        capabilityScore={76}
        agentScore={72}
        benchmarkCount={5}
        arenaFamilyCount={2}
        pricingSourceCount={2}
      />
    );

    expect(screen.getByRole("button", { name: /estimated market value/i })).toHaveTextContent(
      "$12M"
    );

    fireEvent.click(screen.getByRole("button", { name: /estimated market value/i }));

    expect(screen.getByText("Estimated Market Value")).toBeInTheDocument();
    expect(screen.getByText(/Confidence:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/without exposing the internal formula/i).length).toBeGreaterThan(0);
  });
});
