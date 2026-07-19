import { describe, expect, it } from "vitest";

import type { WorkspaceDeploymentRecord } from "./deployment-summary";
import { toWorkspaceDeploymentResponse } from "./deployment-summary";

function deployment(
  overrides: Partial<WorkspaceDeploymentRecord> = {}
): WorkspaceDeploymentRecord {
  return {
    id: "deployment-1",
    user_id: "user-1",
    runtime_id: null,
    model_slug: "meta-llama-3-3-70b-instruct",
    model_name: "Llama 3.3 70B Instruct",
    provider_name: "Meta",
    status: "ready",
    endpoint_slug: "meta-llama-3-3-70b-instruct-abc12345",
    deployment_kind: "hosted_external",
    deployment_label: "Dedicated runtime in your Replicate account",
    provider_connection_id: "connection-1",
    billing_source: "provider_account",
    external_platform_slug: "replicate",
    external_provider: "replicate",
    external_owner: "customer-account",
    external_name: "llama-runtime",
    external_model_ref: "meta/llama-3.3-70b-instruct",
    external_web_url: "https://replicate.com/customer-account/llama-runtime",
    credits_budget: null,
    monthly_price_estimate: null,
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
    updated_at: "2026-07-19T12:00:00.000Z",
    ...overrides,
  };
}

describe("workspace deployment summaries", () => {
  it("preserves ownership language for a user-billed dedicated deployment", () => {
    const result = toWorkspaceDeploymentResponse(deployment());

    expect(result.providerName).toBe("Meta");
    expect(result.deploymentLabel).toBe(
      "Dedicated runtime in your Replicate account"
    );
    expect(result.billingSource).toBe("provider_account");
    expect(result.billing.requestCharge).toBe(0);
  });

  it("uses AI Market Cap branding only for a platform-funded dedicated deployment", () => {
    const result = toWorkspaceDeploymentResponse(
      deployment({
        provider_connection_id: null,
        billing_source: "platform_wallet",
        deployment_label: "Replicate runtime",
        credits_budget: 20,
      })
    );

    expect(result.providerName).toBe("AI Market Cap");
    expect(result.deploymentLabel).toBe("AI Market Cap dedicated runtime");
    expect(result.billing.requestCharge).toBe(0.5);
  });
});
