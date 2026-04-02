import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const runtimeMaybeSingle = vi.fn();
const deploymentMaybeSingle = vi.fn();
const deploymentSingle = vi.fn();
const runtimeEqSecond = vi.fn();
const runtimeEqFirst = vi.fn();
const deploymentEqSecond = vi.fn();
const deploymentEqFirst = vi.fn();
const upsert = vi.fn();
const upsertSelect = vi.fn();
const update = vi.fn();
const updateEq = vi.fn();
const updateSelect = vi.fn();
const insert = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser,
    },
    from,
  }),
}));

describe("workspace deployment API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();

    runtimeEqSecond.mockImplementation(() => ({
      maybeSingle: runtimeMaybeSingle,
    }));
    runtimeEqFirst.mockImplementation(() => ({
      eq: runtimeEqSecond,
    }));
    deploymentEqSecond.mockImplementation(() => ({
      maybeSingle: deploymentMaybeSingle,
      single: deploymentSingle,
    }));
    deploymentEqFirst.mockImplementation(() => ({
      eq: deploymentEqSecond,
    }));

    const singleResolved = vi.fn().mockResolvedValue({
        data: {
          id: "entity-1",
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
          total_requests: 0,
          total_tokens: 0,
          last_used_at: null,
          updated_at: "2026-04-01T13:30:00.000Z",
        },
        error: null,
      });
    upsertSelect.mockImplementation(() => ({
      single: singleResolved,
    }));
    upsert.mockImplementation(() => ({
      select: upsertSelect,
    }));
    updateSelect.mockImplementation(() => ({
      single: singleResolved,
    }));
    update.mockImplementation(() => ({
      eq: updateEq.mockImplementation(() => ({
        select: updateSelect,
      })),
    }));
    insert.mockResolvedValue({ error: null });

    from.mockImplementation((table: string) => {
      if (table === "workspace_runtimes") {
        return {
          select: () => ({
            eq: runtimeEqFirst,
          }),
          upsert,
          update,
        };
      }

      if (table === "workspace_deployments") {
        return {
          select: () => ({
            eq: deploymentEqFirst,
          }),
          upsert,
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

  it("creates a deployment and paired runtime for a signed-in user", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    runtimeMaybeSingle.mockResolvedValue({ data: null, error: null });
    deploymentMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://aimarketcap.tech/api/workspace/deployment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelSlug: "openai-gpt-4-1",
          modelName: "GPT-4.1",
          providerName: "ChatGPT Plus",
          creditsBudget: 20,
          monthlyPriceEstimate: 20,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalled();
    const body = await response.json();
    expect(body.deployment.endpointPath).toBe("/api/deployments/openai-gpt-4-1-abc12345");
  });

  it("rejects models without a mapped in-site runtime", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://aimarketcap.tech/api/workspace/deployment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelSlug: "kimi-k2",
          modelName: "Kimi K2",
          providerName: "Moonshot API",
          creditsBudget: 20,
          monthlyPriceEstimate: 20,
        }),
      })
    );

    expect(response.status).toBe(422);
    expect(upsert).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error).toMatch(/Direct in-site deployment is not available/i);
  });

  it("pauses an existing deployment", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    deploymentSingle.mockResolvedValue({
      data: {
        id: "entity-1",
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
        total_tokens: 500,
        last_used_at: null,
        updated_at: "2026-04-01T13:30:00.000Z",
      },
      error: null,
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("https://aimarketcap.tech/api/workspace/deployment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelSlug: "openai-gpt-4-1",
          action: "pause",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ status: "paused" });
    const body = await response.json();
    expect(body.update.message).toMatch(/Deployment paused/i);
  });
});
