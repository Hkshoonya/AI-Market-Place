import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthUser = vi.fn();
const single = vi.fn();
const eq = vi.fn();
const updateEq = vi.fn();
const update = vi.fn();
const from = vi.fn();
const callAgentModel = vi.fn();

vi.mock("@/lib/auth/resolve-user", () => ({
  resolveAuthUser: (...args: unknown[]) => resolveAuthUser(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from,
  }),
}));

vi.mock("@/lib/agents/provider-router", () => ({
  callAgentModel: (...args: unknown[]) => callAgentModel(...args),
}));

describe("POST /api/deployments/[endpointSlug]", () => {
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
      if (table === "workspace_deployments" || table === "workspace_runtimes") {
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

  it("runs a prompt through a ready deployment", async () => {
    resolveAuthUser.mockResolvedValue({
      userId: "user-1",
      authMethod: "api_key",
      apiKeyId: "key-1",
      apiKeyScopes: ["agent"],
    });

    single
      .mockResolvedValueOnce({
        data: {
          id: "deployment-1",
          runtime_id: "runtime-1",
          model_slug: "openai-gpt-4-1",
          model_name: "GPT-4.1",
          provider_name: "ChatGPT Plus",
          status: "ready",
          endpoint_slug: "openai-gpt-4-1-abc12345",
          deployment_kind: "managed_api",
          deployment_label: "OpenRouter-backed runtime",
          credits_budget: 20,
          monthly_price_estimate: 20,
          total_requests: 2,
          total_tokens: 90,
          last_used_at: null,
          updated_at: "2026-04-01T13:30:00.000Z",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "runtime-1",
          total_requests: 3,
          total_tokens: 120,
        },
        error: null,
      });

    callAgentModel.mockResolvedValue({
      content: "Hello from GPT-4.1",
      provider: "openrouter",
      model: "openai/gpt-4.1",
      usage: { totalTokens: 25, inputTokens: 10, outputTokens: 15 },
      raw: {},
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://aimarketcap.tech/api/deployments/openai-gpt-4-1-abc12345", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello" }),
      }) as never,
      { params: Promise.resolve({ endpointSlug: "openai-gpt-4-1-abc12345" }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.response.content).toBe("Hello from GPT-4.1");
    expect(body.deployment.endpointPath).toBe("/api/deployments/openai-gpt-4-1-abc12345");
  });
});
