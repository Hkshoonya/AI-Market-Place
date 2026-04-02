import { getWorkspaceDeploymentBudgetSummary } from "@/lib/workspace/deployment-billing";
import { resolveWorkspaceRuntimeExecution } from "@/lib/workspace/runtime-execution";
import { buildWorkspaceDeploymentEndpointPath } from "@/lib/workspace/deployment";

export interface WorkspaceDeploymentRecord {
  id: string;
  runtime_id: string | null;
  model_slug: string;
  model_name: string;
  provider_name: string | null;
  status: "provisioning" | "ready" | "paused" | "failed";
  endpoint_slug: string;
  deployment_kind: "managed_api" | "assistant_only";
  deployment_label: string | null;
  credits_budget: number | null;
  monthly_price_estimate: number | null;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_tokens: number;
  avg_response_latency_ms: number | null;
  last_response_latency_ms: number | null;
  last_used_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  updated_at: string;
}

export function toWorkspaceDeploymentResponse(deployment: WorkspaceDeploymentRecord) {
  const totalAttempts = deployment.successful_requests + deployment.failed_requests;
  const healthStatus =
    deployment.status === "paused"
      ? "paused"
      : deployment.status === "failed" || deployment.last_error_message
        ? "error"
        : deployment.last_success_at || deployment.total_requests > 0
          ? "healthy"
          : "idle";

  return {
    id: deployment.id,
    runtimeId: deployment.runtime_id,
    modelSlug: deployment.model_slug,
    modelName: deployment.model_name,
    providerName: deployment.provider_name,
    status: deployment.status,
    endpointSlug: deployment.endpoint_slug,
    endpointPath: buildWorkspaceDeploymentEndpointPath(deployment.endpoint_slug),
    deploymentKind: deployment.deployment_kind,
    deploymentLabel: deployment.deployment_label,
    creditsBudget: deployment.credits_budget,
    monthlyPriceEstimate: deployment.monthly_price_estimate,
    totalRequests: deployment.total_requests,
    successfulRequests: deployment.successful_requests,
    failedRequests: deployment.failed_requests,
    totalTokens: deployment.total_tokens,
    avgResponseLatencyMs: deployment.avg_response_latency_ms,
    lastResponseLatencyMs: deployment.last_response_latency_ms,
    lastUsedAt: deployment.last_used_at,
    lastSuccessAt: deployment.last_success_at,
    lastErrorAt: deployment.last_error_at,
    lastErrorMessage: deployment.last_error_message,
    successRate:
      totalAttempts > 0
        ? Number(((deployment.successful_requests / totalAttempts) * 100).toFixed(1))
        : null,
    healthStatus,
    updatedAt: deployment.updated_at,
    execution: resolveWorkspaceRuntimeExecution(deployment.model_slug),
    billing: getWorkspaceDeploymentBudgetSummary({
      deploymentKind: deployment.deployment_kind,
      monthlyPriceEstimate: deployment.monthly_price_estimate,
      creditsBudget: deployment.credits_budget,
      totalRequests: deployment.total_requests,
    }),
  };
}

export type WorkspaceDeploymentResponse = ReturnType<typeof toWorkspaceDeploymentResponse>;
