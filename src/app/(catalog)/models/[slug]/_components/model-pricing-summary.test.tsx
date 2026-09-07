import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAccessOffersCatalog } from "@/lib/models/access-offers";
import type { VerifiedPricingEntry } from "@/lib/models/pricing";
import { ModelPricingSummary } from "./model-pricing-summary";

const official: VerifiedPricingEntry = {
  provider_name: "OpenAI",
  input_price_per_million: 1.25,
  output_price_per_million: 10,
  currency: "USD",
  updated_at: "2026-09-07T10:00:00Z",
  source: "official-provider-pricing",
};
const offers = buildAccessOffersCatalog({
  platforms: [{ id: "p1", slug: "example-plan", name: "Example Plan", type: "subscription", base_url: "https://example.com", has_affiliate: false }],
  deployments: [{ id: "d1", model_id: "m1", platform_id: "p1", pricing_model: "monthly", price_per_unit: 19.99, unit_description: "month", free_tier: null, one_click: false }],
  models: [],
}).subscriptionOffers;

function summary(pricingData: VerifiedPricingEntry[], accessAvailable = true) {
  return <ModelPricingSummary slug="example-model" provider="OpenAI" pricingData={pricingData} accessOffers={offers} accessAvailable={accessAvailable} />;
}

describe("ModelPricingSummary", () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date("2026-09-07T12:00:00Z") }));
  afterEach(() => vi.useRealTimers());

  it("shows public input, output, monthly prices and billing units, preferring the official route", () => {
    render(summary([{ ...official, provider_name: "Router", input_price_per_million: 0.5 }, official]));
    expect(screen.getByText("Official provider rates")).toBeInTheDocument();
    expect(screen.getByText("Input / 1M tokens")).toBeInTheDocument();
    expect(screen.getByText("Output / 1M tokens")).toBeInTheDocument();
    expect(screen.getByText("$1.25")).toBeInTheDocument();
    expect(screen.getByText("$10")).toBeInTheDocument();
    expect(screen.getByText("$19.99/mo")).toBeInTheDocument();
    expect(screen.queryByText("$0.5")).not.toBeInTheDocument();
    expect(screen.getByText(/Price record: 2026-09-07/)).toHaveTextContent("official-provider-pricing");
    expect(screen.getByText(/No login needed to compare/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View full pricing details" })).toHaveAttribute("href", "/models/example-model?tab=pricing#model-tabs");
  });

  it("keeps subscriptions visible when no API rates are known", () => {
    render(summary([]));
    expect(screen.getByText(/Missing pricing does not mean free usage/)).toBeInTheDocument();
    expect(screen.getByText("Example Plan")).toBeInTheDocument();
    expect(screen.getByText(/Confirm this specific model, usage limits/)).toBeInTheDocument();
  });

  it("does not advertise purchases when model access is unconfirmed", () => {
    render(summary([official], false));
    expect(screen.getByText(/Live access is not confirmed/)).toBeInTheDocument();
    expect(screen.queryByText("$1.25")).not.toBeInTheDocument();
    expect(screen.queryByText("Example Plan")).not.toBeInTheDocument();
  });

  it("excludes stale and non-USD records from the headline", () => {
    render(summary([{ ...official, updated_at: "2025-01-01" }, { ...official, currency: "EUR" }]));
    expect(screen.getByText(/Current rates are not verified/)).toBeInTheDocument();
    expect(screen.queryByText("$1.25")).not.toBeInTheDocument();
  });

  it("keeps zero prices distinct from unknown output rates and unknown verification dates", () => {
    render(summary([{ ...official, input_price_per_million: 0, output_price_per_million: null, updated_at: null }]));
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText("Not verified")).toBeInTheDocument();
    expect(screen.getByText(/Price verification date unavailable/)).toBeInTheDocument();
  });

  it.each([
    [{ price_per_call: 0.04 }, "Per request", "$0.04"],
    [{ price_per_gpu_second: 0.00025 }, "Per GPU second", "$0.00025"],
    [{ subscription_monthly: 12.5 }, "Per month", "$12.5"],
  ])("preserves non-token billing units for %j", (rates, unit, amount) => {
    render(summary([{ ...official, input_price_per_million: null, output_price_per_million: null, ...rates }]));
    expect(screen.getByText(unit)).toBeInTheDocument();
    expect(screen.getByText(amount)).toBeInTheDocument();
    expect(screen.queryByText("Input / 1M tokens")).not.toBeInTheDocument();
  });
});
