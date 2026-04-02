import { describe, expect, it } from "vitest";

import { __testables } from "./aider-polyglot";

describe("aider-polyglot helpers", () => {
  it("extracts leaderboard rows from the official aider table", () => {
    const html = `
      <h2>Aider polyglot coding leaderboard</h2>
      <div class="table-wrapper">
        <table>
          <tbody>
            <tr id="main-row-0">
              <td><button>▶</button></td>
              <td><span>gpt-5 (high)</span></td>
              <td class="bar-cell"><span>88.0%</span></td>
              <td><span>$29.08</span></td>
              <td><span><code>aider --model openai/gpt-5</code></span></td>
              <td><span>91.6%</span></td>
              <td><span>diff</span></td>
            </tr>
            <tr class="details-row" id="details-0">
              <td colspan="7">
                <ul>
                  <li><strong>Date</strong>: 2025-08-23</li>
                  <li><strong>Model</strong>: gpt-5 (high)</li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const entries = __testables.extractAiderLeaderboardEntries(html);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      modelName: "gpt-5 (high)",
      score: 88,
      conformRate: 91.6,
      editFormat: "diff",
      command: "aider --model openai/gpt-5",
      date: "2025-08-23",
    });
    expect(entries[0].aliases).toContain("openai/gpt-5");
    expect(entries[0].aliases).toContain("gpt-5");
  });

  it("extracts command aliases for model matching", () => {
    expect(__testables.extractCommandAliases("aider --model openrouter/x-ai/grok-4")).toEqual(
      expect.arrayContaining(["openrouter/x-ai/grok-4", "x-ai/grok-4", "grok-4"])
    );
  });

  it("augments known alias variants for brittle leaderboard names", () => {
    expect(
      __testables.augmentAliases({
        modelName: "yi-lightning",
        command: "aider --model openai/yi-lightning",
        aliases: ["yi-lightning", "openai/yi-lightning"],
      })
    ).toEqual(
      expect.arrayContaining([
        "yi-lightning",
        "Yi-Lightning",
        "01.AI Yi-Lightning",
      ])
    );

    expect(
      __testables.augmentAliases({
        modelName: "Codestral 25.01",
        command: "aider --model mistral/codestral-latest",
        aliases: ["Codestral 25.01", "mistral/codestral-latest", "codestral-latest"],
      })
    ).toEqual(
      expect.arrayContaining([
        "Codestral",
        "codestral",
        "Codestral latest",
      ])
    );
  });
});
