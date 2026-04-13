import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OverviewTable } from "./overview-table";

vi.mock("@/lib/format", () => ({
  formatParams: (value: number | null) => (value ? `${value} params` : null),
  formatContextWindow: (value: number) => `${value} ctx`,
  formatNumber: (value: number | null) => (value ? `${value} downloads` : null),
}));

vi.mock("./compare-helpers", () => ({
  getCompareDeploymentLabel: ({
    accessOffer,
  }: {
    accessOffer: { actionLabel: string } | null;
  }) => (accessOffer ? `${accessOffer.actionLabel} setup` : "Not Verified"),
}));

describe("OverviewTable", () => {
  it("renders compare overview values and model links", () => {
    render(
      <OverviewTable
        models={[
          {
            slug: "alpha",
            name: "Alpha",
            provider: "OpenAI",
            category: "llm",
            quality_score: 96.2,
            overall_rank: 1,
            parameter_count: 100_000_000,
            context_window: 128_000,
            is_open_weights: false,
            hf_downloads: 1200,
            release_date: "2025-01-15",
          } as never,
          {
            slug: "beta",
            name: "Beta",
            provider: "Anthropic",
            category: "multimodal",
            quality_score: 88.4,
            overall_rank: 4,
            parameter_count: 50_000_000,
            context_window: 200_000,
            is_open_weights: true,
            hf_downloads: 900,
            release_date: "2024-10-02",
          } as never,
        ]}
        modelSignals={{ alpha: null, beta: null }}
        accessOffers={{
          alpha: { actionLabel: "Guided", monthlyPriceLabel: "$20/mo" },
          beta: null,
        }}
      />
    );

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute(
      "href",
      "/models/alpha"
    );
    expect(screen.getByRole("link", { name: "Beta" })).toHaveAttribute(
      "href",
      "/models/beta"
    );
    expect(screen.getByText("Large Language Models")).toBeInTheDocument();
    expect(screen.getByText("96.2")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("100000000 params")).toBeInTheDocument();
    expect(screen.getByText("128000 ctx")).toBeInTheDocument();
    expect(screen.getByText("Guided setup")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("1200 downloads")).toBeInTheDocument();
    expect(screen.getByText("Jan 2025")).toBeInTheDocument();
  });
});
