import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const single = vi.fn();
const eq = vi.fn();
const updateEq = vi.fn();
const update = vi.fn();
const from = vi.fn();
const findOrCreateConversation = vi.fn();
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
});
