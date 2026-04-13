import { describe, expect, it } from "vitest";

import { getBenchmarkScore, getTrustedBenchmarkScores } from "./compare-helpers";

describe("compare benchmark helpers", () => {
  const model = {
    benchmark_scores: [
      {
        score: 84.1,
        source: "provider-blog",
        benchmarks: { slug: "mmlu", name: "MMLU" },
      },
      {
        score: 91.3,
        source: "livebench",
        benchmarks: { slug: "mmlu", name: "MMLU" },
      },
      {
        score: 72.8,
        source: "swe-bench",
        benchmarks: { slug: "swe-bench-verified", name: "SWE-bench Verified" },
      },
    ],
  };

  it("returns only trusted structured benchmark rows", () => {
    expect(getTrustedBenchmarkScores(model as never)).toEqual([
      {
        score: 91.3,
        source: "livebench",
        benchmarks: { slug: "mmlu", name: "MMLU" },
      },
      {
        score: 72.8,
        source: "swe-bench",
        benchmarks: { slug: "swe-bench-verified", name: "SWE-bench Verified" },
      },
    ]);
  });

  it("reads benchmark values from trusted rows only", () => {
    expect(getBenchmarkScore(model as never, "mmlu")).toBe(91.3);
    expect(getBenchmarkScore(model as never, "swe-bench-verified")).toBe(72.8);
    expect(getBenchmarkScore(model as never, "unknown-benchmark")).toBeNull();
  });
});
