import { describe, expect, it } from "vitest";

import {
  computeWatchlistDiscoveryScore,
  sortWatchlistsForDiscovery,
  type DiscoverWatchlistLike,
} from "./watchlists";

const now = new Date("2026-03-16T12:00:00.000Z");

function makeWatchlist(overrides: Partial<DiscoverWatchlistLike>): DiscoverWatchlistLike {
  return {
    id: "watchlist-1",
    name: "Test Watchlist",
    description: "A focused set of models for reasoning, coding, and multimodal evaluation.",
    created_at: "2026-03-01T12:00:00.000Z",
    updated_at: "2026-03-15T12:00:00.000Z",
    watchlist_items: Array.from({ length: 12 }, (_, index) => ({ id: `item-${index}` })),
    profiles: { display_name: "Curator", username: "curator" },
    ...overrides,
  };
}

describe("watchlist discovery scoring", () => {
  it("scores richer, fresher watchlists above sparse stale ones", () => {
    const strong = makeWatchlist({
      id: "strong",
      updated_at: "2026-03-16T08:00:00.000Z",
    });
    const weak = makeWatchlist({
      id: "weak",
      description: null,
      updated_at: "2026-01-10T08:00:00.000Z",
      watchlist_items: [{ id: "item-1" }],
      profiles: null,
    });

    expect(computeWatchlistDiscoveryScore(strong, now)).toBeGreaterThan(
      computeWatchlistDiscoveryScore(weak, now)
    );
  });

  it("sorts watchlists by discovery score before falling back to recency", () => {
    const watchlists = [
      makeWatchlist({
        id: "stale-big",
        updated_at: "2026-02-01T12:00:00.000Z",
        watchlist_items: Array.from({ length: 18 }, (_, index) => ({ id: `stale-${index}` })),
      }),
      makeWatchlist({
        id: "fresh-small",
        updated_at: "2026-03-16T11:00:00.000Z",
        description: null,
        watchlist_items: [{ id: "fresh-1" }, { id: "fresh-2" }],
        profiles: null,
      }),
      makeWatchlist({
        id: "balanced",
        updated_at: "2026-03-16T10:00:00.000Z",
      }),
    ];

    const sorted = sortWatchlistsForDiscovery(watchlists, now);

    expect(sorted.map((watchlist) => watchlist.id)).toEqual([
      "balanced",
      "fresh-small",
      "stale-big",
    ]);
  });
});
