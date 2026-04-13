import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PricingTable } from "./pricing-table";

vi.mock("./compare-helpers", () => ({
  getCheapestPrice: (model: { slug: string }) =>
    model.slug === "alpha" ? 2.5 : 4,
  getCompareAccessLabel: (accessOffer: { actionLabel: string; monthlyPriceLabel: string } | null) =>
    accessOffer ? `${accessOffer.actionLabel} · ${accessOffer.monthlyPriceLabel}` : null,
  getSpeed: (model: { slug: string }) => (model.slug === "alpha" ? 120 : 85),
}));

describe("PricingTable", () => {
  it("renders price, speed, access, and free tier comparisons", () => {
    render(
      <PricingTable
        models={[
          {
            slug: "alpha",
            name: "Alpha",
            model_pricing: [
              {
                output_price_per_million: 5,
                is_free_tier: true,
              },
            ],
          } as never,
          {
            slug: "beta",
            name: "Beta",
            model_pricing: [
              {
                output_price_per_million: 8,
                is_free_tier: false,
              },
            ],
          } as never,
        ]}
        accessOffers={{
          alpha: { actionLabel: "Guided setup", monthlyPriceLabel: "$20/mo" },
          beta: null,
        }}
      />
    );

    expect(screen.getByText("Pricing & Speed")).toBeInTheDocument();
    expect(screen.getByText("Input $/M tokens")).toBeInTheDocument();
    expect(screen.getByText("$2.50")).toBeInTheDocument();
    expect(screen.getByText("$4.00")).toBeInTheDocument();
    expect(screen.getByText("$5.00")).toBeInTheDocument();
    expect(screen.getByText("$8.00")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("Guided setup · $20/mo")).toBeInTheDocument();
    expect(screen.getAllByText("Yes")).toHaveLength(1);
    expect(screen.getAllByText("No")).not.toHaveLength(0);
  });
});
