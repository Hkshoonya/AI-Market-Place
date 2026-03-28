import { describe, expect, it } from "vitest";

import { buildHomepageLaunchSelections } from "./launches";

describe("buildHomepageLaunchSelections", () => {
  it("prefers recent provider launch signals over raw release-date ordering", () => {
    const now = Date.parse("2026-03-28T01:00:00.000Z");
    const models = [
      { id: "older-direct-launch", provider: "Z.ai", release_date: "2026-03-21" },
      { id: "newer-generic-upload", provider: "unknown", release_date: "2026-03-27" },
      { id: "second-launch", provider: "MiniMax", release_date: "2026-03-25" },
    ];

    const result = buildHomepageLaunchSelections(
      models,
      [
        {
          source: "x-twitter",
          published_at: "2026-03-27T11:21:04.000Z",
          related_provider: "Z.ai",
          related_model_ids: ["older-direct-launch"],
          metadata: { signal_type: "launch", signal_importance: "high" },
        },
        {
          source: "provider-blog",
          published_at: "2026-03-27T20:00:00.000Z",
          related_provider: "MiniMax",
          related_model_ids: ["second-launch"],
          metadata: { signal_type: "general", signal_importance: "low" },
        },
      ],
      2,
      now
    );

    expect(result).toEqual([
      expect.objectContaining({ model: expect.objectContaining({ id: "second-launch" }) }),
      expect.objectContaining({ model: expect.objectContaining({ id: "older-direct-launch" }) }),
    ]);
  });

  it("drops provider-news matches when the linked model belongs to a different provider", () => {
    const result = buildHomepageLaunchSelections(
      [{ id: "generic-video", provider: "nanoukader", release_date: "2026-03-22" }],
      [
        {
          source: "provider-blog",
          published_at: "2026-03-28T00:53:07.000Z",
          related_provider: "MiniMax",
          related_model_ids: ["generic-video"],
          metadata: { signal_type: "general", signal_importance: "low" },
        },
      ],
      1,
      Date.parse("2026-03-28T01:00:00.000Z")
    );

    expect(result).toEqual([
      expect.objectContaining({ model: expect.objectContaining({ id: "generic-video" }) }),
    ]);
    expect(result[0]?.surfacedAt).toBe("2026-03-22");
  });

  it("falls back to release date when recent launch evidence is unavailable", () => {
    const result = buildHomepageLaunchSelections(
      [
        { id: "one", release_date: "2026-03-20" },
        { id: "two", release_date: "2026-03-27" },
      ],
      [],
      1,
      Date.parse("2026-03-28T01:00:00.000Z")
    );

    expect(result).toEqual([
      expect.objectContaining({ model: expect.objectContaining({ id: "two" }) }),
    ]);
  });
});
