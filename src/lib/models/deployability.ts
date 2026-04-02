import type { ModelSignalSummary } from "@/lib/news/model-signals";

export interface DeployabilityAccessOffer {
  actionLabel?: string | null;
}

export type DeployabilityLabel =
  | "Run it yourself"
  | "Ready to Use"
  | "API Access"
  | "Subscription"
  | "Free Trial"
  | "Open Weights";

export function getUsageUpdateBadgeLabel(signalType: "api" | "open_source") {
  return signalType === "open_source" ? "Run it yourself" : "Start using it";
}

export function getDeployabilityLabel(input: {
  isOpenWeights?: boolean | null;
  signal?: ModelSignalSummary | null;
  accessOffer?: DeployabilityAccessOffer | null;
}): DeployabilityLabel | null {
  if (input.signal?.signalType === "open_source") return "Run it yourself";
  if (input.signal?.signalType === "api") return "Ready to Use";

  switch (input.accessOffer?.actionLabel) {
    case "Deploy":
      return "Ready to Use";
    case "Get API Access":
      return "API Access";
    case "Subscribe":
      return "Subscription";
    case "Start Free Trial":
      return "Free Trial";
    default:
      break;
  }

  if (input.isOpenWeights) return "Open Weights";
  return null;
}

export function isSelfHostedDeployabilityLabel(
  label: string | null | undefined
): boolean {
  return label === "Run it yourself" || label === "Open Weights" || label === "Self-Host";
}
