import { describe, expect, it } from "vitest";
import {
  buildSourceCoverage,
  getCorroborationMultiplier,
  type SourceCoverageSignals,
} from "./source-coverage";

function makeSignals(
  overrides: Partial<SourceCoverageSignals> = {}
): SourceCoverageSignals {
  return {
    hasCommunitySignals: true,
    benchmarkSources: ["livebench", "open-llm-leaderboard"],
    benchmarkCategories: ["reasoning", "general"],
    eloSources: ["chatbot_arena"],
    newsSources: ["provider-news", "arxiv"],
    pricingSources: ["openrouter", "provider-api"],
    ...overrides,
  };
}

describe("buildSourceCoverage", () => {
  it("marks broad corroborated coverage as low bias risk", () => {
    const coverage = buildSourceCoverage(makeSignals());

    expect(coverage.totalDistinctSources).toBe(8);
    expect(coverage.independentQualitySourceCount).toBe(3);
    expect(coverage.sourceFamilyCount).toBeGreaterThanOrEqual(5);
    expect(coverage.corroborationLevel).toBe("strong");
    expect(coverage.biasRisk).toBe("low");
  });

  it("marks single-source quality evidence as high bias risk", () => {
    const coverage = buildSourceCoverage(
      makeSignals({
        benchmarkSources: ["open-llm-leaderboard"],
        benchmarkCategories: ["general"],
        eloSources: [],
        newsSources: [],
        pricingSources: [],
        hasCommunitySignals: false,
      })
    );

    expect(coverage.independentQualitySourceCount).toBe(1);
    expect(coverage.corroborationLevel).toBe("single_source");
    expect(coverage.biasRisk).toBe("high");
  });
});

describe("getCorroborationMultiplier", () => {
  it("does not penalize strongly corroborated models", () => {
    const coverage = buildSourceCoverage(makeSignals());
    expect(getCorroborationMultiplier(coverage)).toBe(1);
  });

  it("applies a mild penalty to single-source quality evidence", () => {
    const coverage = buildSourceCoverage(
      makeSignals({
        benchmarkSources: ["open-llm-leaderboard"],
        benchmarkCategories: ["general"],
        eloSources: [],
      })
    );

    expect(getCorroborationMultiplier(coverage)).toBe(0.94);
  });
});
