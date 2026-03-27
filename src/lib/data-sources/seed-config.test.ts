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
});
