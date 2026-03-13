import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../provider-router", () => ({
  callAgentModel: vi.fn(),
}));

describe("analyzeErrorPatternWithModel", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("parses structured JSON analysis and preserves provider metadata", async () => {
    const { callAgentModel } = await import("../provider-router");
    vi.mocked(callAgentModel).mockResolvedValueOnce({
      content: JSON.stringify({
        rootCause: "A stale join assumption caused the failure.",
        severity: "high",
        suggestedFix: "Use the paginated helper for the source query.",
        issueTitle: "Fix stale join assumption in health path",
      }),
      provider: "deepseek",
      model: "deepseek-chat",
      usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
      raw: {},
    });

    const { analyzeErrorPatternWithModel } = await import("./code-quality");

    const result = await analyzeErrorPatternWithModel({
      message: "Failed to fetch data sources: Bad Request",
      count: 4,
      firstSeen: "2026-03-13T00:00:00.000Z",
      lastSeen: "2026-03-13T01:00:00.000Z",
      sampleMetadata: { route: "/api/health" },
    });

    expect(result).toEqual(
      expect.objectContaining({
        severity: "high",
        issueTitle: "Fix stale join assumption in health path",
        llmProvider: "deepseek",
        llmModel: "deepseek-chat",
      })
    );
  });
});
