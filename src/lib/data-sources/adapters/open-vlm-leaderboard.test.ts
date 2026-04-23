import { describe, expect, it } from "vitest";

import { __testables } from "./open-vlm-leaderboard";

describe("open-vlm-leaderboard helpers", () => {
  it("extracts preferred benchmark scores from the OpenVLM JSON shape", () => {
    const scores = __testables.extractBenchmarkScores({
      META: {
        Method: ["GPT-4o", "https://example.com"],
      },
      MMMU_VAL: { Overall: 69.2 },
      MathVista: { Overall: 61.8 },
      OCRBench: { "Final Score": 815 },
      MME: { Overall: 2310.3 },
      MMBench_TEST_EN_V11: { Overall: 83.0 },
    });

    expect(scores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ benchmarkSlug: "mmmu", score: 69.2, normalizedScore: 69.2 }),
        expect.objectContaining({ benchmarkSlug: "mathvista", score: 61.8, normalizedScore: 61.8 }),
        expect.objectContaining({ benchmarkSlug: "ocrbench", score: 815, normalizedScore: 81.5 }),
        expect.objectContaining({ benchmarkSlug: "mme", score: 2310.3, normalizedScore: 82.51071428571429 }),
        expect.objectContaining({ benchmarkSlug: "mmbench", score: 83.0, normalizedScore: 83.0 }),
      ])
    );
  });

  it("normalizes sub-1 scale scores to percentages", () => {
    expect(__testables.normalizeScore("mmmu", 0.873)).toBeCloseTo(87.3);
  });

  it("falls back to HTTP only for certificate-style upstream errors", () => {
    expect(
      __testables.shouldFallbackToHttpOpenVlm(
        new TypeError("fetch failed", {
          cause: new Error("certificate has expired"),
        })
      )
    ).toBe(true);

    expect(
      __testables.shouldFallbackToHttpOpenVlm(
        new TypeError("fetch failed", {
          cause: new Error("self signed certificate"),
        })
      )
    ).toBe(true);

    expect(
      __testables.shouldFallbackToHttpOpenVlm(
        new TypeError("fetch failed", {
          cause: new Error("socket hang up"),
        })
      )
    ).toBe(false);
  });
});
