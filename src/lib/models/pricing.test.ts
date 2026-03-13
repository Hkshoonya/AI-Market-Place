import { describe, expect, it } from "vitest";
import {
  compareModelsByLowestPrice,
  getLowestInputPrice,
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
  };
}

describe("getLowestInputPrice", () => {
  it("returns the cheapest numeric input price", () => {
    const model = makeModel({
      model_pricing: [
        { input_price_per_million: 12 },
        { input_price_per_million: 4.5 },
        { input_price_per_million: 9 },
      ],
    });

    expect(getLowestInputPrice(model)).toBe(4.5);
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
