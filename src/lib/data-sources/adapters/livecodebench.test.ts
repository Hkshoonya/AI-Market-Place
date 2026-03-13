import { describe, expect, it } from "vitest";

import { __testables } from "./livecodebench";

describe("livecodebench helpers", () => {
  it("aggregates per-question pass rates into per-model scores", () => {
    const scores = __testables.extractModelScores({
      performances: [
        { model: "GPT-4O-2024-08-06", difficulty: "easy", "pass@1": 100 },
        { model: "GPT-4O-2024-08-06", difficulty: "hard", "pass@1": 40 },
        { model: "Claude 4 Sonnet", difficulty: "medium", "pass@1": 75 },
      ],
      models: [
        {
          model_name: "gpt-4o-2024-08-06",
          model_repr: "GPT-4O-2024-08-06",
          release_date: 1722902400000,
          link: "https://example.com/gpt-4o",
        },
        {
          model_name: "claude-4-sonnet",
          model_repr: "Claude 4 Sonnet",
          release_date: 1740000000000,
          link: "https://example.com/claude-4-sonnet",
        },
      ],
    });

    expect(scores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          modelName: "GPT-4O-2024-08-06",
          aliases: expect.arrayContaining(["GPT-4O-2024-08-06", "gpt-4o-2024-08-06"]),
          score: 70,
          normalizedScore: 70,
          sampleCount: 2,
          metadata: expect.objectContaining({
            sourceUrl: "https://example.com/gpt-4o",
            difficultyBreakdown: {
              easy: 100,
              hard: 40,
            },
          }),
        }),
        expect.objectContaining({
          modelName: "Claude 4 Sonnet",
          score: 75,
          sampleCount: 1,
        }),
      ])
    );
  });
});
