import { describe, expect, it } from "vitest";

import { __testables } from "./vision-arena";

const VISION_TABLE_HTML = `
<table>
  <tbody>
    <tr>
      <td>1</td>
      <td><div><span>1</span><span>4</span></div></td>
      <td>
        <div>
          <div>
            <a href="https://example.com/gemini-3-pro">gemini-3-pro</a>
          </div>
          <div>Google · Proprietary</div>
        </div>
      </td>
      <td><div><span>1288</span><span>±8</span></div></td>
      <td>12,595</td>
      <td>$2 / $12</td>
      <td>1M</td>
    </tr>
    <tr>
      <td>9</td>
      <td><div><span>5</span><span>15</span></div></td>
      <td>
        <div>
          <div>
            <a href="https://example.com/gemini-2-5-pro">gemini-2.5-pro</a>
          </div>
          <div>Google · Proprietary</div>
        </div>
      </td>
      <td><div><span>1248</span><span>±6</span></div></td>
      <td>81,050</td>
      <td>$1.25 / $10</td>
      <td>1M</td>
    </tr>
  </tbody>
</table>
`;

describe("vision-arena helpers", () => {
  it("extracts elo-style rows from the official leaderboard table", () => {
    const rows = __testables.extractVisionArenaRows(VISION_TABLE_HTML);

    expect(rows).toEqual([
      expect.objectContaining({
        modelName: "gemini-3-pro",
        aliases: expect.arrayContaining(["gemini-3-pro", "gemini 3 pro"]),
        eloScore: 1288,
        confidenceIntervalLow: 1280,
        confidenceIntervalHigh: 1296,
        votes: 12595,
        rank: 1,
        metadata: expect.objectContaining({
          sourceUrl: "https://example.com/gemini-3-pro",
        }),
      }),
      expect.objectContaining({
        modelName: "gemini-2.5-pro",
        aliases: expect.arrayContaining(["gemini-2.5-pro", "gemini 2.5 pro"]),
        eloScore: 1248,
        confidenceIntervalLow: 1242,
        confidenceIntervalHigh: 1254,
        votes: 81050,
        rank: 9,
      }),
    ]);
  });
});
