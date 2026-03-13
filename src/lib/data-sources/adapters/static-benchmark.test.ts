import { describe, expect, it } from "vitest";

import { STATIC_BENCHMARK_ON_CONFLICT, buildStaticBenchmarkScoreRecord } from "./static-benchmark";

describe("static benchmark helpers", () => {
  it("builds benchmark_scores rows that match the table uniqueness constraint", () => {
    expect(
      buildStaticBenchmarkScoreRecord({
        modelId: "model-1",
        benchmarkId: 7,
        score: 82.5,
        source: "gaia-benchmark",
      })
    ).toEqual(
      expect.objectContaining({
        model_id: "model-1",
        benchmark_id: 7,
        score: 82.5,
        score_normalized: 82.5,
        source: "gaia-benchmark",
        model_version: "",
      })
    );

    expect(STATIC_BENCHMARK_ON_CONFLICT).toBe("model_id,benchmark_id,model_version");
  });
});
