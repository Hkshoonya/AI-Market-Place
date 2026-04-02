import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthUser = vi.fn();
const deploymentSingle = vi.fn();
const runtimeSingle = vi.fn();
const deploymentEqSecond = vi.fn();
const deploymentEqFirst = vi.fn();
const runtimeEq = vi.fn();
const updateEq = vi.fn();
const update = vi.fn();
const insert = vi.fn();
const from = vi.fn();
const callAgentModel = vi.fn();
const getWalletByOwner = vi.fn();
const debitWallet = vi.fn();
const creditWallet = vi.fn();

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

vi.mock("@/lib/payments/wallet", () => ({
  getWalletByOwner: (...args: unknown[]) => getWalletByOwner(...args),
  debitWallet: (...args: unknown[]) => debitWallet(...args),
  creditWallet: (...args: unknown[]) => creditWallet(...args),
}));

describe("POST /api/deployments/[endpointSlug]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();

    updateEq.mockResolvedValue({ error: null });
    update.mockImplementation(() => ({
      eq: updateEq,
    }));
    getWalletByOwner.mockResolvedValue({
      id: "wallet-1",
      balance: 100,
    });
    debitWallet.mockResolvedValue("tx-1");
    creditWallet.mockResolvedValue("refund-1");
    insert.mockResolvedValue({ error: null });

    deploymentEqSecond.mockImplementation(() => ({
      single: deploymentSingle,
    }));
    deploymentEqFirst.mockImplementation(() => ({
      eq: deploymentEqSecond,
    }));
    runtimeEq.mockImplementation(() => ({
      single: runtimeSingle,
    }));

    from.mockImplementation((table: string) => {
      if (table === "workspace_deployments") {
        return {
          select: () => ({
            eq: deploymentEqFirst,
          }),
          update,
        };
      }

      if (table === "workspace_runtimes") {
        return {
          select: () => ({
            eq: runtimeEq,
          }),
          update,
        };
      }

      if (table === "workspace_deployment_events") {
        return {
          insert,
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

    deploymentSingle
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
      .mockResolvedValueOnce({ data: null, error: null });
    runtimeSingle.mockResolvedValueOnce({
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

  it("blocks paused deployments", async () => {
    resolveAuthUser.mockResolvedValue({
      userId: "user-1",
      authMethod: "api_key",
      apiKeyId: "key-1",
      apiKeyScopes: ["agent"],
    });

    deploymentSingle.mockResolvedValueOnce({
      data: {
        id: "deployment-1",
        runtime_id: "runtime-1",
        model_slug: "openai-gpt-4-1",
        model_name: "GPT-4.1",
        provider_name: "ChatGPT Plus",
        status: "paused",
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

    expect(response.status).toBe(409);
    expect(callAgentModel).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error).toMatch(/paused/i);
  });

  it("blocks requests when the deployment budget is exhausted", async () => {
    resolveAuthUser.mockResolvedValue({
      userId: "user-1",
      authMethod: "api_key",
      apiKeyId: "key-1",
      apiKeyScopes: ["agent"],
    });

    deploymentSingle.mockResolvedValueOnce({
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
        credits_budget: 0.01,
        monthly_price_estimate: 20,
        total_requests: 0,
        total_tokens: 0,
        last_used_at: null,
        updated_at: "2026-04-01T13:30:00.000Z",
      },
      error: null,
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

    expect(response.status).toBe(402);
    expect(debitWallet).not.toHaveBeenCalled();
    expect(callAgentModel).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error).toMatch(/budget exhausted/i);
  });
});
