import type { PublicSurfaceReadinessModel } from "./public-surface-readiness";

export const MODEL_PUBLIC_SIGNAL_FIELDS = [
  "hf_downloads",
  "hf_likes",
  "hf_trending_score",
] as const;

export type PublicSignalInputRecord = PublicSurfaceReadinessModel & {
  hf_downloads?: number | null;
  hf_likes?: number | null;
  hf_trending_score?: number | null;
};

export function hasPublicSignalInputs(model: PublicSignalInputRecord) {
  return MODEL_PUBLIC_SIGNAL_FIELDS.some((field) => {
    const value = model[field];
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  });
}

export function stripPublicSignalInputs<T extends Record<string, unknown>>(
  record: T
): T {
  const normalized: Record<string, unknown> = { ...record };
  for (const field of MODEL_PUBLIC_SIGNAL_FIELDS) {
    normalized[field] = null;
  }
  return normalized as T;
}
