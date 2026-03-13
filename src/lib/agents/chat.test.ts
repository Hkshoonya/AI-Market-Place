import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./provider-router", () => ({
  callAgentModel: vi.fn(),
}));

describe("generateAgentReply", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("routes agent chat through the shared provider router and keeps provider metadata", async () => {
    const { callAgentModel } = await import("./provider-router");
    vi.mocked(callAgentModel).mockResolvedValueOnce({
      content: "Hello from the router",
      provider: "openrouter",
      model: "openai/gpt-4.1-mini",
      usage: { inputTokens: 12, outputTokens: 9, totalTokens: 21 },
      raw: {},
    });

    const { generateAgentReply } = await import("./chat");

    const result = await generateAgentReply(
      {
        id: "agent-1",
        name: "Pipeline Engineer",
        description: "Maintains the platform data pipeline.",
        capabilities: ["health_check", "sync_repair"],
      },
      [
        {
          sender_id: "user-1",
          sender_type: "user",
          content: "Can you help?",
        },
      ],
      "Investigate the latest failure."
    );

    expect(callAgentModel).toHaveBeenCalledTimes(1);
    expect(result.content).toBe("Hello from the router");
    expect(result.metadata).toEqual(
      expect.objectContaining({
        provider: "openrouter",
        model: "openai/gpt-4.1-mini",
      })
    );
  });
});
