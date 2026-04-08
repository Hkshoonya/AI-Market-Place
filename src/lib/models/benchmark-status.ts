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

interface BenchmarkStatusInput {
  slug: string;
  provider: string;
  category: string | null;
  benchmarkScoreCount: number;
  benchmarkEvidenceCount: number;
  arenaSignalCount: number;
}

export function getBenchmarkTrackingSummary(
  input: BenchmarkStatusInput
): BenchmarkTrackingSummary {
  if (input.benchmarkScoreCount > 0) {
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
