import { describe, expect, it } from "vitest";
import {
  compareModelsByLowestPrice,
  getCheapestVerifiedPricing,
  getPricingAgeDays,
  getLowestInputPrice,
  getOfficialPricing,
  getPublicPricingSummary,
  getStaleTrackedPricingEntries,
  isOfficialPricingProvider,
  isFreshVerifiedPricingEntry,
  VERIFIED_PRICING_MAX_AGE_DAYS,
  type PriceSortableModel,
} from "./pricing";

function makeModel(overrides: Partial<PriceSortableModel>): PriceSortableModel {
  return {
    id: overrides.id ?? "model-id",
    name: overrides.name ?? "Model",
    slug: overrides.slug ?? "model",
    overall_rank: overrides.overall_rank ?? null,
    is_open_weights: overrides.is_open_weights ?? false,
    model_pricing: overrides.model_pricing ?? [],
    provider: overrides.provider ?? "OpenAI",
  };
}

describe("getLowestInputPrice", () => {
  it("prefers the cheapest verified route on compact public surfaces", () => {
    const model = makeModel({
      provider: "OpenAI",
      model_pricing: [
        { provider_name: "OpenRouter", input_price_per_million: 1.8 },
        { provider_name: "OpenAI", input_price_per_million: 2.5 },
        { provider_name: "Provider C", input_price_per_million: 9 },
      ],
    });

    expect(getLowestInputPrice(model)).toBe(1.8);
  });

  it("treats open-weight models with no API pricing as free", () => {
    const model = makeModel({
      is_open_weights: true,
      model_pricing: [],
    });

    expect(getLowestInputPrice(model)).toBe(0);
  });

  it("returns null when no price signal exists", () => {
    const model = makeModel({
      is_open_weights: false,
      model_pricing: [],
    });

    expect(getLowestInputPrice(model)).toBeNull();
  });
});

describe("compareModelsByLowestPrice", () => {
  it("sorts cheaper models first and leaves unknown pricing last", () => {
    const models = [
      makeModel({
        name: "Unknown",
        slug: "unknown",
        overall_rank: 3,
      }),
      makeModel({
        name: "Paid",
        slug: "paid",
        overall_rank: 2,
        model_pricing: [{ input_price_per_million: 2.5 }],
      }),
      makeModel({
        name: "Free",
        slug: "free",
        overall_rank: 1,
        is_open_weights: true,
      }),
    ];

    const sorted = [...models].sort(compareModelsByLowestPrice);

    expect(sorted.map((model) => model.slug)).toEqual([
      "free",
      "paid",
      "unknown",
    ]);
  });
});

