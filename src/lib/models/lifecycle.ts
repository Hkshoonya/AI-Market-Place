export type LifecycleFilter = "active" | "all";

export const TRACKED_NON_ACTIVE_STATUSES = [
  "beta",
  "preview",
  "deprecated",
  "archived",
] as const;

export type TrackedNonActiveStatus = (typeof TRACKED_NON_ACTIVE_STATUSES)[number];
export type RankableLifecycleStatus = "active" | TrackedNonActiveStatus;

const PREVIEW_PATTERN = /\bpreview\b/i;
const BETA_PATTERN = /\bbeta\b/i;
const DEPRECATED_PATTERN = /\b(deprecated|legacy|retired|sunset)\b/i;
const ARCHIVED_PATTERN = /\b(archived|archive)\b/i;

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

export function inferLifecycleStatus(
  ...signals: Array<string | null | undefined>
): RankableLifecycleStatus {
  const haystack = signals
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  if (!haystack) return "active";
  if (DEPRECATED_PATTERN.test(haystack)) return "deprecated";
  if (ARCHIVED_PATTERN.test(haystack)) return "archived";
  if (BETA_PATTERN.test(haystack)) return "beta";
  if (PREVIEW_PATTERN.test(haystack)) return "preview";
  return "active";
}

export function normalizeLifecycleStatus(
  currentStatus: string | null | undefined,
  ...signals: Array<string | null | undefined>
): RankableLifecycleStatus {
  if (isTrackedLifecycleStatus(currentStatus)) {
    if (currentStatus !== "active") return currentStatus;
    return inferLifecycleStatus(...signals);
  }

  return inferLifecycleStatus(...signals);
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
