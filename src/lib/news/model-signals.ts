import {
  getNewsSignalImportance,
  getNewsSignalType,
  type NewsPresentationItem,
} from "./presentation";
import { getNewsSignalTrustBonus } from "./evidence";

export interface ModelSignalCandidate extends NewsPresentationItem {
  related_provider?: string | null;
  related_model_ids?: string[] | null;
}

export interface ModelSignalSummary {
  title: string;
  signalType: string;
  signalLabel: string;
  signalImportance: "high" | "medium" | "low";
  publishedAt: string | null;
  source: string | null;
  relatedProvider: string | null;
}

interface ModelLike {
  id: string;
  provider?: string | null;
}

const SIGNAL_LABELS: Record<string, string> = {
  launch: "Launch",
  pricing: "Pricing",
  benchmark: "Benchmark",
  api: "API",
  open_source: "Open Source",
  safety: "Safety",
  research: "Research",
};

const IMPORTANCE_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1,
} as const;

function normalizeProvider(provider: string | null | undefined) {
  return provider?.trim().toLowerCase() ?? null;
}

function publishedAtScore(value: string | null | undefined) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 0;
  const hoursAgo = Math.max(0, (Date.now() - timestamp) / 3_600_000);
  return Math.max(0, 72 - Math.min(hoursAgo, 72));
}

function computeCandidateScore(
  candidate: ModelSignalCandidate,
  model: ModelLike
) {
  const signalType = getNewsSignalType(candidate);
  if (signalType === "general") return -1;

  const directMatch = candidate.related_model_ids?.includes(model.id) ?? false;
  const providerMatch =
    normalizeProvider(candidate.related_provider) === normalizeProvider(model.provider);

  if (!directMatch && !providerMatch) return -1;

  const importance = getNewsSignalImportance(candidate);
  return (
    (directMatch ? 100 : 40) +
    IMPORTANCE_WEIGHT[importance] * 10 +
    getNewsSignalTrustBonus(candidate) +
    publishedAtScore(candidate.published_at)
  );
}

export function pickBestModelSignals<T extends ModelLike>(
  models: T[],
  newsItems: ModelSignalCandidate[]
): Map<string, ModelSignalSummary> {
  const selected = new Map<string, { score: number; summary: ModelSignalSummary }>();

  for (const model of models) {
    for (const item of newsItems) {
      const score = computeCandidateScore(item, model);
      if (score < 0) continue;

      const signalType = getNewsSignalType(item);
      const summary: ModelSignalSummary = {
        title: item.title ?? "Recent update",
        signalType,
        signalLabel: SIGNAL_LABELS[signalType] ?? "Update",
        signalImportance: getNewsSignalImportance(item),
        publishedAt: item.published_at ?? null,
        source: item.source ?? null,
        relatedProvider: item.related_provider ?? null,
      };

      const existing = selected.get(model.id);
      if (!existing || score > existing.score) {
        selected.set(model.id, { score, summary });
      }
    }
  }

  return new Map(
    [...selected.entries()].map(([modelId, value]) => [modelId, value.summary])
  );
}
