import { describe, expect, it } from "vitest";
import adapter from "./vision-arena";

describe("vision Arena registration", () => {
  it("uses official structured snapshots, not a configurable HTML destination", () => {
    expect(adapter.id).toBe("vision-arena");
    expect(adapter.defaultConfig).not.toHaveProperty("url");
    expect(adapter.requiredSecrets).toEqual([]);
  });
});
