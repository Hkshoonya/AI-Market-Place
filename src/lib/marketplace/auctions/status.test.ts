import { describe, expect, it } from "vitest";

import {
  PUBLIC_AUCTION_STATUSES,
  normalizeAuctionStatusParam,
} from "./status";

describe("auction status helpers", () => {
  it("exposes the supported public auction statuses in one place", () => {
    expect(PUBLIC_AUCTION_STATUSES).toEqual(["upcoming", "active", "ended", "cancelled"]);
  });

  it("maps legacy settled requests to ended", () => {
    expect(normalizeAuctionStatusParam("settled")).toBe("ended");
  });

  it("falls back to active for unsupported input", () => {
    expect(normalizeAuctionStatusParam("unknown-status")).toBe("active");
    expect(normalizeAuctionStatusParam(null)).toBe("active");
  });
});
