import { describe, expect, it } from "vitest";

import {
  buildLaunchRadar,
  getNewsSignalImportance,
  getNewsSignalType,
  groupNewsBySignal,
  summarizeNewsSignals,
} from "./presentation";

describe("news presentation helpers", () => {
  const items = [
    {
      id: "launch-1",
      title: "Introducing GPT-5",
      source: "x-twitter",
      published_at: "2026-03-16T12:00:00.000Z",
      metadata: { signal_type: "launch", signal_importance: "high" },
    },
    {
      id: "pricing-1",
      title: "New lower pricing for Claude",
      source: "provider-blog",
      published_at: "2026-03-16T11:00:00.000Z",
      metadata: { signal_type: "pricing", signal_importance: "high" },
    },
    {
      id: "api-1",
      title: "Responses API now supports tool calling",
      source: "provider-blog",
      published_at: "2026-03-16T10:00:00.000Z",
      metadata: { signal_type: "api", signal_importance: "medium" },
    },
    {
      id: "paper-1",
      title: "New multimodal paper",
      source: "arxiv",
      published_at: "2026-03-16T09:00:00.000Z",
      metadata: {},
    },
  ];

  it("prefers explicit signal metadata when present", () => {
    expect(getNewsSignalType(items[0])).toBe("launch");
    expect(getNewsSignalImportance(items[2])).toBe("medium");
  });

  it("falls back to source-aware signal types", () => {
    expect(getNewsSignalType(items[3])).toBe("research");
    expect(getNewsSignalImportance(items[3])).toBe("low");
  });

  it("summarizes counts by signal type", () => {
    expect(summarizeNewsSignals(items)).toEqual([
      expect.objectContaining({ type: "launch", count: 1 }),
      expect.objectContaining({ type: "pricing", count: 1 }),
      expect.objectContaining({ type: "api", count: 1 }),
      expect.objectContaining({ type: "research", count: 1 }),
    ]);
  });

  it("builds launch radar ordered by importance then recency", () => {
    const radar = buildLaunchRadar(items, 3);

    expect(radar.map((item) => item.id)).toEqual(["launch-1", "pricing-1", "api-1"]);
    expect(radar[0]).toEqual(
      expect.objectContaining({
        signalType: "launch",
        signalLabel: "Launches",
        signalImportance: "high",
      })
    );
  });

  it("groups items by signal for section rendering", () => {
    const grouped = groupNewsBySignal(items);

    expect(grouped[0]).toEqual(
      expect.objectContaining({
        type: "launch",
        items: [expect.objectContaining({ id: "launch-1" })],
      })
    );
    expect(grouped.at(-1)).toEqual(
      expect.objectContaining({
        type: "research",
        items: [expect.objectContaining({ id: "paper-1" })],
      })
    );
  });
});
