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

describe("workspace deployment API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    eq.mockImplementation(() => ({
      eq,
      maybeSingle,
    }));
    selectSingle.mockImplementation(() => ({
      single: vi.fn().mockResolvedValue({
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
      }),
    }));
    upsertSelect.mockImplementation(() => ({
      single: selectSingle,
    }));
    upsert.mockImplementation(() => ({
      select: upsertSelect,
    }));

    from.mockImplementation((table: string) => {
      if (table === "workspace_runtimes" || table === "workspace_deployments") {
        return {
          select: () => ({
            eq,
            maybeSingle,
          }),
          upsert,
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
    maybeSingle.mockResolvedValue({ data: null, error: null });

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
});
