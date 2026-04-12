import { describe, expect, it } from "vitest";

import {
  computePipelineDataQualityAlerts,
  computePipelineDataQualityStatus,
} from "./pipeline-quality-alerts";

describe("pipeline data quality alerts", () => {
  it("returns healthy when benchmark and discovery coverage are in range", () => {
    const alerts = computePipelineDataQualityAlerts({
      benchmarkCoverage: {
        officialGapCount: 0,
        trustedLocatorCoveragePct: 100,
        missingTrustedLocatorCount: 0,
      },
      publicMetadataCoverage: {
        officialCompleteDiscoveryMetadataPct: 99.5,
        officialDefaultPublicSurfaceReadyPct: 97.2,
        officialRankingContaminationCount: 0,
        lowTrustReadyCount: 0,
        signalContaminationCount: 0,
      },
      deploymentOperations: {
        staleProvisioningCount: 0,
        failedCount: 0,
      },
      manualBenchmarkSources: {
        count: 0,
        slugs: [],
      },
    });

    expect(alerts).toEqual([]);
    expect(computePipelineDataQualityStatus(alerts)).toBe("healthy");
  });

  it("returns warning and critical alerts when thresholds are missed", () => {
    const alerts = computePipelineDataQualityAlerts({
      benchmarkCoverage: {
        officialGapCount: 2,
        trustedLocatorCoveragePct: 92,
        missingTrustedLocatorCount: 4,
      },
      publicMetadataCoverage: {
        officialCompleteDiscoveryMetadataPct: 96.5,
        officialDefaultPublicSurfaceReadyPct: 88,
        officialRankingContaminationCount: 2,
        lowTrustReadyCount: 1,
        signalContaminationCount: 3,
      },
      deploymentOperations: {
        staleProvisioningCount: 2,
        failedCount: 6,
      },
      cronOperations: {
        staleJobCount: 1,
        latestFailedJobCount: 1,
      },
      manualBenchmarkSources: {
        count: 2,
        slugs: ["terminal-bench", "osworld"],
      },
    });

    expect(alerts.map((alert) => alert.code)).toEqual([
      "benchmark_official_gaps",
      "missing_trusted_benchmark_locators",
      "official_metadata_completeness",
      "official_discovery_readiness",
      "official_ranking_contamination",
      "low_trust_discovery_ready",
      "low_trust_signal_contamination",
      "stuck_deployment_provisioning",
      "failed_deployments",
      "stale_critical_pipeline_cron_jobs",
      "failed_critical_pipeline_cron_jobs",
      "manual_benchmark_sources_enabled",
    ]);
    expect(computePipelineDataQualityStatus(alerts)).toBe("critical");
  });
});
