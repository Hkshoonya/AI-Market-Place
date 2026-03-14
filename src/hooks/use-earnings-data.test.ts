import { describe, expect, it } from "vitest";

import { getFeeTierInfo } from "./use-earnings-data";

describe("getFeeTierInfo", () => {
  it("shows an explicit zero-fee state when marketplace fees are off", () => {
    expect(getFeeTierInfo(0)).toEqual({
      name: "No fee",
      color: "text-neon",
      nextTier: null,
      progressPercent: 100,
    });
  });
});
