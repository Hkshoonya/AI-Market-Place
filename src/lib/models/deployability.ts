import type { ModelSignalSummary } from "@/lib/news/model-signals";

export interface DeployabilityAccessOffer {
  actionLabel?: string | null;
}

export function getDeployabilityLabel(input: {
  isOpenWeights?: boolean | null;
  signal?: ModelSignalSummary | null;
  accessOffer?: DeployabilityAccessOffer | null;
}): string | null {
  if (input.signal?.signalType === "open_source") return "Self-Host";
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
