import { describe, expect, it } from "vitest";
import { extractAgentTaskModelMetadata } from "./task-model-metadata";

describe("extractAgentTaskModelMetadata", () => {
  it("extracts direct llm metadata", () => {
    expect(
      extractAgentTaskModelMetadata({
        llmProvider: "openrouter",
        llmModel: "minimax/minimax-m2.5",
      })
    ).toEqual({
      provider: "openrouter",
      model: "minimax/minimax-m2.5",
    });
  });

  it("extracts nested metadata from analysis results", () => {
    expect(
      extractAgentTaskModelMetadata({
        analysisResults: [
          {
            llmProvider: "minimax",
            llmModel: "MiniMax-M2.5",
          },
        ],
      })
    ).toEqual({
      provider: "minimax",
      model: "MiniMax-M2.5",
    });
  });

  it("returns nulls when no metadata exists", () => {
    expect(
      extractAgentTaskModelMetadata({
        summary: { issuesScanned: 4 },
      })
    ).toEqual({
      provider: null,
      model: null,
    });
  });
});
