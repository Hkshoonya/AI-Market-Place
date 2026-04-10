import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearReplicateCatalogCacheForTests } from "@/lib/workspace/external-deployment";

const getUser = vi.fn();
const runtimeMaybeSingle = vi.fn();
const deploymentMaybeSingle = vi.fn();
const deploymentSingle = vi.fn();
const modelSingle = vi.fn();
const runtimeEqSecond = vi.fn();
const runtimeEqFirst = vi.fn();
const deploymentEqSecond = vi.fn();
const deploymentEqFirst = vi.fn();
const modelEq = vi.fn();
const upsert = vi.fn();
const upsertSelect = vi.fn();
const update = vi.fn();
const updateEq = vi.fn();
const updateSelect = vi.fn();
const deleteRows = vi.fn();
const deleteEqFirst = vi.fn();
const deleteEqSecond = vi.fn();
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
    modelEq.mockImplementation(() => ({
      single: modelSingle,
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
    deleteRows.mockImplementation(() => ({
      eq: deleteEqFirst,
    }));
    deleteEqFirst.mockImplementation(() =>
      Object.assign(Promise.resolve({ error: null }), {
        eq: deleteEqSecond,
      })
    );
    deleteEqSecond.mockResolvedValue({ error: null });
    insert.mockResolvedValue({ error: null });

    from.mockImplementation((table: string) => {
      if (table === "workspace_runtimes") {
        return {
          select: () => ({
            eq: runtimeEqFirst,
          }),
          upsert,
          update,
          delete: deleteRows,
        };
      }

      if (table === "workspace_deployments") {
        return {
          select: () => ({
            eq: deploymentEqFirst,
          }),
          upsert,
          update,
          delete: deleteRows,
        };
      }

      if (table === "workspace_deployment_events") {
        return {
          insert,
        };
      }

      if (table === "models") {
        return {
          select: () => ({
            eq: modelEq,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    modelSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    clearReplicateCatalogCacheForTests();
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
    expect(body.deployment.providerName).toBe("AI Market Cap");
    expect(body.deployment.deploymentLabel).toBe("AI Market Cap managed runtime");
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
    expect(body.error).toMatch(/one-click deployment is not available/i);
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

  it("creates a hosted Hugging Face deployment when warm inference is available", async () => {
    process.env.HUGGINGFACE_API_TOKEN = "hf-test-token";
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    runtimeMaybeSingle.mockResolvedValue({ data: null, error: null });
    deploymentMaybeSingle.mockResolvedValue({ data: null, error: null });
    modelSingle.mockResolvedValue({
      data: {
        slug: "qwen-qwen2-5-7b-instruct",
        name: "Qwen2.5 7B Instruct",
        provider: "Qwen",
        category: "llm",
        parameter_count: null,
        hf_model_id: "Qwen/Qwen2.5-7B-Instruct",
      },
      error: null,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "Qwen/Qwen2.5-7B-Instruct",
            inference: "warm",
            pipeline_tag: "text-generation",
            disabled: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    upsertSelect.mockImplementationOnce(() => ({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "deployment-1",
          runtime_id: null,
          model_slug: "qwen-qwen2-5-7b-instruct",
          model_name: "Qwen2.5 7B Instruct",
          provider_name: "Qwen",
          status: "ready",
          endpoint_slug: "qwen-qwen2-5-7b-instruct-abc12345",
          deployment_kind: "hosted_external",
          deployment_label: "Hugging Face hosted inference",
          external_platform_slug: "huggingface",
          external_provider: "huggingface",
          external_owner: "Qwen",
          external_name: "Qwen2.5-7B-Instruct",
          external_model_ref: "Qwen/Qwen2.5-7B-Instruct",
          external_web_url: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct",
          credits_budget: 20,
          monthly_price_estimate: 20,
          total_requests: 0,
          successful_requests: 0,
          failed_requests: 0,
          total_tokens: 0,
          avg_response_latency_ms: null,
          last_response_latency_ms: null,
          last_used_at: null,
          last_success_at: null,
          last_error_at: null,
          last_error_message: null,
          updated_at: "2026-04-01T13:30:00.000Z",
        },
        error: null,
      }),
    }));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://aimarketcap.tech/api/workspace/deployment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelSlug: "qwen-qwen2-5-7b-instruct",
          modelName: "Qwen2.5 7B Instruct",
          providerName: "Qwen",
          creditsBudget: 20,
          monthlyPriceEstimate: 20,
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.deployment.deploymentKind).toBe("hosted_external");
    expect(body.deployment.providerName).toBe("AI Market Cap");
    expect(body.deployment.deploymentLabel).toBe("AI Market Cap hosted deployment");
    expect(body.deployment.target.provider).toBe("huggingface");
    expect(body.activation.message).toMatch(/AI Market Cap endpoint/i);
  });

  it("removes a managed deployment and its runtime", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    deploymentSingle.mockResolvedValue({
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
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        total_tokens: 0,
        avg_response_latency_ms: null,
        last_response_latency_ms: null,
        last_used_at: null,
        last_success_at: null,
        last_error_at: null,
        last_error_message: null,
        updated_at: "2026-04-01T13:30:00.000Z",
      },
      error: null,
    });
    deleteEqFirst.mockResolvedValueOnce({ error: null });
    deleteEqSecond.mockResolvedValueOnce({ error: null });

    const { DELETE } = await import("./route");
    const response = await DELETE(
      new Request("https://aimarketcap.tech/api/workspace/deployment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelSlug: "openai-gpt-4-1",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(deleteRows).toHaveBeenCalledTimes(2);
    const body = await response.json();
    expect(body.removed).toBe(true);
    expect(body.message).toMatch(/removed/i);
  });
});
