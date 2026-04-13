import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TradingTab } from "./trading-tab";

vi.mock("@/components/charts/trading-chart", () => ({
  TradingChart: ({ modelSlug }: { modelSlug: string }) => <div>{`TradingChart:${modelSlug}`}</div>,
}));

vi.mock("@/lib/models/market-value", () => ({
  buildMarketValueExplanation: () => ({
    formattedValue: "$12.5M",
    confidenceLabel: "High",
    confidenceStars: 4,
    factorLabels: ["Benchmarks", "Pricing"],
    summary: "Strong demand and strong benchmark footprint support this estimate.",
    methodologyPreview: "Based on benchmark breadth, adoption, and pricing evidence.",
    pillars: [
      { label: "Demand", stars: 4, description: "Adoption and downloads remain strong." },
      { label: "Benchmarks", stars: 3, description: "Competitive standing remains solid." },
    ],
  }),
  renderStars: (value: number) => "★".repeat(value),
}));

describe("TradingTab", () => {
  it("renders market-value metrics and thesis details", () => {
    render(
      <TradingTab
        modelSlug="gemma-4-27b"
        popularity_rank={2}
        popularity_score={90}
        adoption_score={82}
        economic_footprint_score={76}
        market_cap_estimate={12500000}
        capability_score={88}
        agent_score={79}
        github_stars={4200}
        benchmark_count={6}
        arena_family_count={2}
        pricing_source_count={3}
      />
    );

    expect(screen.getByText("Market Value & Economic Signals")).toBeInTheDocument();
    expect(screen.getByText("TradingChart:gemma-4-27b")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("82.0")).toBeInTheDocument();
    expect(screen.getByText("76.0")).toBeInTheDocument();
    expect(screen.getByText("$12.5M")).toBeInTheDocument();
    expect(screen.getByText("79.0")).toBeInTheDocument();
    expect(screen.getByText("Market Value Thesis")).toBeInTheDocument();
    expect(screen.getByText("Confidence:")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getAllByText("Benchmarks").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("Strong demand and strong benchmark footprint support this estimate.")).toBeInTheDocument();
    expect(screen.getByText("GitHub Stars: 4,200")).toBeInTheDocument();
  });
});
