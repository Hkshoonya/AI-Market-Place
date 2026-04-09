export type PipelineDataQualityAlert = {
  severity: "warning" | "critical";
  code:
    | "benchmark_official_gaps"
    | "missing_trusted_benchmark_locators"
    | "official_metadata_completeness"
    | "official_discovery_readiness"
    | "official_ranking_contamination"
    | "low_trust_discovery_ready";
  message: string;
  value: number;
  target: number;
};

type BenchmarkCoverageSummaryInput = {
  officialGapCount: number;
  trustedLocatorCoveragePct: number;
  missingTrustedLocatorCount: number;
};

type PublicMetadataCoverageSummaryInput = {
  officialCompleteDiscoveryMetadataPct: number;
  officialDefaultPublicSurfaceReadyPct: number;
  officialRankingContaminationCount: number;
  lowTrustReadyCount: number;
};

export function computePipelineDataQualityAlerts(input: {
  benchmarkCoverage: BenchmarkCoverageSummaryInput;
  publicMetadataCoverage: PublicMetadataCoverageSummaryInput;
}) {
  const alerts: PipelineDataQualityAlert[] = [];

  if (input.benchmarkCoverage.officialGapCount > 0) {
    alerts.push({
      severity: "warning",
      code: "benchmark_official_gaps",
      message: "Official benchmark-expected models still have benchmark coverage gaps.",
      value: input.benchmarkCoverage.officialGapCount,
      target: 0,
    });
  }

  if (input.benchmarkCoverage.missingTrustedLocatorCount > 0) {
    alerts.push({
      severity:
        input.benchmarkCoverage.trustedLocatorCoveragePct < 95 ? "critical" : "warning",
      code: "missing_trusted_benchmark_locators",
      message: "Some benchmark-expected models are still missing trusted benchmark locators.",
      value: input.benchmarkCoverage.missingTrustedLocatorCount,
      target: 0,
    });
  }

  if (input.publicMetadataCoverage.officialCompleteDiscoveryMetadataPct < 98) {
    alerts.push({
      severity:
        input.publicMetadataCoverage.officialCompleteDiscoveryMetadataPct < 95
          ? "critical"
          : "warning",
      code: "official_metadata_completeness",
      message: "Official models are missing required public metadata on discovery surfaces.",
      value: input.publicMetadataCoverage.officialCompleteDiscoveryMetadataPct,
      target: 98,
    });
  }

  if (input.publicMetadataCoverage.officialDefaultPublicSurfaceReadyPct < 95) {
    alerts.push({
      severity:
        input.publicMetadataCoverage.officialDefaultPublicSurfaceReadyPct < 90
          ? "critical"
          : "warning",
      code: "official_discovery_readiness",
      message: "Official models are not fully ready for default public discovery.",
      value: input.publicMetadataCoverage.officialDefaultPublicSurfaceReadyPct,
      target: 95,
    });
  }

  if (input.publicMetadataCoverage.officialRankingContaminationCount > 0) {
    alerts.push({
      severity: "critical",
      code: "official_ranking_contamination",
      message:
        "Some official models still have public ranking fields despite failing discovery readiness.",
      value: input.publicMetadataCoverage.officialRankingContaminationCount,
      target: 0,
    });
  }

  if (input.publicMetadataCoverage.lowTrustReadyCount > 0) {
    alerts.push({
      severity: "critical",
      code: "low_trust_discovery_ready",
      message:
        "Low-trust community or wrapper rows are passing default public discovery readiness.",
      value: input.publicMetadataCoverage.lowTrustReadyCount,
      target: 0,
    });
  }

  return alerts;
}

export function computePipelineDataQualityStatus(
  alerts: PipelineDataQualityAlert[]
): "healthy" | "warning" | "critical" {
  if (alerts.some((alert) => alert.severity === "critical")) return "critical";
  if (alerts.length > 0) return "warning";
  return "healthy";
}
