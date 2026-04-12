import { describe, expect, it } from "vitest";

import {
  buildUxIssueStateMap,
  isBenchmarkCoverageIssueResolved,
  isManualBenchmarkSourceIssueResolved,
  isPipelineCronIssueResolved,
  isRuntimeIssueResolved,
  isSourceIssueResolved,
  type UxIssueSnapshot,
} from "./verifier";

describe("isSourceIssueResolved", () => {
  it("resolves when the source is successful and has no recent failed sync jobs", () => {
    expect(
      isSourceIssueResolved({
        isEnabled: true,
        quarantinedAt: null,
        lastSyncStatus: "success",
        lastSuccessAt: "2026-03-16T12:00:00.000Z",
        lastSyncAt: "2026-03-16T12:00:00.000Z",
        failedSyncJobs24h: 0,
      })
    ).toBe(true);
  });

  it("does not resolve when failures are still present", () => {
    expect(
      isSourceIssueResolved({
        isEnabled: true,
        quarantinedAt: null,
        lastSyncStatus: "success",
        lastSuccessAt: "2026-03-16T12:00:00.000Z",
        lastSyncAt: "2026-03-16T12:00:00.000Z",
        failedSyncJobs24h: 2,
      })
    ).toBe(false);
  });

  it("resolves disabled or quarantined sources even if old failures remain", () => {
    expect(
      isSourceIssueResolved({
        isEnabled: false,
        quarantinedAt: null,
        lastSyncStatus: "failed",
        lastSuccessAt: null,
        lastSyncAt: null,
        failedSyncJobs24h: 4,
      })
    ).toBe(true);

    expect(
      isSourceIssueResolved({
        isEnabled: true,
        quarantinedAt: "2026-03-30T00:00:00.000Z",
        lastSyncStatus: "failed",
        lastSuccessAt: null,
        lastSyncAt: null,
        failedSyncJobs24h: 4,
      })
    ).toBe(true);
  });
});

describe("buildUxIssueStateMap", () => {
  it("maps current coverage metrics into the known UX issue slugs", () => {
    const snapshot: UxIssueSnapshot = {
      totalModels: 100,
      missingDescription: 26,
      missingBenchmarks: 60,
      missingPricing: 40,
      totalListings: 10,
      staleListings: 3,
    };

    expect(buildUxIssueStateMap(snapshot)).toEqual({
      "ux-missing-model-descriptions": true,
      "ux-missing-benchmark-coverage": true,
      "ux-missing-pricing-coverage": true,
      "ux-stale-marketplace-listings": true,
    });
  });

  it("marks UX issues resolved once thresholds are back under control", () => {
    const snapshot: UxIssueSnapshot = {
      totalModels: 100,
      missingDescription: 20,
      missingBenchmarks: 20,
      missingPricing: 10,
      totalListings: 12,
      staleListings: 0,
    };

    expect(buildUxIssueStateMap(snapshot)).toEqual({
      "ux-missing-model-descriptions": false,
      "ux-missing-benchmark-coverage": false,
      "ux-missing-pricing-coverage": false,
      "ux-stale-marketplace-listings": false,
    });
  });
});

describe("isRuntimeIssueResolved", () => {
  it("resolves when the matching runtime error pattern no longer appears", () => {
    expect(
      isRuntimeIssueResolved(
        ["Supabase insert failed for request 17", "Another unrelated error"],
        "OpenRouter returned HTTP 503 for request 19"
      )
    ).toBe(true);
  });

  it("keeps the issue open when the normalized error pattern still appears", () => {
    expect(
      isRuntimeIssueResolved(
        [
          "OpenRouter returned HTTP 503 for request 17",
          "Supabase insert failed for request 44",
        ],
        "OpenRouter returned HTTP 503 for request 19"
      )
    ).toBe(false);
  });
});

describe("isPipelineCronIssueResolved", () => {
  it("resolves only when the latest critical cron run completed and is fresh", () => {
    expect(isPipelineCronIssueResolved({ status: "completed", stale: false })).toBe(true);
    expect(isPipelineCronIssueResolved({ status: "failed", stale: false })).toBe(false);
    expect(isPipelineCronIssueResolved({ status: "completed", stale: true })).toBe(false);
    expect(isPipelineCronIssueResolved({ status: "running", stale: false })).toBe(false);
  });
});

describe("isManualBenchmarkSourceIssueResolved", () => {
  it("resolves when the manual benchmark source is no longer enabled", () => {
    expect(
      isManualBenchmarkSourceIssueResolved({
        sourceSlug: "terminal-bench",
        enabledSourceSlugs: new Set(["provider-news"]),
      })
    ).toBe(true);
  });

  it("stays open while the manual benchmark source remains enabled", () => {
    expect(
      isManualBenchmarkSourceIssueResolved({
        sourceSlug: "terminal-bench",
        enabledSourceSlugs: new Set(["terminal-bench"]),
      })
    ).toBe(false);
  });
});

describe("isBenchmarkCoverageIssueResolved", () => {
  it("resolves only when both benchmark gap counts are zero", () => {
    expect(
      isBenchmarkCoverageIssueResolved({
        officialGapCount: 0,
        missingTrustedLocatorCount: 0,
      })
    ).toBe(true);

    expect(
      isBenchmarkCoverageIssueResolved({
        officialGapCount: 1,
        missingTrustedLocatorCount: 0,
      })
    ).toBe(false);

    expect(
      isBenchmarkCoverageIssueResolved({
        officialGapCount: 0,
        missingTrustedLocatorCount: 2,
      })
    ).toBe(false);
  });
});
