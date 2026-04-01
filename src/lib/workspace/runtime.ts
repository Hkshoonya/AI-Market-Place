export type WorkspaceRuntimeStatus = "draft" | "ready" | "paused";

export function buildWorkspaceRuntimeEndpointSlug(modelSlug: string) {
  const normalized = modelSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `${normalized || "runtime"}-${suffix}`;
}

export function buildWorkspaceRuntimeEndpointPath(endpointSlug: string) {
  return `/api/runtime/${endpointSlug}`;
}

export function buildWorkspaceRuntimeAssistantPath(endpointSlug: string) {
  return `${buildWorkspaceRuntimeEndpointPath(endpointSlug)}/assistant`;
}
