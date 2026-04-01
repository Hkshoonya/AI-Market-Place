export interface WorkspaceDeploymentChargeInput {
  deploymentKind: "managed_api" | "assistant_only";
  monthlyPriceEstimate: number | null | undefined;
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
