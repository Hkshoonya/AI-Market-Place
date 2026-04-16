import { describe, expect, it } from "vitest";

import { DATA_SOURCE_SEEDS } from "./seed-config";

function getSeed(slug: string) {
  const seed = DATA_SOURCE_SEEDS.find((entry) => entry.slug === slug);
  expect(seed, `missing data source seed for ${slug}`).toBeDefined();
  return seed!;
}

describe("benchmark seed configuration", () => {
  it("keeps public-facing benchmark leaderboards on the faster 8h cadence", () => {
    const fasterBenchmarkSlugs = [
      "livebench",
      "livecodebench",
      "swe-bench",
      "arena-hard-auto",
      "bigcode-leaderboard",
      "open-vlm-leaderboard",
      "aider-polyglot",
    ];

    for (const slug of fasterBenchmarkSlugs) {
      const seed = getSeed(slug);
      expect(seed.tier).toBe(3);
      expect(seed.sync_interval_hours).toBe(8);
      expect(seed.is_enabled).toBe(true);
    }
  });

  it("retires the dead SEAL leaderboard feed by default", () => {
    const seed = getSeed("seal-leaderboard");
    expect(seed.is_enabled).toBe(false);
    expect(seed.sync_interval_hours).toBe(24);
  });

  it("disables arxiv until the upstream API rate limiting is repaired", () => {
    const seed = getSeed("arxiv");
    expect(seed.is_enabled).toBe(false);
    expect(seed.sync_interval_hours).toBe(8);
  });

  it("keeps ollama library deployment tracking on the 4h freshness tier", () => {
    const seed = getSeed("ollama-library");
    expect(seed.tier).toBe(2);
    expect(seed.sync_interval_hours).toBe(4);
    expect(seed.is_enabled).toBe(true);
    expect(seed.output_types).toEqual(["pricing", "news"]);
  });

  it("keeps provider deployment signals on the 4h freshness tier", () => {
    const seed = getSeed("provider-deployment-signals");
    expect(seed.tier).toBe(2);
    expect(seed.sync_interval_hours).toBe(4);
    expect(seed.is_enabled).toBe(true);
  });

  it("promotes provider launch feeds onto the fastest sync tier", () => {
    const providerNews = getSeed("provider-news");
    const xAnnouncements = getSeed("x-announcements");

    expect(providerNews.tier).toBe(1);
    expect(providerNews.sync_interval_hours).toBe(2);
    expect(providerNews.is_enabled).toBe(true);

    expect(xAnnouncements.tier).toBe(1);
    expect(xAnnouncements.sync_interval_hours).toBe(2);
    expect(xAnnouncements.is_enabled).toBe(true);
  });
});
