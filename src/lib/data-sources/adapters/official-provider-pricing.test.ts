import { describe, expect, it } from "vitest";

import {
  __testables,
  parseOfficialTokenPricing,
} from "./official-provider-pricing";

describe("official provider pricing", () => {
  it("parses the first-party per-million-token pricing table", () => {
    const markdown = `
## Pricing

| Metric | Price | Unit |
| --- | ---: | --- |
| Input | $0.2 | 1M tokens |
| Cached input | $0.02 | 1M tokens |
| Output | $1.2 | 1M tokens |

## Quick comparison

| Model | Input | Cached input | Output |
| --- | ---: | ---: | ---: |
| GPT-5.6 Luna | $0.2 | $0.02 | $1.2 |
`;

    expect(parseOfficialTokenPricing(markdown)).toEqual({
      inputPricePerMillion: 0.2,
      cachedInputPricePerMillion: 0.02,
      outputPricePerMillion: 1.2,
    });
  });

  it("fails closed when the official document shape is incomplete", () => {
    expect(
      parseOfficialTokenPricing(`
| Metric | Price | Unit |
| --- | ---: | --- |
| Input | $2 | 1M tokens |
| Output | $12 | 1M tokens |
`)
    ).toBeNull();
  });

  it("preserves the effective date only when price and source are unchanged", () => {
    const pricing = {
      inputPricePerMillion: 2,
      cachedInputPricePerMillion: 0.2,
      outputPricePerMillion: 12,
    };

    expect(
      __testables.sameObservedPrice(
        {
          model_id: "terra",
          input_price_per_million: 2,
          cached_input_price_per_million: 0.2,
          output_price_per_million: 12,
          source:
            "https://developers.openai.com/api/docs/models/gpt-5.6-terra",
          effective_date: "2026-07-30",
        },
        pricing,
        "https://developers.openai.com/api/docs/models/gpt-5.6-terra"
      )
    ).toBe(true);

    expect(
      __testables.sameObservedPrice(
        {
          model_id: "terra",
          input_price_per_million: 2.5,
          cached_input_price_per_million: 0.2,
          output_price_per_million: 15,
          source:
            "https://developers.openai.com/api/docs/models/gpt-5.6-terra",
          effective_date: "2026-06-26",
        },
        pricing,
        "https://developers.openai.com/api/docs/models/gpt-5.6-terra"
      )
    ).toBe(false);
  });
});
