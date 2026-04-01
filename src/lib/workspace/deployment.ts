export type WorkspaceDeploymentStatus = "provisioning" | "ready" | "paused" | "failed";

export function buildWorkspaceDeploymentEndpointSlug(modelSlug: string) {
  const normalized = modelSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `${normalized || "deployment"}-${suffix}`;
}

export function buildWorkspaceDeploymentEndpointPath(endpointSlug: string) {
  return `/api/deployments/${endpointSlug}`;
}
