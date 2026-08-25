import { describe, expect, it } from "vitest";

import { buildModelEvidenceProfile } from "./evidence-profile";

const EMPTY_SIGNALS = {
  benchmarkCount: 0,
  arenaCount: 0,
  providerBenchmarkCount: 0,
  pricingCount: 0,
  deploymentCount: 0,
  snapshotCount: 0,
  newsCount: 0,
  updateCount: 0,
  metadataEvidenceCount: 0,
};

const EMPTY_MODEL = {
  description: null,
  short_description: null,
  architecture: null,
  parameter_count: null,
  context_window: null,
  release_date: null,
  website_url: null,
  github_url: null,
  hf_model_id: null,
  hf_downloads: 0,
  hf_likes: 0,
  github_stars: null,
  quality_score: null,
  license: "commercial",
  license_name: null,
  is_open_weights: false,
  is_api_available: false,
  data_refreshed_at: null,
};

describe("buildModelEvidenceProfile", () => {
  it("treats evidence coverage as separate from a model's quality score", () => {
    const profile = buildModelEvidenceProfile(
      { ...EMPTY_MODEL, quality_score: 99 },
      EMPTY_SIGNALS
    );

    expect(profile.level).toBe("Limited evidence");
    expect(profile.missing).toEqual(
      expect.arrayContaining([
        "parameter count",
        "context window",
        "evaluation evidence",
      ])
    );
  });

  it("reports strong coverage when independent technical and market signals exist", () => {
    const profile = buildModelEvidenceProfile(
      {
        ...EMPTY_MODEL,
        description: "Verified model profile",
        architecture: "Transformer",
        parameter_count: 70_000_000_000,
        context_window: 131_072,
        release_date: "2026-01-01",
        website_url: "https://example.com/model",
        hf_model_id: "example/model",
        hf_downloads: 10_000,
        quality_score: 75,
        is_open_weights: true,
        data_refreshed_at: "2026-08-25T00:00:00.000Z",
      },
      {
        benchmarkCount: 3,
        arenaCount: 1,
        providerBenchmarkCount: 1,
        pricingCount: 2,
        deploymentCount: 1,
        snapshotCount: 7,
        newsCount: 2,
        updateCount: 1,
        metadataEvidenceCount: 1,
      }
    );

    expect(profile.level).toBe("Strong evidence");
    expect(profile.score).toBeGreaterThanOrEqual(75);
    expect(profile.missing).toEqual([]);
  });
});
