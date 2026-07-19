import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;

describe("resolveAvailableWorkspaceRuntimeExecution", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalOpenRouterApiKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
    }
  });

  it("keeps a mapped model runnable when OpenRouter currently offers it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "openai/gpt-4.1",
                pricing: { prompt: "0.000002", completion: "0.000008" },
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );
    const { resolveAvailableWorkspaceRuntimeExecution } = await import(
      "./runtime-availability"
    );

    await expect(
      resolveAvailableWorkspaceRuntimeExecution("openai-gpt-4-1")
    ).resolves.toMatchObject({
      available: true,
      provider: "openrouter",
      model: "openai/gpt-4.1",
      pricing: {
        inputPerToken: 0.000002,
        outputPerToken: 0.000008,
        request: 0,
        currency: "USD",
        source: "openrouter",
      },
    });
  });

  it("fails closed when a statically mapped model is absent from OpenRouter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    const { resolveAvailableWorkspaceRuntimeExecution } = await import(
      "./runtime-availability"
    );

    await expect(
      resolveAvailableWorkspaceRuntimeExecution("openai-gpt-4-1")
    ).resolves.toMatchObject({
      available: false,
      provider: null,
      model: null,
    });
  });

  it("fails closed when provider availability cannot be verified", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const { resolveAvailableWorkspaceRuntimeExecution } = await import(
      "./runtime-availability"
    );

    const result = await resolveAvailableWorkspaceRuntimeExecution("openai-gpt-4-1");
    expect(result.available).toBe(false);
    expect(result.summary).toContain("could not verify");
  });

  it("shares one provider catalog request across concurrent model checks", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "openai/gpt-4.1" }, { id: "anthropic/claude-opus-4-6" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const { resolveAvailableWorkspaceRuntimeExecution } = await import(
      "./runtime-availability"
    );

    const [openAi, anthropic] = await Promise.all([
      resolveAvailableWorkspaceRuntimeExecution("openai-gpt-4-1"),
      resolveAvailableWorkspaceRuntimeExecution("anthropic-claude-opus-4-6"),
    ]);

    expect(openAi.available).toBe(true);
    expect(anthropic.available).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not reuse the platform catalog for a user-provided key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "openai/gpt-4.1" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const { resolveAvailableWorkspaceRuntimeExecution } = await import(
      "./runtime-availability"
    );

    const platformResult = await resolveAvailableWorkspaceRuntimeExecution(
      "openai-gpt-4-1"
    );
    const userResult = await resolveAvailableWorkspaceRuntimeExecution(
      "openai-gpt-4-1",
      { openRouterApiKey: "user-openrouter-key" }
    );

    expect(platformResult.available).toBe(true);
    expect(userResult.available).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer test-openrouter-key" }),
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer user-openrouter-key" }),
    });
  });
});
