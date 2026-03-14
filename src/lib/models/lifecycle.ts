export type LifecycleFilter = "active" | "all";

export const TRACKED_NON_ACTIVE_STATUSES = [
  "beta",
  "preview",
  "deprecated",
  "archived",
] as const;

export type TrackedNonActiveStatus = (typeof TRACKED_NON_ACTIVE_STATUSES)[number];
export type RankableLifecycleStatus = "active" | TrackedNonActiveStatus;

export interface LifecycleBadge {
  label: string;
  rankedByDefault: boolean;
  tone: "default" | "info" | "warning" | "muted";
}

export function getLifecycleStatuses(filter: LifecycleFilter): RankableLifecycleStatus[] {
  return filter === "all"
    ? ["active", ...TRACKED_NON_ACTIVE_STATUSES]
    : ["active"];
}

export function parseLifecycleFilter(value: string | null | undefined): LifecycleFilter {
  return value === "all" ? "all" : "active";
}

export function isTrackedLifecycleStatus(status: string | null | undefined): status is RankableLifecycleStatus {
  return status === "active" || TRACKED_NON_ACTIVE_STATUSES.includes(status as TrackedNonActiveStatus);
}

export function isRankableLifecycleStatus(status: string | null | undefined): boolean {
  return status === "active";
}

export function filterRankableModels<T extends { status: string | null | undefined }>(
  models: T[],
  filter: LifecycleFilter
): T[] {
  if (filter === "all") {
    return models.filter((model) => isTrackedLifecycleStatus(model.status));
  }

  return models.filter((model) => isRankableLifecycleStatus(model.status));
}

export function getLifecycleBadge(status: string | null | undefined): LifecycleBadge | null {
  switch (status) {
    case "active":
      return {
        label: "Active",
        rankedByDefault: true,
        tone: "default",
      };
    case "beta":
      return {
        label: "Beta",
        rankedByDefault: false,
        tone: "info",
      };
    case "preview":
      return {
        label: "Preview",
        rankedByDefault: false,
        tone: "info",
      };
    case "deprecated":
      return {
        label: "Deprecated",
        rankedByDefault: false,
        tone: "warning",
      };
    case "archived":
      return {
        label: "Archived",
        rankedByDefault: false,
        tone: "muted",
      };
    default:
      return null;
  }
}
