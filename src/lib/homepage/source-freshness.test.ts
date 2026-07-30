import { describe, expect, it } from "vitest";

import { getCoreSourceRefreshTimestamp } from "./source-freshness";

describe("getCoreSourceRefreshTimestamp", () => {
  const required = ["models-a", "models-b", "news"] as const;

  it("returns the oldest successful timestamp across every required source", () => {
    expect(
      getCoreSourceRefreshTimestamp(
        [
          {
            slug: "models-a",
            last_success_at: "2026-07-30T14:05:00.000Z",
          },
          {
            slug: "models-b",
            last_success_at: "2026-07-30T12:03:00.000Z",
          },
          {
            slug: "news",
            last_success_at: "2026-07-30T16:01:00.000Z",
          },
        ],
        required
      )
    ).toBe("2026-07-30T12:03:00.000Z");
  });

  it("falls back to last_sync_at for legacy source rows", () => {
    expect(
      getCoreSourceRefreshTimestamp(
        [
          {
            slug: "models-a",
            last_success_at: null,
            last_sync_at: "2026-07-30T14:05:00.000Z",
          },
        ],
        ["models-a"]
      )
    ).toBe("2026-07-30T14:05:00.000Z");
  });

  it("does not claim complete freshness when a required source is missing", () => {
    expect(
      getCoreSourceRefreshTimestamp(
        [
          {
            slug: "models-a",
            last_success_at: "2026-07-30T14:05:00.000Z",
          },
        ],
        required
      )
    ).toBeNull();
  });
});
