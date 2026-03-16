import {
  getNewsSignalImportance,
  getNewsSignalType,
  type NewsPresentationItem,
} from "./presentation";
import { getCanonicalProviderName, providerMatchesCanonical } from "@/lib/constants/providers";
import { getNewsSignalTrustBonus } from "./evidence";

export interface ProviderSignalCandidate extends NewsPresentationItem {
  related_provider?: string | null;
}

export interface ProviderSignalSummary {
  title: string;
  signalType: string;
  signalLabel: string;
  signalImportance: "high" | "medium" | "low";
  publishedAt: string | null;
  source: string | null;
  relatedProvider: string | null;
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

function publishedAtScore(value: string | null | undefined) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 0;
  const hoursAgo = Math.max(0, (Date.now() - timestamp) / 3_600_000);
  return Math.max(0, 120 - Math.min(hoursAgo, 120));
}

function computeCandidateScore(
  candidate: ProviderSignalCandidate,
  provider: string
) {
  if (!candidate.related_provider || !providerMatchesCanonical(candidate.related_provider, provider)) {
    return -1;
  }

  const signalType = getNewsSignalType(candidate);
  if (signalType === "general") return -1;

  const importance = getNewsSignalImportance(candidate);

  return (
    IMPORTANCE_WEIGHT[importance] * 10 +
    getNewsSignalTrustBonus(candidate) +
    publishedAtScore(candidate.published_at)
  );
}

export function pickBestProviderSignals(
  providers: string[],
  newsItems: ProviderSignalCandidate[]
): Map<string, ProviderSignalSummary> {
  const selected = new Map<string, { score: number; summary: ProviderSignalSummary }>();

  for (const provider of providers) {
    const canonicalProvider = getCanonicalProviderName(provider);

    for (const item of newsItems) {
      const score = computeCandidateScore(item, canonicalProvider);
      if (score < 0) continue;

      const signalType = getNewsSignalType(item);
      const summary: ProviderSignalSummary = {
        title: item.title ?? "Recent provider update",
        signalType,
        signalLabel: SIGNAL_LABELS[signalType] ?? "Update",
        signalImportance: getNewsSignalImportance(item),
        publishedAt: item.published_at ?? null,
        source: item.source ?? null,
        relatedProvider: item.related_provider ?? null,
      };

      const existing = selected.get(canonicalProvider);
      if (!existing || score > existing.score) {
        selected.set(canonicalProvider, { score, summary });
      }
    }
  }

  return new Map(
    [...selected.entries()].map(([provider, value]) => [provider, value.summary])
  );
}

export function filterProviderSignals(
  provider: string,
  newsItems: ProviderSignalCandidate[]
): ProviderSignalCandidate[] {
  const canonicalProvider = getCanonicalProviderName(provider);

  return newsItems.filter(
    (item) =>
      typeof item.related_provider === "string" &&
      providerMatchesCanonical(item.related_provider, canonicalProvider)
  );
}
