import { describe, expect, it } from "vitest";

import {
  AUCTION_STATUS_BADGE_STYLES,
  AUCTION_TYPE_BADGE_STYLES,
  AUCTION_TYPE_ICONS,
} from "./presentation";

describe("auction presentation helpers", () => {
  it("defines badge styles for every public auction status", () => {
    expect(AUCTION_STATUS_BADGE_STYLES).toEqual({
      active: expect.stringContaining("emerald"),
      upcoming: expect.stringContaining("blue"),
      ended: expect.stringContaining("zinc"),
      cancelled: expect.stringContaining("red"),
    });
  });

  it("defines badge styles and icons for every auction type", () => {
    expect(Object.keys(AUCTION_TYPE_BADGE_STYLES)).toEqual(["english", "dutch", "batch"]);
    expect(Object.keys(AUCTION_TYPE_ICONS)).toEqual(["english", "dutch", "batch"]);
  });
});
