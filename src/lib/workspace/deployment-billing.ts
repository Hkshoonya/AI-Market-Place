import type { WorkspaceRuntimePricing } from "./runtime-execution";

export interface WorkspaceDeploymentChargeInput {
  deploymentKind: "managed_api" | "assistant_only" | "hosted_external" | "connected_inference";
  billingSource?: "platform_wallet" | "provider_account";
  runtimePricing?: WorkspaceRuntimePricing | null;
}

export interface WorkspaceDeploymentBudgetSummary {
  requestCharge: number;
  estimatedSpend: number;
  budgetRemaining: number | null;
  budgetStatus: "untracked" | "healthy" | "low" | "exhausted";
}

export function getWorkspaceDeploymentRequestCharge(
  input: WorkspaceDeploymentChargeInput
): number {
  if (input.billingSource === "provider_account") {
    return 0;
  }

  if (input.deploymentKind === "assistant_only") {
    return 0;
  }

  if (input.deploymentKind === "hosted_external") {
    return 0.5;
  }

  if (input.deploymentKind === "connected_inference") {
    return 0.25;
  }

  const pricing = input.runtimePricing;
  if (!pricing) {
    return 0.25;
  }

  const inputRate = pricing.inputPerToken ?? pricing.outputPerToken;
  const outputRate = pricing.outputPerToken ?? pricing.inputPerToken;
  if (inputRate === null || outputRate === null) {
    return 0.25;
  }

  // Reserve for the route's enforced 12k input-character and 2,048 output-token limits.
  // One token per input character is intentionally conservative for multilingual/code input.
  const providerCost = pricing.request + inputRate * 12_000 + outputRate * 2_048;
  const withMargin = Math.max(0.02, providerCost * 1.3);
  return Math.ceil(withMargin * 100 - 1e-9) / 100;
}

export function getWorkspaceDeploymentBudgetSummary(input: {
  deploymentKind: "managed_api" | "assistant_only" | "hosted_external" | "connected_inference";
  billingSource?: "platform_wallet" | "provider_account";
  runtimePricing?: WorkspaceRuntimePricing | null;
  creditsBudget: number | null | undefined;
  totalRequests: number | null | undefined;
}): WorkspaceDeploymentBudgetSummary {
  const requestCharge = getWorkspaceDeploymentRequestCharge({
    deploymentKind: input.deploymentKind,
    billingSource: input.billingSource,
    runtimePricing: input.runtimePricing,
  });
  const totalRequests =
    input.totalRequests != null && Number.isFinite(input.totalRequests)
      ? Number(input.totalRequests)
      : 0;
  const estimatedSpend = Math.round(requestCharge * totalRequests * 100) / 100;
  const creditsBudget =
    input.creditsBudget != null && Number.isFinite(input.creditsBudget)
      ? Number(input.creditsBudget)
      : null;

  if (creditsBudget == null) {
    return {
      requestCharge,
      estimatedSpend,
      budgetRemaining: null,
      budgetStatus: "untracked",
    };
  }

  const budgetRemaining = Math.round(Math.max(0, creditsBudget - estimatedSpend) * 100) / 100;
  const budgetStatus =
    budgetRemaining <= 0
      ? "exhausted"
      : budgetRemaining <= Math.max(requestCharge * 5, creditsBudget * 0.2)
        ? "low"
        : "healthy";

  return {
    requestCharge,
    estimatedSpend,
    budgetRemaining,
    budgetStatus,
  };
}
