import { describe, expect, it } from "vitest";

import {
  buildUxIssueStateMap,
  isBenchmarkCoverageIssueResolved,
  isBenchmarkSourceIssueResolved,
  isCrawlerSurfaceIssueResolved,
  isHomepageRankingIssueResolved,
  isManualBenchmarkSourceIssueResolved,
  isPipelineCronIssueResolved,
  isStripePaymentsIssueResolved,
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
        sourceSlug: "legacy-manual-benchmark",
        enabledSourceSlugs: new Set(["provider-news"]),
      })
    ).toBe(true);
  });

  it("resolves when a source remains enabled but is no longer classified as manual", () => {
    expect(
      isManualBenchmarkSourceIssueResolved({
        sourceSlug: "terminal-bench",
        enabledSourceSlugs: new Set(["terminal-bench", "provider-news"]),
      })
    ).toBe(true);
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

describe("isBenchmarkSourceIssueResolved", () => {
  it("resolves when the benchmark source is healthy", () => {
    expect(
      isBenchmarkSourceIssueResolved({
        sourceSlug: "terminal-bench",
        enabledSourceSlugs: new Set(["terminal-bench"]),
        benchmarkSourceHealthBySlug: new Map([
          [
            "terminal-bench",
            {
              slug: "terminal-bench",
              status: "healthy",
              lastSync: "2026-03-30T00:00:00.000Z",
              consecutiveFailures: 0,
              recordCount: 10,
              error: null,
            },
          ],
        ]),
      })
    ).toBe(true);
  });

  it("resolves when the source is disabled or no longer classified as a benchmark source", () => {
    expect(
      isBenchmarkSourceIssueResolved({
        sourceSlug: "terminal-bench",
        enabledSourceSlugs: new Set(["provider-news"]),
        benchmarkSourceHealthBySlug: new Map(),
      })
    ).toBe(true);

    expect(
      isBenchmarkSourceIssueResolved({
        sourceSlug: "provider-news",
        enabledSourceSlugs: new Set(["provider-news"]),
        benchmarkSourceHealthBySlug: new Map(),
      })
    ).toBe(true);
  });

  it("keeps the issue open when the benchmark source is still degraded or down", () => {
    expect(
      isBenchmarkSourceIssueResolved({
        sourceSlug: "terminal-bench",
        enabledSourceSlugs: new Set(["terminal-bench"]),
        benchmarkSourceHealthBySlug: new Map([
          [
            "terminal-bench",
            {
              slug: "terminal-bench",
              status: "degraded",
              lastSync: "2026-03-28T00:00:00.000Z",
              consecutiveFailures: 1,
              recordCount: 0,
              error: "timeout",
            },
          ],
        ]),
      })
    ).toBe(false);
  });
});

describe("isCrawlerSurfaceIssueResolved", () => {
  it("resolves only when crawler-critical routes are healthy and warning-free", () => {
    expect(
      isCrawlerSurfaceIssueResolved({
        healthy: true,
        warningCount: 0,
      })
    ).toBe(true);

    expect(
      isCrawlerSurfaceIssueResolved({
        healthy: false,
        warningCount: 0,
      })
    ).toBe(false);

    expect(
      isCrawlerSurfaceIssueResolved({
        healthy: true,
        warningCount: 2,
      })
    ).toBe(false);
  });
});

describe("isStripePaymentsIssueResolved", () => {
  it("resolves when Stripe is either fully healthy or intentionally disabled", () => {
    expect(
      isStripePaymentsIssueResolved({
        status: "ready",
        checkoutConfigured: true,
        webhookConfigured: true,
        publishableKeyConfigured: true,
        blockingIssues: [],
        webhookDelivery: {
          status: "healthy",
          tableAvailable: true,
          recentFailures24h: 0,
          recentSuccesses24h: 1,
          consecutiveFailures: 0,
          latestEventAt: "2026-03-30T01:00:00.000Z",
          latestProcessedAt: "2026-03-30T01:00:00.000Z",
          latestFailedAt: null,
          warning: null,
        },
      })
    ).toBe(true);

    expect(
      isStripePaymentsIssueResolved({
        status: "disabled",
        checkoutConfigured: false,
        webhookConfigured: false,
        publishableKeyConfigured: false,
        blockingIssues: [],
        webhookDelivery: {
          status: "unknown",
          tableAvailable: null,
          recentFailures24h: 0,
          recentSuccesses24h: 0,
          consecutiveFailures: 0,
          latestEventAt: null,
          latestProcessedAt: null,
          latestFailedAt: null,
          warning: null,
        },
      })
    ).toBe(true);
  });

  it("does not resolve while Stripe is partially configured or webhook delivery is degraded", () => {
    expect(
      isStripePaymentsIssueResolved({
        status: "partial",
        checkoutConfigured: true,
        webhookConfigured: false,
        publishableKeyConfigured: true,
        blockingIssues: ["missing webhook"],
        webhookDelivery: {
          status: "unknown",
          tableAvailable: null,
          recentFailures24h: 0,
          recentSuccesses24h: 0,
          consecutiveFailures: 0,
          latestEventAt: null,
          latestProcessedAt: null,
          latestFailedAt: null,
          warning: null,
        },
      })
    ).toBe(false);

    expect(
      isStripePaymentsIssueResolved({
        status: "ready",
        checkoutConfigured: true,
        webhookConfigured: true,
        publishableKeyConfigured: true,
        blockingIssues: [],
        webhookDelivery: {
          status: "degraded",
          tableAvailable: true,
          recentFailures24h: 2,
          recentSuccesses24h: 0,
          consecutiveFailures: 2,
          latestEventAt: "2026-03-30T01:00:00.000Z",
          latestProcessedAt: null,
          latestFailedAt: "2026-03-30T01:00:00.000Z",
          warning: null,
        },
      })
    ).toBe(false);
  });
});

describe("isHomepageRankingIssueResolved", () => {
  it("resolves only when homepage shortlist health is green", () => {
    expect(isHomepageRankingIssueResolved({ healthy: true })).toBe(true);
    expect(isHomepageRankingIssueResolved({ healthy: false })).toBe(false);
  });
});
