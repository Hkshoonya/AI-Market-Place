import { describe, expect, it } from "vitest";
import adapter, { OFFICIAL_TEXT_ARENA } from "./chatbot-arena";

describe("text Arena registration", () => {
  it("retains the existing job identity while separating official rating provenance", () => {
    expect(adapter.id).toBe("chatbot-arena");
    expect(OFFICIAL_TEXT_ARENA).toBe("arena-text-official");
    expect(adapter.requiredSecrets).toEqual([]);
  });
});
