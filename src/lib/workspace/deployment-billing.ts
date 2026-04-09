export interface WorkspaceDeploymentChargeInput {
  deploymentKind: "managed_api" | "assistant_only" | "hosted_external";
  monthlyPriceEstimate: number | null | undefined;
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
  if (input.deploymentKind !== "managed_api") {
    return 0;
  }

  const monthlyEstimate =
    input.monthlyPriceEstimate != null && Number.isFinite(input.monthlyPriceEstimate)
      ? Number(input.monthlyPriceEstimate)
      : 20;

  const estimated = monthlyEstimate / 1000;
  const rounded = Math.round(Math.max(0.02, estimated) * 100) / 100;
  return Math.min(rounded, 1);
}

export function getWorkspaceDeploymentBudgetSummary(input: {
  deploymentKind: "managed_api" | "assistant_only" | "hosted_external";
  monthlyPriceEstimate: number | null | undefined;
  creditsBudget: number | null | undefined;
  totalRequests: number | null | undefined;
}): WorkspaceDeploymentBudgetSummary {
  const requestCharge = getWorkspaceDeploymentRequestCharge({
    deploymentKind: input.deploymentKind,
    monthlyPriceEstimate: input.monthlyPriceEstimate,
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
