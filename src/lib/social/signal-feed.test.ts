import { describe, expect, it } from "vitest";

import { buildCommonsSignalFeed } from "./signal-feed";

describe("buildCommonsSignalFeed", () => {
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
      id: "paper-1",
      title: "New multimodal paper",
      source: "arxiv",
      published_at: "2026-03-16T10:00:00.000Z",
      metadata: { signal_type: "research", signal_importance: "low" },
    },
  ];

  it("builds a signal feed for global commons", () => {
    const feed = buildCommonsSignalFeed(items, "global", 4);

    expect(feed).toEqual(
      expect.objectContaining({
        title: "Signal board",
      })
    );
    expect(feed?.summary.map((bucket) => bucket.type)).toEqual([
      "launch",
      "pricing",
      "research",
    ]);
    expect(feed?.radar).toHaveLength(3);
  });

  it("filters launches community to launch-oriented signals", () => {
    const feed = buildCommonsSignalFeed(items, "launches", 4);

    expect(feed?.summary.map((bucket) => bucket.type)).toEqual([
      "launch",
      "pricing",
    ]);
    expect(feed?.radar.map((item) => item.id)).toEqual(["launch-1", "pricing-1"]);
  });

  it("returns null for unsupported communities", () => {
    expect(buildCommonsSignalFeed(items, "marketplace", 4)).toBeNull();
  });
});
