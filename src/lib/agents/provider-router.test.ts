import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("callAgentModel", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.MINIMAX_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("prefers OpenRouter when configured", async () => {
    process.env.OPENROUTER_API_KEY = "openrouter-key";

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "openrouter response" } }],
          model: "openai/gpt-4.1-mini",
          usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const { callAgentModel } = await import("./provider-router");

    const result = await callAgentModel({
      system: "You are a test agent.",
      prompt: "Say hello.",
    });

    expect(result.provider).toBe("openrouter");
    expect(result.content).toBe("openrouter response");
    expect(result.model).toBe("openai/gpt-4.1-mini");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to DeepSeek when OpenRouter fails", async () => {
    process.env.OPENROUTER_API_KEY = "openrouter-key";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "router unavailable" } }), {
          status: 503,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "deepseek response" } }],
            model: "deepseek-chat",
            usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

    const { callAgentModel } = await import("./provider-router");

    const result = await callAgentModel({
      system: "You are a test agent.",
      prompt: "Say hello.",
    });

    expect(result.provider).toBe("deepseek");
    expect(result.content).toBe("deepseek response");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to MiniMax when earlier providers are unavailable", async () => {
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.MINIMAX_API_KEY = "minimax-key";

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "rate limited" } }), {
          status: 429,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "minimax response" } }],
            model: "MiniMax-M2.5",
            usage: { prompt_tokens: 2, completion_tokens: 4, total_tokens: 6 },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

    const { callAgentModel } = await import("./provider-router");

    const result = await callAgentModel({
      system: "You are a test agent.",
      prompt: "Say hello.",
    });

    expect(result.provider).toBe("minimax");
    expect(result.content).toBe("minimax response");
    expect(result.usage?.totalTokens).toBe(6);
  });

  it("throws a useful error when no providers are configured", async () => {
    const { callAgentModel } = await import("./provider-router");

    await expect(
      callAgentModel({
        system: "You are a test agent.",
        prompt: "Say hello.",
      })
    ).rejects.toThrow(/No agent model providers are configured/i);
  });
});
