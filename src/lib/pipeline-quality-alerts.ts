export type PipelineDataQualityAlert = {
  severity: "warning" | "critical";
  code:
    | "benchmark_official_gaps"
    | "benchmark_sources_unhealthy"
    | "missing_trusted_benchmark_locators"
    | "official_metadata_completeness"
    | "official_discovery_readiness"
    | "official_ranking_contamination"
    | "low_trust_discovery_ready"
    | "low_trust_signal_contamination"
    | "manual_benchmark_sources_enabled"
    | "stale_critical_pipeline_cron_jobs"
    | "failed_critical_pipeline_cron_jobs"
    | "stuck_deployment_provisioning"
    | "failed_deployments";
  message: string;
  value: number;
  target: number;
};

type BenchmarkCoverageSummaryInput = {
  officialGapCount: number;
  trustedLocatorCoveragePct: number;
  missingTrustedLocatorCount: number;
  degradedBenchmarkSources?: number;
  downBenchmarkSources?: number;
};

type PublicMetadataCoverageSummaryInput = {
  officialCompleteDiscoveryMetadataPct: number;
  officialDefaultPublicSurfaceReadyPct: number;
  officialRankingContaminationCount: number;
  lowTrustReadyCount: number;
  signalContaminationCount: number;
};

type DeploymentOperationsSummaryInput = {
  staleProvisioningCount: number;
  failedCount: number;
};

type CronOperationsSummaryInput = {
  staleJobCount: number;
  latestFailedJobCount: number;
};

type ManualBenchmarkSourcesSummaryInput = {
  count: number;
  slugs: string[];
};

export function computePipelineDataQualityAlerts(input: {
  benchmarkCoverage: BenchmarkCoverageSummaryInput;
  publicMetadataCoverage: PublicMetadataCoverageSummaryInput;
  deploymentOperations?: DeploymentOperationsSummaryInput;
  cronOperations?: CronOperationsSummaryInput;
  manualBenchmarkSources?: ManualBenchmarkSourcesSummaryInput;
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

  const unhealthyBenchmarkSources =
    (input.benchmarkCoverage.degradedBenchmarkSources ?? 0) +
    (input.benchmarkCoverage.downBenchmarkSources ?? 0);

  if (unhealthyBenchmarkSources > 0) {
    alerts.push({
      severity: (input.benchmarkCoverage.downBenchmarkSources ?? 0) > 0 ? "critical" : "warning",
      code: "benchmark_sources_unhealthy",
      message:
        "Benchmark source adapters are stale, degraded, or failing, so benchmark updates may stop propagating.",
      value: unhealthyBenchmarkSources,
      target: 0,
    });
  }

  if (input.benchmarkCoverage.missingTrustedLocatorCount > 0) {
    alerts.push({
      severity:
        input.benchmarkCoverage.trustedLocatorCoveragePct < 95 ? "critical" : "warning",
      code: "missing_trusted_benchmark_locators",
      message:
        "Some benchmark-expected models are still missing benchmark evidence or trusted update paths.",
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

  if (input.publicMetadataCoverage.signalContaminationCount > 0) {
    alerts.push({
      severity: "critical",
      code: "low_trust_signal_contamination",
      message:
        "Low-trust community or wrapper rows still carry public signal fields that can contaminate scoring and discovery inputs.",
      value: input.publicMetadataCoverage.signalContaminationCount,
      target: 0,
    });
  }

  if ((input.deploymentOperations?.staleProvisioningCount ?? 0) > 0) {
    alerts.push({
      severity:
        (input.deploymentOperations?.staleProvisioningCount ?? 0) >= 3
          ? "critical"
          : "warning",
      code: "stuck_deployment_provisioning",
      message: "Some AI Market Cap deployments have been stuck in provisioning for too long.",
      value: input.deploymentOperations?.staleProvisioningCount ?? 0,
      target: 0,
    });
  }

  if ((input.deploymentOperations?.failedCount ?? 0) > 0) {
    alerts.push({
      severity:
        (input.deploymentOperations?.failedCount ?? 0) >= 5 ? "critical" : "warning",
      code: "failed_deployments",
      message: "Some AI Market Cap deployments are currently in a failed state.",
      value: input.deploymentOperations?.failedCount ?? 0,
      target: 0,
    });
  }

  if ((input.cronOperations?.staleJobCount ?? 0) > 0) {
    alerts.push({
      severity: "critical",
      code: "stale_critical_pipeline_cron_jobs",
      message: "Critical data pipeline cron jobs are stale or missing recent runs.",
      value: input.cronOperations?.staleJobCount ?? 0,
      target: 0,
    });
  }

  if ((input.cronOperations?.latestFailedJobCount ?? 0) > 0) {
    alerts.push({
      severity: "critical",
      code: "failed_critical_pipeline_cron_jobs",
      message: "Critical data pipeline cron jobs most recently failed.",
      value: input.cronOperations?.latestFailedJobCount ?? 0,
      target: 0,
    });
  }

  if ((input.manualBenchmarkSources?.count ?? 0) > 0) {
    alerts.push({
      severity: "critical",
      code: "manual_benchmark_sources_enabled",
      message: `Manual benchmark adapters are still enabled: ${input.manualBenchmarkSources?.slugs.join(", ")}`,
      value: input.manualBenchmarkSources?.count ?? 0,
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
