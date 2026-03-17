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

  it("does not stack near-duplicate X posts about the same event", () => {
    const evidence = buildModelNewsEvidenceMap([
      {
        id: "tweet-1",
        title: "OpenAI launches GPT-Next today",
        source: "x-twitter",
        related_provider: "OpenAI",
        related_model_ids: ["m1"],
        published_at: "2026-03-17T10:00:00Z",
        metadata: { signal_type: "launch", signal_importance: "high" },
      },
      {
        id: "tweet-2",
        title: "OpenAI launches GPT Next today!!!",
        source: "x-twitter",
        related_provider: "OpenAI",
        related_model_ids: ["m1"],
        published_at: "2026-03-17T10:30:00Z",
        metadata: { signal_type: "launch", signal_importance: "high" },
      },
    ]);

    expect(evidence.get("m1")).toBeCloseTo(
      getNewsEvidenceWeight({
        source: "x-twitter",
        metadata: { signal_type: "launch", signal_importance: "high" },
      })
    );
  });

  it("still counts distinct events from the same source separately up to the source cap", () => {
    const evidence = buildModelNewsEvidenceMap([
      {
        id: "tweet-1",
        title: "OpenAI launches GPT-Next today",
        source: "x-twitter",
        related_provider: "OpenAI",
        related_model_ids: ["m1"],
        published_at: "2026-03-17T10:00:00Z",
        metadata: { signal_type: "launch", signal_importance: "high" },
      },
      {
        id: "tweet-2",
        title: "OpenAI cuts GPT-Next pricing",
        source: "x-twitter",
        related_provider: "OpenAI",
        related_model_ids: ["m1"],
        published_at: "2026-03-17T14:00:00Z",
        metadata: { signal_type: "pricing", signal_importance: "high" },
      },
    ]);

    expect(evidence.get("m1")).toBeGreaterThan(
      getNewsEvidenceWeight({
        source: "x-twitter",
        metadata: { signal_type: "launch", signal_importance: "high" },
      })
    );
    expect(evidence.get("m1")).toBeLessThanOrEqual(getNewsEvidenceCap("x-twitter"));
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
