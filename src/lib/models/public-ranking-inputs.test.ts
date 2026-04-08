import { describe, expect, it } from "vitest";

import {
  hasPublicRankingInputs,
  stripPublicRankingInputs,
} from "./public-ranking-inputs";

describe("public ranking inputs", () => {
  it("detects ranking-bearing rows", () => {
    expect(
      hasPublicRankingInputs({
        slug: "community-wrapper-latest",
        name: "Wrapper Latest",
        provider: "Community",
        overall_rank: 42,
      })
    ).toBe(true);
  });

  it("returns false when ranking inputs are absent", () => {
    expect(
      hasPublicRankingInputs({
        slug: "official-clean-row",
        name: "Official Clean Row",
        provider: "OpenAI",
        overall_rank: null,
        quality_score: null,
        hf_trending_score: null,
      })
    ).toBe(false);
  });

  it("strips all public ranking fields", () => {
    expect(
      stripPublicRankingInputs({
        slug: "community-wrapper-latest",
        overall_rank: 42,
        quality_score: 80,
        capability_score: 79,
        hf_trending_score: 88,
      })
    ).toEqual(
      expect.objectContaining({
        slug: "community-wrapper-latest",
        overall_rank: null,
        quality_score: null,
        capability_score: null,
        hf_trending_score: null,
      })
    );
  });
});
