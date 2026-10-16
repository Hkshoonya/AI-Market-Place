import { describe, expect, it } from "vitest";
import { BENCHMARKS } from "@/lib/constants/benchmarks";
import { CATEGORIES } from "@/lib/constants/categories";
import { DATA_SOURCE_SEEDS } from "@/lib/data-sources/seed-config";
import { TRUSTED_STRUCTURED_BENCHMARK_SOURCES } from "@/lib/models/benchmark-score-trust";
import { countDistinctKnownModels } from "@/lib/models/known-model-meta";
import { OFFICIAL_PROVIDERS } from "@/lib/models/public-source-trust";
import { PUBLIC_LENS_CONFIG } from "@/lib/models/public-lenses";
import { getMethodologyFacts } from "./facts";

describe("methodology facts", () => {
  const facts = getMethodologyFacts();

  it("uses the five public lenses and the code-backed catalog counts", () => {
    expect(facts.lenses.map((lens) => lens.label)).toEqual(
      PUBLIC_LENS_CONFIG.map((lens) => lens.label)
    );
    expect(facts.benchmarkCount).toBe(BENCHMARKS.length);
    expect(facts.exampleBenchmarkNames).toEqual(["MMLU", "HellaSwag", "HumanEval"]);
    expect(facts.categoryCount).toBe(CATEGORIES.length);
    expect(facts.officialProviderCount).toBe(OFFICIAL_PROVIDERS.size);
    expect(facts.officialProviderNames).toHaveLength(OFFICIAL_PROVIDERS.size);
    expect(facts.knownModelCount).toBe(countDistinctKnownModels());
    expect(facts.knownModelCount).toBeGreaterThan(0);
    expect(facts.trustedStructuredSourceCount).toBe(
      TRUSTED_STRUCTURED_BENCHMARK_SOURCES.size
    );
  });

  it("describes the tiered sync schedule that the cron jobs actually run", () => {
    const enabledSources = DATA_SOURCE_SEEDS.filter((seed) => seed.is_enabled).map(
      (seed) => seed.name
    );
    const listedSources = facts.cadence.flatMap((group) => group.sources);

    expect(listedSources).toHaveLength(enabledSources.length);
    expect(new Set(listedSources)).toEqual(new Set(enabledSources));
    expect(facts.cadence.map((group) => group.intervalLabel)).toEqual([
      "About every hour",
      "About every 2 hours",
      "About every 4 hours",
      "About every 8 hours",
      "Daily",
    ]);
    expect(facts.cadence.flatMap((group) => group.sources).join(" ")).not.toMatch(/6 hours/);
    expect(
      facts.cadence.find((group) => group.id === "hourly")?.sources
    ).toEqual(expect.arrayContaining(["Provider News", "X.com Model Announcements"]));
    expect(
      facts.cadence.find((group) => group.id === "two-hour")?.sources
    ).toEqual(
      expect.arrayContaining([
        "OpenAI Models",
        "Anthropic Models",
        "Google Models",
        "OpenRouter Models",
      ])
    );
    expect(
      facts.cadence.find((group) => group.id === "two-hour")?.sources
    ).not.toEqual(expect.arrayContaining(["Provider News", "X.com Model Announcements"]));
    expect(facts.rankingRecompute).toBe("Rankings recompute about every 2 hours.");
  });

  it("keeps value, quality, and evidence claims tied to the ranking rules", () => {
    const value = facts.lenses.find((lens) => lens.value === "value");
    expect(value?.weightSummary).toMatch(/not treated as free/i);
    expect(value?.weightSummary).toContain(`${facts.verifiedPricingMaxAgeDays} days`);
    expect(facts.qualitySummary).toMatch(/0–100/);
    expect(facts.qualitySummary).toContain("MMLU");
    expect(facts.evidenceTiers.map((tier) => tier.badgeLabel)).toEqual([
      "Structured",
      "Provider-reported*",
      "Arena only",
      "Pending",
      "Not standardized",
    ]);
    expect(facts.defaultLensLabel).toBe("Economic Footprint");
    expect(facts.overallRankSummary).toMatch(/overall rank/i);
  });
});
