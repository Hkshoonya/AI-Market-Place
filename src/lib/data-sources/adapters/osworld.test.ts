import { describe, expect, it } from "vitest";

import { extractOsWorldEntries, extractOsWorldModelMatchNames } from "./osworld";

describe("extractOsWorldModelMatchNames", () => {
  it("pulls direct model families out of OSWorld leaderboard labels", () => {
    expect(extractOsWorldModelMatchNames("OpenAI CUA o3 (200 steps)")).toEqual([
      "OpenAI CUA o3 (200 steps)",
      "o3",
    ]);

    expect(extractOsWorldModelMatchNames("Agent S2 w/ Gemini 2.5 (50 steps)")).toEqual([
      "Agent S2 w/ Gemini 2.5 (50 steps)",
      "Gemini 2.5 Pro",
    ]);

    expect(extractOsWorldModelMatchNames("Claude 3.7 Sonnet (100 steps)")).toEqual([
      "Claude 3.7 Sonnet (100 steps)",
      "Claude 3.7 Sonnet",
    ]);
  });
});

describe("extractOsWorldEntries", () => {
  it("keeps the best score per extracted model family", () => {
    const entries = extractOsWorldEntries([
      {
        Model: "OpenAI CUA o3 (200 steps)",
        Score: "42.9",
        Date: "May 23, 2025",
      },
      {
        Model: "GTA1  w/ o3 (100 steps)",
        Score: "45.2",
        Date: "July 7, 2025",
      },
      {
        Model: "Claude 3.7 Sonnet (100 steps)",
        Score: "~ 28",
        Date: "Feb 24, 2025",
      },
    ]);

    expect(entries).toEqual([
      {
        matchNames: ["o3", "GTA1  w/ o3 (100 steps)"],
        score: 45.2,
        evaluationDate: "2025-07-07",
      },
      {
        matchNames: ["Claude 3.7 Sonnet", "Claude 3.7 Sonnet (100 steps)"],
        score: 28,
        evaluationDate: "2025-02-24",
      },
    ]);
  });
});
