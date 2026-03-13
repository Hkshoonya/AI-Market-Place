import { describe, expect, it } from "vitest";

import { __testables } from "./swe-bench";

describe("swe-bench helpers", () => {
  it("prefers the Verified leaderboard and deduplicates by extracted model tag", () => {
    const scores = __testables.extractModelScores({
      leaderboards: [
        {
          name: "Lite",
          results: [
            {
              name: "Claude 4.5 Opus Lite",
              resolved: 50,
              tags: ["Model: claude-opus-4-5"],
              date: "2025-11-01",
            },
          ],
        },
        {
          name: "Verified",
          results: [
            {
              name: "System A + Claude 4.5 Opus",
              resolved: 79.2,
              tags: ["Model: claude-opus-4-5", "Org: Test"],
              date: "2025-12-15",
              site: "https://example.com/system-a",
            },
            {
              name: "System B + Claude 4.5 Opus",
              resolved: 78.8,
              tags: ["Model: claude-opus-4-5"],
              date: "2025-12-10",
            },
            {
              name: "TRAE + Doubao-Seed-Code",
              resolved: 78.8,
              tags: ["Model: Doubao-Seed-Code", "Org: ByteDance"],
              date: "2025-09-28",
            },
          ],
        },
      ],
    });

    expect(scores).toEqual([
      expect.objectContaining({
        modelName: "claude-opus-4-5",
        aliases: expect.arrayContaining(["System A + Claude 4.5 Opus"]),
        score: 79.2,
        normalizedScore: 79.2,
        metadata: expect.objectContaining({
          leaderboard: "Verified",
          site: "https://example.com/system-a",
        }),
      }),
      expect.objectContaining({
        modelName: "Doubao-Seed-Code",
        score: 78.8,
      }),
    ]);
  });
});
