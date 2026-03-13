import { describe, expect, it } from "vitest";

import { __testables } from "./arena-hard-auto";

const OFFICIAL_README_SNIPPET = `
## Leaderboard

### Arena-Hard-v2.0-Preview

Hard Prompt, Style Control, and Gemini-2.5 as Judge **(Official Configuration)**:
\`\`\`console
                                      Model  Scores (%)         CI (%)
0                             o3-2025-04-16        85.9  (-0.8 / +0.9)
1                   o4-mini-2025-04-16-high        79.1  (-1.4 / +1.2)
2                                gemini-2.5        79.0  (-2.1 / +1.8)
13                                  gpt-4.1        50.0  (-1.9 / +1.7)
18               claude-3-5-sonnet-20241022        33.0  (-2.3 / +1.8)
\`\`\`

Hard Prompt, Style Control, and GPT-4.1 as Judge **(If prefer OpenAI API)**
\`\`\`console
                                      Model  Scores (%)         CI (%)
0                             o3-2025-04-16        87.0  (-1.0 / +1.0)
5                                   gpt-4.1        58.3  (-2.0 / +2.3)
\`\`\`
`;

describe("arena-hard-auto helpers", () => {
  it("parses the official Gemini leaderboard block from the upstream README", () => {
    const scores = __testables.extractOfficialScores(OFFICIAL_README_SNIPPET);

    expect(scores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          modelName: "o3-2025-04-16",
          aliases: expect.arrayContaining(["o3-2025-04-16", "o3"]),
          score: 85.9,
          normalizedScore: 85.9,
          metadata: expect.objectContaining({
            leaderboard: "Arena-Hard-v2.0-Preview",
            judge: "gemini-2.5",
            sourceUrl: "https://github.com/lmarena/arena-hard-auto#leaderboard",
            confidenceInterval: {
              lower: -0.8,
              upper: 0.9,
            },
          }),
        }),
        expect.objectContaining({
          modelName: "gemini-2.5",
          aliases: expect.arrayContaining(["gemini-2.5", "gemini 2.5"]),
          score: 79,
        }),
        expect.objectContaining({
          modelName: "gpt-4.1",
          aliases: expect.arrayContaining(["gpt-4.1", "gpt 4.1"]),
          score: 50,
        }),
        expect.objectContaining({
          modelName: "claude-3-5-sonnet-20241022",
          aliases: expect.arrayContaining(["claude-3-5-sonnet-20241022", "claude 3.5 sonnet"]),
          score: 33,
        }),
      ])
    );
  });
});
