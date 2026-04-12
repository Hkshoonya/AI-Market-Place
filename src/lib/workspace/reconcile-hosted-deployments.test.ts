import { describe, expect, it, vi } from "vitest";

import { reconcileHostedDeployments } from "./reconcile-hosted-deployments";

vi.mock("@/lib/workspace/external-deployment", () => ({
  refreshHostedDeploymentStatus: (...args: unknown[]) => mockRefreshHostedDeploymentStatus(...args),
}));

const mockRefreshHostedDeploymentStatus = vi.fn();

function createAdmin(deployments: Array<Record<string, unknown>>) {
  const updateSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateSelect = vi.fn(() => ({ single: updateSingle }));
  const updateEq = vi.fn(() => ({ select: updateSelect }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const selectLimit = vi.fn().mockResolvedValue({ data: deployments, error: null });
  const selectOrder = vi.fn(() => ({ limit: selectLimit }));
  const selectEq = vi.fn(() => ({ order: selectOrder }));
  const select = vi.fn(() => ({ eq: selectEq }));

  return {
    admin: {
      from: vi.fn(() => ({
        select,
        update,
      })),
    },
    update,
    updateEq,
    updateSelect,
    updateSingle,
  };
}

describe("reconcileHostedDeployments", () => {
  it("updates changed hosted deployments and leaves unchanged ones alone", async () => {
    const deployment = {
      id: "deployment-1",
      runtime_id: null,
      model_slug: "meta-llama-3-3-70b-instruct",
      model_name: "Llama 3.3 70B Instruct",
      provider_name: "AI Market Cap",
      status: "provisioning",
      endpoint_slug: "slug",
      deployment_kind: "hosted_external",
      deployment_label: "AI Market Cap dedicated runtime",
      external_platform_slug: "replicate",
      external_provider: "replicate",
      external_owner: "aimarketcap",
      external_name: "deployment-name",
      external_model_ref: null,
      external_web_url: null,
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
      updated_at: "2026-04-10T13:00:00.000Z",
    };
    const { admin, update } = createAdmin([deployment]);
    mockRefreshHostedDeploymentStatus.mockResolvedValue({
      status: "ready",
      externalWebUrl: "https://example.com/deployment-name",
      externalModelRef: "meta/llama-3.3-70b-instruct",
      errorMessage: null,
    });

    const result = await reconcileHostedDeployments(admin as never);

    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.unchanged).toBe(0);
    expect(result.errors).toEqual([]);
    expect(update).toHaveBeenCalled();
  });
});
