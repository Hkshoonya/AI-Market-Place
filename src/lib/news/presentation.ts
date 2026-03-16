import type { NewsSignalImportance, NewsSignalType } from "./signals";

type SupportedSignalType = Exclude<NewsSignalType, "general"> | "general";

export interface NewsPresentationItem {
  id?: string | null;
  title?: string | null;
  summary?: string | null;
  url?: string | null;
  source?: string | null;
  category?: string | null;
  related_provider?: string | null;
  related_model_ids?: string[] | null;
  published_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface NewsSignalBucket {
  type: SupportedSignalType;
  label: string;
  count: number;
  importance: NewsSignalImportance;
}

export interface LaunchRadarItem extends NewsPresentationItem {
  signalType: SupportedSignalType;
  signalLabel: string;
  signalImportance: NewsSignalImportance;
}

const SIGNAL_ORDER: SupportedSignalType[] = [
  "launch",
  "pricing",
  "benchmark",
  "api",
  "open_source",
  "safety",
  "research",
  "general",
];

const SIGNAL_LABELS: Record<SupportedSignalType, string> = {
  launch: "Launches",
  pricing: "Pricing",
  benchmark: "Benchmarks",
  api: "API",
  open_source: "Open Source",
  safety: "Safety",
  research: "Research",
  general: "General",
};

const SOURCE_SIGNAL_FALLBACKS: Partial<Record<string, SupportedSignalType>> = {
  "x-twitter": "launch",
  "provider-blog": "launch",
  arxiv: "research",
  "hf-papers": "research",
  "artificial-analysis": "benchmark",
  "open-llm-leaderboard": "benchmark",
};

const IMPORTANCE_WEIGHT: Record<NewsSignalImportance, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function getBucketImportance(type: SupportedSignalType): NewsSignalImportance {
  if (type === "launch" || type === "pricing" || type === "benchmark") {
    return "high";
  }

  if (type === "api" || type === "open_source" || type === "safety") {
    return "medium";
  }

  return "low";
}

function isSignalType(value: unknown): value is SupportedSignalType {
  return typeof value === "string" && SIGNAL_ORDER.includes(value as SupportedSignalType);
}

export function getNewsSignalType(item: NewsPresentationItem): SupportedSignalType {
  const metadataSignal = item.metadata?.signal_type;
  if (isSignalType(metadataSignal)) {
    return metadataSignal;
  }

  if (item.category === "benchmark") {
    return "benchmark";
  }

  if (item.category === "pricing") {
    return "pricing";
  }

  const sourceFallback = item.source ? SOURCE_SIGNAL_FALLBACKS[item.source] : null;
  return sourceFallback ?? "general";
}

export function getNewsSignalImportance(item: NewsPresentationItem): NewsSignalImportance {
  const metadataImportance = item.metadata?.signal_importance;
  if (
    metadataImportance === "high" ||
    metadataImportance === "medium" ||
    metadataImportance === "low"
  ) {
    return metadataImportance;
  }

  const signalType = getNewsSignalType(item);
  if (signalType === "launch" || signalType === "pricing" || signalType === "benchmark") {
    return "high";
  }

  if (signalType === "api" || signalType === "open_source" || signalType === "safety") {
    return "medium";
  }

  return "low";
}

function toTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeNewsSignals(items: NewsPresentationItem[]): NewsSignalBucket[] {
  const counts = new Map<SupportedSignalType, number>();

  for (const item of items) {
    const type = getNewsSignalType(item);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  return SIGNAL_ORDER.map((type) => ({
    type,
    label: SIGNAL_LABELS[type],
    count: counts.get(type) ?? 0,
    importance: getBucketImportance(type),
  })).filter((bucket) => bucket.count > 0);
}

export function buildLaunchRadar(items: NewsPresentationItem[], limit = 6): LaunchRadarItem[] {
  return [...items]
    .map((item, index) => {
      const signalType = getNewsSignalType(item);
      const signalImportance = getNewsSignalImportance(item);

      return {
        ...item,
        id: item.id ?? item.url ?? item.title ?? `news-${index}`,
        title: item.title ?? "Untitled update",
        signalType,
        signalLabel: SIGNAL_LABELS[signalType],
        signalImportance,
      };
    })
    .sort((left, right) => {
      const importanceDelta =
        IMPORTANCE_WEIGHT[right.signalImportance] - IMPORTANCE_WEIGHT[left.signalImportance];
      if (importanceDelta !== 0) return importanceDelta;

      const signalDelta = SIGNAL_ORDER.indexOf(left.signalType) - SIGNAL_ORDER.indexOf(right.signalType);
      if (signalDelta !== 0) return signalDelta;

      return toTimestamp(right.published_at) - toTimestamp(left.published_at);
    })
    .slice(0, limit);
}

export function groupNewsBySignal(
  items: NewsPresentationItem[]
): Array<{ type: SupportedSignalType; label: string; items: LaunchRadarItem[] }> {
  return summarizeNewsSignals(items).map((bucket) => ({
    type: bucket.type,
    label: bucket.label,
    items: buildLaunchRadar(items.filter((item) => getNewsSignalType(item) === bucket.type), 12),
  }));
}
