import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const single = vi.fn();
const runtimeSingle = vi.fn();
const eq = vi.fn();
const updateEq = vi.fn();
const update = vi.fn();
const from = vi.fn();
const findOrCreateConversation = vi.fn();
const getMessages = vi.fn();
const sendMessage = vi.fn();
const generateAgentResponse = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser,
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from,
  }),
}));

vi.mock("@/lib/agents/chat", () => ({
  findOrCreateConversation: (...args: unknown[]) => findOrCreateConversation(...args),
  getMessages: (...args: unknown[]) => getMessages(...args),
  sendMessage: (...args: unknown[]) => sendMessage(...args),
  generateAgentResponse: (...args: unknown[]) => generateAgentResponse(...args),
}));

describe("POST /api/workspace/chat", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    single.mockResolvedValue({
      data: {
        id: "agent-1",
        slug: "pipeline-engineer",
        name: "Pipeline Engineer",
        status: "active",
        total_conversations: 5,
      },
      error: null,
    });
    eq.mockImplementation(() => ({
      eq,
      single,
    }));
    updateEq.mockResolvedValue({ error: null });
    update.mockImplementation(() => ({
      eq: updateEq,
    }));
    from.mockImplementation((table: string) => {
      if (table === "agents") {
        return {
          select: () => ({
            eq,
          }),
          update,
        };
      }
      if (table === "agent_conversations") {
        return {
          select: () => ({
            eq: () => ({
              single,
            }),
          }),
        };
      }
      if (table === "workspace_runtimes") {
        return {
          select: () => ({
            eq: () => ({
              single: runtimeSingle,
            }),
          }),
          update,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("rejects unauthenticated requests", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://aimarketcap.tech/api/workspace/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("creates a session-authenticated agent reply", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    findOrCreateConversation.mockResolvedValue({
      conversation: { id: "conversation-1" },
      created: true,
    });
    sendMessage.mockResolvedValue({
      id: "msg-1",
      content: "How do I start?",
    });
    generateAgentResponse.mockResolvedValue({
      id: "msg-2",
      content: "Open wallet first, then create API keys.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://aimarketcap.tech/api/workspace/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "How do I start?" }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.conversation_id).toBe("conversation-1");
    expect(body.response.content).toContain("Open wallet first");
    expect(findOrCreateConversation).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalled();
    expect(generateAgentResponse).toHaveBeenCalledWith(
      expect.anything(),
      "pipeline-engineer",
      "conversation-1",
      "How do I start?"
    );
  });

  it("returns the transcript for a user-owned workspace conversation", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    single.mockResolvedValueOnce({
      data: {
        id: "conversation-1",
        participant_a: "user-1",
        participant_b: "agent-1",
      },
      error: null,
    });
    getMessages.mockResolvedValue([
      {
        id: "msg-1",
        sender_type: "user",
        content: "How do I start?",
        metadata: null,
        created_at: "2026-04-01T10:00:00.000Z",
      },
      {
        id: "msg-2",
        sender_type: "agent",
        content: "Open wallet first.",
        metadata: {
          usage: {
            inputTokens: 20,
            outputTokens: 10,
            totalTokens: 30,
          },
        },
        created_at: "2026-04-01T10:00:05.000Z",
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://aimarketcap.tech/api/workspace/chat?conversation_id=conversation-1")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.messages).toHaveLength(2);
    expect(getMessages).toHaveBeenCalledWith(expect.anything(), "conversation-1", 100);
  });

  it("tracks usage against an attached workspace runtime", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    findOrCreateConversation.mockResolvedValue({
      conversation: { id: "conversation-1" },
      created: false,
    });
    runtimeSingle.mockResolvedValue({
      data: {
        id: "runtime-1",
        user_id: "user-1",
        total_requests: 4,
        total_tokens: 100,
      },
      error: null,
    });
    sendMessage.mockResolvedValue({
      id: "msg-1",
      content: "How do I start?",
    });
    generateAgentResponse.mockResolvedValue({
      id: "msg-2",
      content: "Open wallet first, then create API keys.",
      metadata: {
        usage: {
          totalTokens: 30,
        },
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://aimarketcap.tech/api/workspace/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "How do I start?",
          runtime_id: "runtime-1",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        total_requests: 5,
        total_tokens: 130,
      })
    );
  });
});
