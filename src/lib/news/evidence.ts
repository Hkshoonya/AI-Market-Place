import {
  getNewsSignalImportance,
  getNewsSignalType,
  type NewsPresentationItem,
} from "./presentation";

export interface NewsEvidenceCandidate extends NewsPresentationItem {
  related_model_ids?: string[] | null;
}

const DEFAULT_SOURCE_WEIGHT = 0.35;
const DEFAULT_SOURCE_CAP = 1.5;
const DEFAULT_SIGNAL_TRUST_BONUS = 4;

const SOURCE_WEIGHTS: Record<string, number> = {
  "provider-blog": 1,
  "artificial-analysis": 0.95,
  "open-llm-leaderboard": 0.95,
  arxiv: 0.85,
  "hf-papers": 0.85,
  "x-twitter": 0.2,
};

const SOURCE_CAPS: Record<string, number> = {
  "provider-blog": 3,
  "artificial-analysis": 2.5,
  "open-llm-leaderboard": 2.5,
  arxiv: 2,
  "hf-papers": 2,
  "x-twitter": 0.8,
};

const SIGNAL_TYPE_MULTIPLIERS: Record<string, number> = {
  benchmark: 1.1,
  pricing: 1.05,
  api: 1,
  research: 0.95,
  safety: 0.95,
  open_source: 0.9,
  launch: 0.85,
  general: 0.6,
};

const IMPORTANCE_MULTIPLIERS = {
  high: 1,
  medium: 0.8,
  low: 0.65,
} as const;

const SOURCE_TRUST_BONUS: Record<string, number> = {
  "provider-blog": 12,
  "artificial-analysis": 10,
  "open-llm-leaderboard": 10,
  arxiv: 8,
  "hf-papers": 8,
  "x-twitter": 2,
};

const SIGNAL_TYPE_PRIORITY_BONUS: Record<string, number> = {
  benchmark: 6,
  pricing: 5,
  api: 4,
  research: 4,
  safety: 4,
  open_source: 3,
  launch: 3,
  general: 0,
};

function normalizeSource(source: string | null | undefined): string {
  return source?.trim().toLowerCase() ?? "unknown";
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function getNewsEvidenceWeight(candidate: NewsPresentationItem): number {
  const signalType = getNewsSignalType(candidate);
  const importance = getNewsSignalImportance(candidate);
  const source = normalizeSource(candidate.source);
  const baseWeight = SOURCE_WEIGHTS[source] ?? DEFAULT_SOURCE_WEIGHT;
  const signalMultiplier = SIGNAL_TYPE_MULTIPLIERS[signalType] ?? 1;
  const importanceMultiplier = IMPORTANCE_MULTIPLIERS[importance];

  return round(baseWeight * signalMultiplier * importanceMultiplier);
}

export function getNewsEvidenceCap(source: string | null | undefined): number {
  return SOURCE_CAPS[normalizeSource(source)] ?? DEFAULT_SOURCE_CAP;
}

export function getNewsSignalTrustBonus(candidate: NewsPresentationItem): number {
  const signalType = getNewsSignalType(candidate);
  const source = normalizeSource(candidate.source);
  return (
    (SOURCE_TRUST_BONUS[source] ?? DEFAULT_SIGNAL_TRUST_BONUS) +
    (SIGNAL_TYPE_PRIORITY_BONUS[signalType] ?? 0)
  );
}

export function buildModelNewsEvidenceMap(
  items: NewsEvidenceCandidate[]
): Map<string, number> {
  const evidenceByModel = new Map<string, Map<string, number>>();

  for (const item of items) {
    const rawModelIds = Array.isArray(item.related_model_ids) ? item.related_model_ids : [];
    if (rawModelIds.length === 0) continue;

    const source = normalizeSource(item.source);
    const weight = getNewsEvidenceWeight(item);
    if (weight <= 0) continue;

    for (const modelId of new Set(rawModelIds)) {
      const bySource = evidenceByModel.get(modelId) ?? new Map<string, number>();
      bySource.set(source, (bySource.get(source) ?? 0) + weight);
      evidenceByModel.set(modelId, bySource);
    }
  }

  const totals = new Map<string, number>();
  for (const [modelId, bySource] of evidenceByModel) {
    let total = 0;
    for (const [source, sourceTotal] of bySource) {
      total += Math.min(sourceTotal, getNewsEvidenceCap(source));
    }
    totals.set(modelId, round(total));
  }

  return totals;
}
