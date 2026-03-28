import { describe, expect, it, vi } from "vitest";

import { __testables } from "./minimax-models";

describe("minimax-models adapter", () => {
  it("extracts model ids from the official docs page", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        "<html>MiniMax-M2.7 MiniMax-M1 MiniMax-M1-80k MiniMax-AI</html>",
        { status: 200 }
      )
    );

    await expect(__testables.scrapeModelIds()).resolves.toEqual([
      "MiniMax-M1",
      "MiniMax-M1-80k",
      "MiniMax-M2.7",
    ]);

    fetchMock.mockRestore();
  });

  it("builds canonical provider records for MiniMax models", () => {
    const record = __testables.buildModelRecord("MiniMax-M2.7");

    expect(record).toEqual(
      expect.objectContaining({
        provider: "MiniMax",
        slug: "minimax-minimax-m2-7",
        name: "MiniMax M2.7",
      })
    );
  });
});
