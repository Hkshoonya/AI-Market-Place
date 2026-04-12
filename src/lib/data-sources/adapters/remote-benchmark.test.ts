import { describe, expect, it } from "vitest";

import {
  normalizeRemoteBenchmarkDate,
  parseCsvRows,
} from "./remote-benchmark";
import { parseTerminalBenchLeaderboardHtml } from "./terminal-bench";
import { extractTauBenchEntries } from "./tau-bench";
import { parseWebArenaCsv } from "./webarena";

describe("remote benchmark helpers", () => {
  it("normalizes benchmark dates from multiple upstream formats", () => {
    expect(normalizeRemoteBenchmarkDate("2026-04-01")).toBe("2026-04-01");
    expect(normalizeRemoteBenchmarkDate("02/2026")).toBe("2026-02-01");
    expect(normalizeRemoteBenchmarkDate("April 1, 2026")).toBe("2026-04-01");
    expect(normalizeRemoteBenchmarkDate("")).toBeNull();
  });

  it("parses CSV rows with quoted commas and newlines", () => {
    const rows = parseCsvRows(
      'col1,col2,col3\n"a,1","line 1\nline 2","plain"\n"x","y","z"'
    );

    expect(rows).toEqual([
      ["col1", "col2", "col3"],
      ["a,1", "line 1\nline 2", "plain"],
      ["x", "y", "z"],
    ]);
  });
});

describe("parseTerminalBenchLeaderboardHtml", () => {
  it("extracts model scores from the public leaderboard table", () => {
    const html = `
      <table>
        <tbody>
          <tr data-slot="table-row">
            <td></td>
            <td>1</td>
            <td><span>Pilot</span></td>
            <td><span>Claude Opus 4.6</span></td>
            <td>2026-04-01</td>
            <td>QuantFlow</td>
            <td><span>Anthropic</span></td>
            <td><p class="text-right"><span class="font-bold">82.9%</span><span>± 1.4</span></p></td>
          </tr>
          <tr data-slot="table-row">
            <td></td>
            <td>2</td>
            <td><span>Forge</span></td>
            <td><span>GPT-5.2</span></td>
            <td>2026-03-15</td>
            <td>ForgeCode</td>
            <td><span>OpenAI</span></td>
            <td><p class="text-right"><span class="font-bold">81.8%</span><span>± 2.0</span></p></td>
          </tr>
        </tbody>
      </table>
    `;

    expect(parseTerminalBenchLeaderboardHtml(html)).toEqual([
      {
        matchNames: ["Claude Opus 4.6"],
        score: 82.9,
        evaluationDate: "2026-04-01",
      },
      {
        matchNames: ["GPT-5.2"],
        score: 81.8,
        evaluationDate: "2026-03-15",
      },
    ]);
  });
});

describe("parseWebArenaCsv", () => {
  it("keeps direct model rows and drops composite agent systems", () => {
    const csv = [
      "a,Open?,Model Size (billion),Model,Success Rate (%),Result Source,Work,Traj,Note",
      "06/2023,✔,-,gpt-4-0613,14.9,WebArena,GPT,Link,when not achievable hint is not provided",
      "05/2024,✔,-,gpt-4o-2024-05-13,13.1,WebArena Team,GPT,Link,when not achievable hint is provided",
      "12/2025,✔,-,WebOperator + GPT-4o,54.6,WebOperator,WebOperator,Link,",
      "12/2023,✔,-,Gemini Pro,7.12,WebArena,Gemini Pro,Link,",
    ].join("\n");

    expect(parseWebArenaCsv(csv)).toEqual([
      {
        matchNames: ["gpt-4-0613"],
        score: 14.9,
        evaluationDate: "2023-06-01",
      },
      {
        matchNames: ["gpt-4o-2024-05-13"],
        score: 13.1,
        evaluationDate: "2024-05-01",
      },
      {
        matchNames: ["Gemini Pro"],
        score: 7.12,
        evaluationDate: "2023-12-01",
      },
    ]);
  });
});

describe("extractTauBenchEntries", () => {
  it("keeps the best verified standard submission per model", () => {
    const entries = extractTauBenchEntries([
      {
        model_name: "Claude Opus 4.5",
        submission_date: "2026-02-26",
        submission_type: "standard",
        methodology: {
          verification: {
            modified_prompts: false,
            omitted_questions: false,
          },
        },
        results: {
          airline: { pass_1: 84 },
          retail: { pass_1: 79.61 },
          telecom: { pass_1: 92.32 },
          banking_knowledge: { pass_1: 24.74 },
        },
      },
      {
        model_name: "Claude Opus 4.5",
        submission_date: "2026-02-20",
        submission_type: "standard",
        methodology: {
          verification: {
            modified_prompts: false,
            omitted_questions: false,
          },
        },
        results: {
          airline: { pass_1: 70 },
          retail: { pass_1: 60 },
        },
      },
      {
        model_name: "Custom Agent",
        submission_date: "2026-02-20",
        submission_type: "custom",
        methodology: {
          verification: {
            modified_prompts: false,
            omitted_questions: false,
          },
        },
        results: {
          airline: { pass_1: 99 },
        },
      },
    ]);

    expect(entries).toEqual([
      {
        matchNames: ["Claude Opus 4.5"],
        score: 70.17,
        evaluationDate: "2026-02-26",
      },
    ]);
  });
});
