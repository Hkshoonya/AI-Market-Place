import { describe, expect, it } from "vitest";

import { computeDeploymentOperationsSummary } from "./deployment-operations-compute";

describe("computeDeploymentOperationsSummary", () => {
  it("counts ready, failed, and stale provisioning deployments", () => {
    const summary = computeDeploymentOperationsSummary(
      [
        {
          id: "d1",
          model_slug: "openai-gpt-4-1",
          model_name: "GPT-4.1",
          provider_name: "AI Market Cap",
          status: "ready",
          deployment_kind: "managed_api",
          created_at: "2026-04-10T15:00:00.000Z",
          updated_at: "2026-04-10T15:05:00.000Z",
          last_error_message: null,
        },
        {
          id: "d2",
          model_slug: "meta-llama-3-3-70b-instruct",
          model_name: "Llama 3.3 70B Instruct",
          provider_name: "AI Market Cap",
          status: "provisioning",
          deployment_kind: "hosted_external",
          created_at: "2026-04-10T14:00:00.000Z",
          updated_at: "2026-04-10T14:05:00.000Z",
          last_error_message: null,
        },
        {
          id: "d3",
          model_slug: "qwen-qwen2-5-7b-instruct",
          model_name: "Qwen2.5 7B Instruct",
          provider_name: "AI Market Cap",
          status: "failed",
          deployment_kind: "hosted_external",
          created_at: "2026-04-10T14:00:00.000Z",
          updated_at: "2026-04-10T14:55:00.000Z",
          last_error_message: "Backend failed",
        },
      ],
      new Date("2026-04-10T14:30:00.000Z")
    );

    expect(summary.totals.total).toBe(3);
    expect(summary.totals.readyCount).toBe(1);
    expect(summary.totals.failedCount).toBe(1);
    expect(summary.totals.staleProvisioningCount).toBe(1);
    expect(summary.recentStaleProvisioning[0]?.slug).toBe("meta-llama-3-3-70b-instruct");
    expect(summary.recentFailed[0]?.slug).toBe("qwen-qwen2-5-7b-instruct");
  });
});
