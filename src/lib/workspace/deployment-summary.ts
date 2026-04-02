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
  total_tokens: number;
  last_used_at: string | null;
  updated_at: string;
}

export function toWorkspaceDeploymentResponse(deployment: WorkspaceDeploymentRecord) {
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
    totalTokens: deployment.total_tokens,
    lastUsedAt: deployment.last_used_at,
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
