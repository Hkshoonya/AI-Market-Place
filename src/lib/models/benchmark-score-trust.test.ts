import { describe, expect, it } from "vitest";

import {
  countTrustedStructuredBenchmarkScores,
  filterTrustedStructuredBenchmarkScores,
  getTrustedStructuredBenchmarkModelIds,
} from "./benchmark-score-trust";

describe("benchmark score trust helpers", () => {
  it("filters to trusted structured benchmark sources only", () => {
    const rows = [
      { id: "bench-1", source: "livebench" },
      { id: "bench-2", source: "provider-benchmarks" },
      { id: "bench-3", source: "provider-blog" },
      { id: "bench-4", source: "arena-hard-auto" },
      { id: "bench-5", source: null },
    ];

    expect(filterTrustedStructuredBenchmarkScores(rows)).toEqual([
      { id: "bench-1", source: "livebench" },
      { id: "bench-2", source: "provider-benchmarks" },
      { id: "bench-4", source: "arena-hard-auto" },
    ]);
    expect(countTrustedStructuredBenchmarkScores(rows)).toBe(3);
  });

  it("collects unique model ids from trusted structured benchmark rows", () => {
    const rows = [
      { model_id: "model-1", source: "livebench" },
      { model_id: "model-1", source: "livebench" },
      { model_id: "model-2", source: "provider-benchmarks" },
      { model_id: "model-3", source: "provider-blog" },
      { model_id: "model-4", source: "swe-bench" },
    ];

    expect(Array.from(getTrustedStructuredBenchmarkModelIds(rows)).sort()).toEqual([
      "model-1",
      "model-2",
      "model-4",
    ]);
  });
});
