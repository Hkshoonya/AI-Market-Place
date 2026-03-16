import { describe, expect, it } from "vitest";

import {
  buildModelNewsEvidenceMap,
  getNewsEvidenceCap,
  getNewsEvidenceWeight,
  getNewsSignalTrustBonus,
} from "./evidence";

describe("getNewsEvidenceWeight", () => {
  it("downweights X posts relative to official or research sources", () => {
    expect(
      getNewsEvidenceWeight({
        source: "x-twitter",
        metadata: { signal_type: "launch", signal_importance: "high" },
      })
    ).toBeLessThan(
      getNewsEvidenceWeight({
        source: "provider-blog",
        metadata: { signal_type: "launch", signal_importance: "high" },
      })
    );

    expect(
      getNewsEvidenceWeight({
        source: "x-twitter",
        metadata: { signal_type: "launch", signal_importance: "high" },
      })
    ).toBeLessThan(
      getNewsEvidenceWeight({
        source: "arxiv",
        metadata: { signal_type: "research", signal_importance: "high" },
      })
    );
  });

  it("caps repeated X coverage aggressively", () => {
    expect(getNewsEvidenceCap("x-twitter")).toBeLessThan(getNewsEvidenceCap("provider-blog"));
  });
});

describe("buildModelNewsEvidenceMap", () => {
  it("caps repeated social chatter so it cannot outrun stronger evidence", () => {
    const evidence = buildModelNewsEvidenceMap([
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `tweet-${index}`,
        source: "x-twitter",
        related_model_ids: ["m1"],
        metadata: { signal_type: "launch", signal_importance: "high" },
      })),
      {
        id: "blog-1",
        source: "provider-blog",
        related_model_ids: ["m2"],
        metadata: { signal_type: "launch", signal_importance: "high" },
      },
      {
        id: "benchmark-1",
        source: "artificial-analysis",
        related_model_ids: ["m2"],
        metadata: { signal_type: "benchmark", signal_importance: "high" },
      },
    ]);

    expect(evidence.get("m1")).toBeLessThan(evidence.get("m2") ?? 0);
    expect(evidence.get("m1")).toBeLessThanOrEqual(0.8);
  });

  it("deduplicates repeated model ids inside the same news item", () => {
    const evidence = buildModelNewsEvidenceMap([
      {
        id: "provider-update",
        source: "provider-blog",
        related_model_ids: ["m1", "m1"],
        metadata: { signal_type: "api", signal_importance: "high" },
      },
    ]);

    expect(evidence.get("m1")).toBeCloseTo(
      getNewsEvidenceWeight({
        source: "provider-blog",
        metadata: { signal_type: "api", signal_importance: "high" },
      })
    );
  });
});

describe("getNewsSignalTrustBonus", () => {
  it("prefers provider blogs over X when signal recency and importance tie", () => {
    const xBonus = getNewsSignalTrustBonus({
      source: "x-twitter",
      metadata: { signal_type: "launch", signal_importance: "high" },
    });
    const blogBonus = getNewsSignalTrustBonus({
      source: "provider-blog",
      metadata: { signal_type: "launch", signal_importance: "high" },
    });

    expect(blogBonus).toBeGreaterThan(xBonus);
  });
});
