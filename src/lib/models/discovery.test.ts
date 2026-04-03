import { describe, expect, it } from "vitest";

import {
  computePopularDiscoveryScore,
  computeRecentReleaseDiscoveryScore,
  computeTrendingDiscoveryScore,
  isHighSignalRecentCandidate,
  sortRecentReleaseCandidates,
  sortByReleaseDate,
  sortByDiscoveryScore,
} from "./discovery";

describe("model discovery scoring", () => {
  it("prefers recent high-signal models for trending instead of stale raw download winners", () => {
    const now = new Date("2026-03-14T00:00:00.000Z");

    const stale = computeTrendingDiscoveryScore(
      {
        popularity_score: 48,
        adoption_score: 42,
        economic_footprint_score: 40,
        quality_score: 52,
        hf_downloads: 90_000_000,
        hf_likes: 0,
        hf_trending_score: 0,
        release_date: "2023-01-01",
      },
      now
    );

    const fresh = computeTrendingDiscoveryScore(
      {
        popularity_score: 63,
        adoption_score: 58,
        economic_footprint_score: 55,
        quality_score: 74,
        hf_downloads: 120_000,
        hf_likes: 4_000,
        hf_trending_score: 320,
        release_date: "2026-03-01",
      },
      now
    );

    expect(fresh).toBeGreaterThan(stale);
  });

  it("uses blended traction for popularity instead of raw downloads alone", () => {
    const downloadHeavy = computePopularDiscoveryScore({
      popularity_score: 25,
      adoption_score: 18,
      economic_footprint_score: 16,
      hf_downloads: 500_000_000,
      hf_likes: 1_000,
    });

    const broadlyAdopted = computePopularDiscoveryScore({
      popularity_score: 72,
      adoption_score: 81,
      economic_footprint_score: 68,
      hf_downloads: 3_000_000,
      hf_likes: 9_000,
    });

    expect(broadlyAdopted).toBeGreaterThan(downloadHeavy);
  });

  it("sorts models by the computed discovery score descending", () => {
    const models = sortByDiscoveryScore(
      [
        { slug: "a", popularity_score: 30, adoption_score: 25, economic_footprint_score: 22, hf_downloads: 1_000 },
        { slug: "b", popularity_score: 70, adoption_score: 65, economic_footprint_score: 62, hf_downloads: 10_000 },
      ],
      (model) => computePopularDiscoveryScore(model)
    );

    expect(models.map((model) => model.slug)).toEqual(["b", "a"]);
  });

  it("sorts recent releases by release date first, then quality score", () => {
    const models = sortByReleaseDate([
      { slug: "older-better", release_date: "2026-03-20", quality_score: 91 },
      { slug: "newer-lower", release_date: "2026-03-27", quality_score: 40 },
      { slug: "newer-higher", release_date: "2026-03-27", quality_score: 75 },
    ]);

    expect(models.map((model) => model.slug)).toEqual([
      "newer-higher",
      "newer-lower",
      "older-better",
    ]);
  });

  it("prefers recognized providers when curating recent release candidates", () => {
    const models = sortRecentReleaseCandidates([
      { slug: "community-newer", provider: "randomuser", release_date: "2026-03-27", quality_score: 50 },
      { slug: "provider-slightly-older", provider: "MiniMax", release_date: "2026-03-26", quality_score: 45 },
      { slug: "provider-newer", provider: "Google", release_date: "2026-03-27", quality_score: 40 },
    ]);

    expect(models.map((model) => model.slug)).toEqual([
      "provider-newer",
      "provider-slightly-older",
      "community-newer",
    ]);
  });

  it("filters low-context created-at-only recent candidates", () => {
    expect(
      isHighSignalRecentCandidate({
        provider: "OpenAI",
        created_at: "2026-03-30T04:56:23.444611+00:00",
        release_date: null,
        quality_score: 0,
        capability_score: null,
        adoption_score: 20,
        economic_footprint_score: 10,
        recent_signal_score: 0,
      })
    ).toBe(false);

    expect(
      isHighSignalRecentCandidate({
        provider: "OpenAI",
        created_at: "2026-03-30T04:56:23.444611+00:00",
        release_date: null,
        quality_score: 0,
        capability_score: null,
        recent_signal_score: 2,
      })
    ).toBe(true);

    expect(
      isHighSignalRecentCandidate({
        provider: "OpenAI",
        created_at: "2026-03-30T04:56:23.444611+00:00",
        release_date: null,
        quality_score: 0,
        capability_score: null,
        adoption_score: 53,
        economic_footprint_score: 16,
        recent_signal_score: 0,
      })
    ).toBe(false);

    expect(
      isHighSignalRecentCandidate({
        provider: "randomuser",
        release_date: "2026-04-02",
        quality_score: 62,
        capability_score: null,
        recent_signal_score: 0,
      })
    ).toBe(false);
  });

  it("prefers recent candidates with launch evidence over generic created-at rows", () => {
    const now = new Date("2026-03-31T00:00:00.000Z");
    const generic = computeRecentReleaseDiscoveryScore(
      {
        provider: "OpenAI",
        created_at: "2026-03-30T04:56:23.444611+00:00",
        release_date: null,
        quality_score: 0,
        capability_score: null,
        adoption_score: 53.3,
        economic_footprint_score: 15.7,
        recent_signal_score: 0,
      },
      now
    );
    const evidenced = computeRecentReleaseDiscoveryScore(
      {
        provider: "Z.ai",
        created_at: "2026-03-28T00:48:04.531839+00:00",
        release_date: null,
        quality_score: 0,
        capability_score: null,
        adoption_score: 40.3,
        economic_footprint_score: 13.1,
        recent_signal_score: 3,
      },
      now
    );

    expect(evidenced).toBeGreaterThan(generic);
  });

  it("penalizes packaging-style recent variants against the base launch", () => {
    const models = sortRecentReleaseCandidates([
      {
        slug: "minimax-minimax-m2-7-highspeed",
        name: "MiniMax M2.7 Highspeed",
        provider: "MiniMax",
        release_date: "2026-04-02",
        quality_score: 72,
        capability_score: 74,
      },
      {
        slug: "minimax-minimax-m2-7",
        name: "MiniMax M2.7",
        provider: "MiniMax",
        release_date: "2026-04-02",
        quality_score: 70,
        capability_score: 73,
      },
    ]);

    expect(models.map((model) => model.slug)).toEqual([
      "minimax-minimax-m2-7",
      "minimax-minimax-m2-7-highspeed",
    ]);
  });

  it("prefers mainstream frontier launches over specialist speech and OCR releases", () => {
    const models = sortRecentReleaseCandidates([
      {
        slug: "qwen-qwen3-tts",
        name: "Qwen3 TTS",
        provider: "Qwen",
        category: "speech_audio",
        release_date: "2026-04-02",
        quality_score: 74,
        capability_score: 70,
      },
      {
        slug: "google-gemma-4-31b-it",
        name: "Gemma 4 31B IT",
        provider: "Google",
        category: "multimodal",
        release_date: "2026-04-01",
        quality_score: 76,
        capability_score: 77,
      },
      {
        slug: "nvidia-nemotron-ocr-v2",
        name: "Nemotron OCR v2",
        provider: "NVIDIA",
        category: "multimodal",
        release_date: "2026-04-01",
        quality_score: 73,
        capability_score: 71,
      },
    ]);

    expect(models.map((model) => model.slug)).toEqual([
      "google-gemma-4-31b-it",
      "nvidia-nemotron-ocr-v2",
      "qwen-qwen3-tts",
    ]);
  });
});
