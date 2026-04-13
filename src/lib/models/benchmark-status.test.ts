import { describe, expect, it } from "vitest";

import { summarizeBenchmarkTrackingCoverage } from "./benchmark-status";

describe("summarizeBenchmarkTrackingCoverage", () => {
  it("counts structured, signal-backed, and pending coverage states", () => {
    const summary = summarizeBenchmarkTrackingCoverage([
      {
        status: "structured",
        label: "Structured benchmark coverage",
        badgeLabel: "Structured",
        summary: "Structured",
        showTrustAsterisk: false,
      },
      {
        status: "provider_reported",
        label: "Provider-reported benchmark coverage",
        badgeLabel: "Provider-reported*",
        summary: "Provider",
        showTrustAsterisk: true,
      },
      {
        status: "arena_only",
        label: "Arena-only competitive signal",
        badgeLabel: "Arena only",
        summary: "Arena",
        showTrustAsterisk: false,
      },
      {
        status: "pending",
        label: "Benchmark coverage pending",
        badgeLabel: "Pending",
        summary: "Pending",
        showTrustAsterisk: false,
      },
      {
        status: "not_standardized",
        label: "No stable public benchmark standard",
        badgeLabel: "Not standardized",
        summary: "Not standardized",
        showTrustAsterisk: false,
      },
    ]);

    expect(summary).toEqual({
      total: 5,
      structured: 1,
      providerReported: 1,
      arenaOnly: 1,
      pending: 1,
      notStandardized: 1,
      comparable: 1,
      signalBacked: 2,
    });
  });
});
