import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const maybeSingle = vi.fn();
const selectSingle = vi.fn();
const eq = vi.fn();
const upsert = vi.fn();
const upsertSelect = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser,
    },
    from,
  }),
}));

describe("workspace runtime API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    eq.mockImplementation(() => ({
      eq,
      maybeSingle,
    }));
    selectSingle.mockResolvedValue({
      data: {
        id: "runtime-1",
        model_slug: "openai-gpt-4-1",
        model_name: "GPT-4.1",
        provider_name: "ChatGPT Plus",
        status: "ready",
        endpoint_slug: "openai-gpt-4-1-abc12345",
        total_requests: 0,
        total_tokens: 0,
        last_used_at: null,
        updated_at: "2026-04-01T13:30:00.000Z",
      },
      error: null,
    });
    upsertSelect.mockImplementation(() => ({
      single: selectSingle,
    }));
    upsert.mockImplementation(() => ({
      select: upsertSelect,
    }));

    from.mockImplementation((table: string) => {
      if (table !== "workspace_runtimes") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: () => ({
          eq,
          maybeSingle,
        }),
        upsert,
      };
    });
  });

  it("returns a saved runtime for the signed-in user", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    maybeSingle.mockResolvedValue({
      data: {
        id: "runtime-1",
        model_slug: "openai-gpt-4-1",
        model_name: "GPT-4.1",
        provider_name: "ChatGPT Plus",
        status: "ready",
        endpoint_slug: "openai-gpt-4-1-abc12345",
        total_requests: 3,
        total_tokens: 1200,
        last_used_at: "2026-04-01T13:00:00.000Z",
        updated_at: "2026-04-01T13:30:00.000Z",
      },
      error: null,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://aimarketcap.tech/api/workspace/runtime?modelSlug=openai-gpt-4-1")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.runtime?.endpointPath).toBe("/api/runtime/openai-gpt-4-1-abc12345");
    expect(body.runtime?.totalRequests).toBe(3);
  });

  it("prepares a runtime for the signed-in user", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://aimarketcap.tech/api/workspace/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelSlug: "openai-gpt-4-1",
          modelName: "GPT-4.1",
          providerName: "ChatGPT Plus",
          conversationId: "conversation-1",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        model_slug: "openai-gpt-4-1",
        workspace_conversation_id: "conversation-1",
        status: "ready",
      }),
      { onConflict: "user_id,model_slug" }
    );
  });
});
