import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthUser = vi.fn();
const single = vi.fn();
const eq = vi.fn();
const updateEq = vi.fn();
const update = vi.fn();
const from = vi.fn();
const findOrCreateConversation = vi.fn();
const sendMessage = vi.fn();
const generateAgentResponse = vi.fn();

vi.mock("@/lib/auth/resolve-user", () => ({
  resolveAuthUser: (...args: unknown[]) => resolveAuthUser(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from,
  }),
}));

vi.mock("@/lib/agents/chat", () => ({
  findOrCreateConversation: (...args: unknown[]) => findOrCreateConversation(...args),
  sendMessage: (...args: unknown[]) => sendMessage(...args),
  generateAgentResponse: (...args: unknown[]) => generateAgentResponse(...args),
}));

describe("POST /api/runtime/[endpointSlug]/assistant", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    updateEq.mockResolvedValue({ error: null });
    update.mockImplementation(() => ({
      eq: updateEq,
    }));
    eq.mockImplementation(() => ({
      eq,
      single,
    }));
    from.mockImplementation((table: string) => {
      if (table === "workspace_runtimes") {
        return {
          select: () => ({
            eq,
          }),
          update,
        };
      }
      if (table === "agents") {
        return {
          select: () => ({
            eq,
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("uses the runtime's stored conversation and returns an assistant reply", async () => {
    resolveAuthUser.mockResolvedValue({
      userId: "user-1",
      authMethod: "api_key",
      apiKeyId: "key-1",
      apiKeyScopes: ["agent"],
    });

    single
      .mockResolvedValueOnce({
        data: {
          id: "runtime-1",
          model_slug: "openai-gpt-4-1",
          model_name: "GPT-4.1",
          provider_name: "ChatGPT Plus",
          endpoint_slug: "openai-gpt-4-1-abc12345",
          total_requests: 4,
          total_tokens: 120,
          workspace_conversation_id: "conversation-1",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "agent-1",
          slug: "pipeline-engineer",
          name: "Pipeline Engineer",
          status: "active",
          total_conversations: 3,
        },
        error: null,
      });

    sendMessage.mockResolvedValue({
      id: "msg-1",
      content: "Help me start",
    });
    generateAgentResponse.mockResolvedValue({
      id: "msg-2",
      content: "Start with wallet and API keys.",
      metadata: {
        usage: { totalTokens: 40 },
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://aimarketcap.tech/api/runtime/openai-gpt-4-1-abc12345/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Help me start" }),
      }) as never,
      { params: Promise.resolve({ endpointSlug: "openai-gpt-4-1-abc12345" }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.conversation_id).toBe("conversation-1");
    expect(body.runtime.assistantPath).toBe("/api/runtime/openai-gpt-4-1-abc12345/assistant");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        total_requests: 5,
        total_tokens: 160,
      })
    );
    expect(findOrCreateConversation).not.toHaveBeenCalled();
  });

  it("rejects cross-origin session assistant requests", async () => {
    resolveAuthUser.mockResolvedValue({
      userId: "user-1",
      authMethod: "session",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://aimarketcap.tech/api/runtime/openai-gpt-4-1-abc12345/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ message: "Help me start" }),
      }) as never,
      { params: Promise.resolve({ endpointSlug: "openai-gpt-4-1-abc12345" }) }
    );

    expect(response.status).toBe(403);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(generateAgentResponse).not.toHaveBeenCalled();
  });
});
