import { describe, expect, it } from "vitest";

import { __testables } from "./gaia-benchmark";

describe("gaia-benchmark helpers", () => {
  it("keeps the strongest single-model family row and skips composite systems", () => {
    const candidates = __testables.extractCandidateScores([
      {
        model: "HF Agents + GPT-4o",
        model_family: "GPT-4o",
        score: 0.44,
        score_level1: 0.58,
        score_level2: 0.43,
        score_level3: 0.19,
        date: "2024-06-26",
      },
      {
        model: "Another GPT-4o system",
        model_family: "GPT-4o",
        score: 0.51,
        score_level1: 0.61,
        score_level2: 0.49,
        score_level3: 0.22,
        date: "2024-12-01",
      },
      {
        model: "Composite system",
        model_family: "Claude Sonnet 3.5, GPT-4o, o1",
        score: 0.9,
        date: "2025-01-01",
      },
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({
        family: "GPT-4o",
        submissionName: "Another GPT-4o system",
        normalizedScore: 51,
        date: "2024-12-01",
        levelBreakdown: {
          level1: 0.61,
          level2: 0.49,
          level3: 0.22,
        },
      }),
    ]);
  });

  it("rejects generic provider-family labels that are too broad to map safely", () => {
    expect(__testables.looksLikeTrackableFamily("Gemini")).toBe(false);
    expect(__testables.looksLikeTrackableFamily("Claude")).toBe(false);
    expect(__testables.looksLikeTrackableFamily("GPT-4o")).toBe(true);
    expect(__testables.looksLikeTrackableFamily("Gemini 2.5 Pro")).toBe(true);
  });
});