describe("pricing summaries", () => {
  it("does not treat routed third-party providers as official first-party pricing", () => {
    expect(isOfficialPricingProvider("OpenAI", "Azure OpenAI")).toBe(false);
  });

  it("still exposes the cheapest verified route separately", () => {
    const model = makeModel({
      provider: "OpenAI",
      model_pricing: [
        {
          provider_name: "OpenAI",
          input_price_per_million: 3,
          source: "OpenAI Pricing",
          effective_date: "2026-03-10",
        },
        {
          provider_name: "OpenRouter",
          input_price_per_million: 2,
          source: "openrouter",
          effective_date: "2026-03-10",
        },
      ],
    });

    expect(getCheapestVerifiedPricing(model)?.provider_name).toBe("OpenRouter");
    expect(getLowestInputPrice(model)).toBe(2);
  });

  it("keeps the official first-party route available separately", () => {
    const model = makeModel({
      provider: "Anthropic",
      model_pricing: [
        {
          provider_name: "OpenRouter",
          input_price_per_million: 2.8,
          source: "openrouter",
          effective_date: "2026-03-10",
        },
        {
          provider_name: "Anthropic",
          input_price_per_million: 3,
          source: "Anthropic Pricing",
          effective_date: "2026-03-10",
        },
      ],
    });

    expect(getOfficialPricing(model)?.provider_name).toBe("Anthropic");
  });

  it("returns a compact public summary with cheapest-verified strategy by default", () => {
    const model = makeModel({
      provider: "Anthropic",
      model_pricing: [
        {
          provider_name: "OpenRouter",
          input_price_per_million: 2.8,
          source: "openrouter",
          effective_date: "2026-03-10",
        },
        {
          provider_name: "Anthropic",
          input_price_per_million: 3,
          source: "Anthropic Pricing",
          effective_date: "2026-03-10",
        },
      ],
    });

    expect(getPublicPricingSummary(model)).toMatchObject({
      compactPrice: 2.8,
      compactDisplay: "$2.80/M",
      compactLabel: "Cheapest verified",
      compactSourceLabel: "OpenRouter",
      strategy: "cheapest_verified_route",
    });
  });

  it("can still return official-first compact pricing when explicitly requested", () => {
    const model = makeModel({
      provider: "Anthropic",
      model_pricing: [
        {
          provider_name: "OpenRouter",
          input_price_per_million: 2.8,
          source: "openrouter",
          effective_date: "2026-03-10",
        },
        {
          provider_name: "Anthropic",
          input_price_per_million: 3,
          source: "Anthropic Pricing",
          effective_date: "2026-03-10",
        },
      ],
    });

    expect(
      getPublicPricingSummary(model, { compactStrategy: "official_first" })
    ).toMatchObject({
      compactPrice: 3,
      compactDisplay: "$3.00/M",
      compactLabel: "Official",
      compactSourceLabel: "Anthropic",
      strategy: "official_company_price",
    });
  });

  it("filters stale tracked pricing out of the verified summary", () => {
    const staleDate = new Date(Date.now() - (VERIFIED_PRICING_MAX_AGE_DAYS + 10) * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const model = makeModel({
      provider: "OpenAI",
      model_pricing: [
        {
          provider_name: "OpenAI",
          input_price_per_million: 2.5,
          source: "openai.com/pricing",
          effective_date: staleDate,
        },
      ],
    });

    expect(getCheapestVerifiedPricing(model)).toBeNull();
    expect(getOfficialPricing(model)).toBeNull();
    expect(getPublicPricingSummary(model)).toMatchObject({
      compactPrice: null,
      compactDisplay: null,
      compactLabel: "Needs refresh",
      compactSourceLabel: "OpenAI",
      strategy: "stale_refresh_needed",
    });
  });

  it("still exposes stale tracked entries for detail views", () => {
    const staleDate = new Date(Date.now() - (VERIFIED_PRICING_MAX_AGE_DAYS + 5) * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const model = makeModel({
      provider: "Anthropic",
      model_pricing: [
        {
          provider_name: "Anthropic",
          input_price_per_million: 3,
          source: "anthropic.com/pricing",
          effective_date: staleDate,
        },
      ],
    });

    expect(getStaleTrackedPricingEntries(model)).toHaveLength(1);
  });

  it("surfaces verified per-request pricing when no token price exists", () => {
    const model = makeModel({
      provider: "OpenAI",
      model_pricing: [
        {
          provider_name: "OpenAI",
          input_price_per_million: null,
          output_price_per_million: null,
          price_per_call: 0.04,
          source: "platform.openai.com/docs/pricing",
          effective_date: "2026-03-17",
        },
      ],
    });

    expect(getLowestInputPrice(model)).toBeNull();
    expect(getPublicPricingSummary(model)).toMatchObject({
      compactPrice: 0.04,
      compactKind: "request",
      compactDisplay: "$0.0400/request",
      compactLabel: "Cheapest verified",
      strategy: "cheapest_verified_route",
    });
  });
});

describe("pricing freshness helpers", () => {
  it("computes price age from effective_date", () => {
    const age = getPricingAgeDays(
      { effective_date: "2026-03-01", updated_at: null },
      new Date("2026-03-17T00:00:00.000Z")
    );

    expect(age).toBe(16);
  });

  it("treats recent prices as fresh and old prices as stale", () => {
    expect(
      isFreshVerifiedPricingEntry(
        {
          provider_name: "OpenAI",
          input_price_per_million: 2.5,
          effective_date: "2026-03-01",
        },
        new Date("2026-03-17T00:00:00.000Z")
      )
    ).toBe(true);

    expect(
      isFreshVerifiedPricingEntry(
        {
          provider_name: "OpenAI",
          input_price_per_million: 2.5,
          effective_date: "2025-12-01",
        },
        new Date("2026-03-17T00:00:00.000Z")
      )
    ).toBe(false);
  });
});
