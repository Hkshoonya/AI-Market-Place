import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PricingTab } from "./pricing-tab";

vi.mock("@/components/charts/price-comparison", () => ({
  PriceComparison: ({ models }: { models: Array<{ name: string }> }) => (
    <div>{`PriceComparison:${models.length}`}</div>
  ),
}));

vi.mock("@/lib/format", () => ({
  formatTokenPrice: (value: number) => `$${value.toFixed(2)}`,
}));

vi.mock("@/lib/models/pricing", () => ({
  formatVerifiedPricingEntry: (entry: { input_price_per_million: number | null }) =>
    entry.input_price_per_million != null ? `$${entry.input_price_per_million.toFixed(2)} / 1M` : null,
  getCheapestVerifiedPricing: ({ model_pricing }: { model_pricing: Array<Record<string, unknown>> }) => model_pricing[1],
  getOfficialPricing: ({ model_pricing }: { model_pricing: Array<Record<string, unknown>> }) => model_pricing[0],
  getPricingAgeDays: () => 12,
  getPrimaryPricingSignal: (entry: { input_price_per_million: number | null }) => ({ amount: entry.input_price_per_million }),
  getStaleTrackedPricingEntries: ({ model_pricing }: { model_pricing: Array<Record<string, unknown>> }) => [model_pricing[1]],
  getTrackedPricingEntries: ({ model_pricing }: { model_pricing: Array<Record<string, unknown>> }) => model_pricing,
  isFreshVerifiedPricingEntry: (entry: { provider_name: string }) => entry.provider_name === "OpenAI",
  isOfficialPricingProvider: (_modelProvider: string, providerName: string) => providerName === "OpenAI",
}));

describe("PricingTab", () => {
  it("renders pricing summaries, access offers, and the tracked table", () => {
    render(
      <PricingTab
        modelProvider="OpenAI"
        pricingData={[
          {
            provider_name: "OpenAI",
            input_price_per_million: 5,
            output_price_per_million: 15,
            median_output_tokens_per_second: 42,
            median_time_to_first_token: 0.5,
            source: "official",
          },
          {
            provider_name: "RouterX",
            input_price_per_million: 3,
            output_price_per_million: 9,
            median_output_tokens_per_second: 30,
            median_time_to_first_token: 0.8,
            source: "router",
          },
        ]}
        accessOffers={[
          {
            platform: { id: "offer-1", name: "OpenAI Console" },
            bestFor: "Direct provider access",
            label: "Official",
            monthlyPriceLabel: "$20/mo",
            actionLabel: "Open provider",
            userValueScore: 91,
            trustScore: 98,
            actionUrl: "https://example.com/provider",
            partnerDisclosure: null,
          } as never,
        ]}
      />
    );

    expect(screen.getByText("Pricing and Ways to Use It")).toBeInTheDocument();
    expect(screen.getByText("Cheapest Trusted Option")).toBeInTheDocument();
    expect(screen.getByText("RouterX · $3.00 / 1M")).toBeInTheDocument();
    expect(screen.getByText("Official Provider Price")).toBeInTheDocument();
    expect(screen.getByText("OpenAI · $5.00 / 1M")).toBeInTheDocument();
    expect(screen.getByText("Fresh Price Checks")).toBeInTheDocument();
    expect(screen.getByText("PriceComparison:2")).toBeInTheDocument();
    expect(screen.getByText("OpenAI Console")).toBeInTheDocument();
    expect(screen.getByText("Open provider · Value 91 · Trust 98")).toBeInTheDocument();
    expect(
      screen.getByText(/1 tracked price need refresh\./i, {
        selector: "div",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Best priced")).toBeInTheDocument();
    expect(screen.getAllByText("Official")).toHaveLength(2);
    expect(screen.getByText("Direct")).toBeInTheDocument();
    expect(screen.getByText("Broker / Router")).toBeInTheDocument();
    expect(screen.getByText("Source: router · 12d old")).toBeInTheDocument();
  });

  it("renders the empty state when no pricing data is available", () => {
    render(<PricingTab modelProvider="OpenAI" pricingData={[]} accessOffers={[]} />);

    expect(screen.getByText("No pricing data available yet.")).toBeInTheDocument();
  });
});
