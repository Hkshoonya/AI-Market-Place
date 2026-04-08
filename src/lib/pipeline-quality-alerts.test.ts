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
      },
    });

    expect(alerts.map((alert) => alert.code)).toEqual([
      "benchmark_official_gaps",
      "missing_trusted_benchmark_locators",
      "official_metadata_completeness",
      "official_discovery_readiness",
      "official_ranking_contamination",
    ]);
    expect(computePipelineDataQualityStatus(alerts)).toBe("critical");
  });
});
