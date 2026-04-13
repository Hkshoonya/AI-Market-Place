import { isBenchmarkExpectedModel } from "@/lib/data-sources/shared/benchmark-coverage";
import type { LaunchRadarItem } from "@/lib/news/presentation";

export type BenchmarkTrackingStatus =
  | "structured"
  | "provider_reported"
  | "arena_only"
  | "pending"
  | "not_standardized";

export interface BenchmarkTrackingSummary {
  status: BenchmarkTrackingStatus;
  label: string;
  summary: string;
  badgeLabel: string;
  showTrustAsterisk: boolean;
}

export interface BenchmarkTrackingCoverageSummary {
  total: number;
  structured: number;
  providerReported: number;
  arenaOnly: number;
  pending: number;
  notStandardized: number;
  comparable: number;
  signalBacked: number;
}

interface BenchmarkStatusInput {
  slug: string;
  provider: string;
  category: string | null;
  trustedBenchmarkScoreCount: number;
  benchmarkEvidenceCount: number;
  arenaSignalCount: number;
}

export function getBenchmarkTrackingSummary(
  input: BenchmarkStatusInput
): BenchmarkTrackingSummary {
  if (input.trustedBenchmarkScoreCount > 0) {
    return {
      status: "structured",
      label: "Structured benchmark coverage",
      badgeLabel: "Structured",
      summary:
        "This model has normalized benchmark rows, so scores here are directly comparable across benchmark sources.",
      showTrustAsterisk: false,
    };
  }

  if (input.benchmarkEvidenceCount > 0) {
    return {
      status: "provider_reported",
      label: "Provider-reported benchmark coverage",
      badgeLabel: "Provider-reported*",
      summary:
        "This model has official provider benchmark evidence, but not a normalized independent benchmark table yet.",
      showTrustAsterisk: true,
    };
  }

  if (input.arenaSignalCount > 0) {
    return {
      status: "arena_only",
      label: "Arena-only competitive signal",
      badgeLabel: "Arena only",
      summary:
        "This model has live arena signal, but it does not have structured benchmark rows or provider benchmark evidence yet.",
      showTrustAsterisk: false,
    };
  }

  if (
    isBenchmarkExpectedModel({
      slug: input.slug,
      provider: input.provider,
      category: input.category,
    })
  ) {
    return {
      status: "pending",
      label: "Benchmark coverage pending",
      badgeLabel: "Pending",
      summary:
        "This model belongs to a benchmark-expected category, but stable public benchmark evidence has not been ingested yet.",
      showTrustAsterisk: false,
    };
  }

  return {
    status: "not_standardized",
    label: "No stable public benchmark standard",
    badgeLabel: "Not standardized",
    summary:
      "This model category does not have a stable public benchmark standard we trust enough to present as comparable benchmark coverage.",
    showTrustAsterisk: false,
  };
}

export function countProviderReportedBenchmarkEvidence(
  recentBenchmarkEvidence: LaunchRadarItem[]
) {
  return recentBenchmarkEvidence.length;
}

export function summarizeBenchmarkTrackingCoverage(
  summaries: Array<BenchmarkTrackingSummary | null | undefined>
): BenchmarkTrackingCoverageSummary {
  const totals: BenchmarkTrackingCoverageSummary = {
    total: 0,
    structured: 0,
    providerReported: 0,
    arenaOnly: 0,
    pending: 0,
    notStandardized: 0,
    comparable: 0,
    signalBacked: 0,
  };

  for (const summary of summaries) {
    if (!summary) continue;
    totals.total += 1;

    switch (summary.status) {
      case "structured":
        totals.structured += 1;
        totals.comparable += 1;
        break;
      case "provider_reported":
        totals.providerReported += 1;
        totals.signalBacked += 1;
        break;
      case "arena_only":
        totals.arenaOnly += 1;
        totals.signalBacked += 1;
        break;
      case "pending":
        totals.pending += 1;
        break;
      case "not_standardized":
        totals.notStandardized += 1;
        break;
    }
  }

  return totals;
}
