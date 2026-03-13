export type CorroborationLevel =
  | "none"
  | "single_source"
  | "multi_source"
  | "strong";

export type BiasRiskLevel = "low" | "medium" | "high";

export interface SourceCoverage {
  totalDistinctSources: number;
  independentQualitySourceCount: number;
  sourceFamilyCount: number;
  benchmarkSourceCount: number;
  benchmarkCategoryCount: number;
  eloSourceCount: number;
  newsSourceCount: number;
  pricingSourceCount: number;
  corroborationLevel: CorroborationLevel;
  biasRisk: BiasRiskLevel;
  sourceFamilies: string[];
  benchmarkSources: string[];
  benchmarkCategories: string[];
  eloSources: string[];
  newsSources: string[];
  pricingSources: string[];
  hasCommunitySignals: boolean;
}

export interface SourceCoverageSignals {
  benchmarkSources: Iterable<string>;
  benchmarkCategories: Iterable<string>;
  eloSources: Iterable<string>;
  newsSources: Iterable<string>;
  pricingSources: Iterable<string>;
  hasCommunitySignals: boolean;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(
    new Set(
      Array.from(values)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).sort();
}

export function buildSourceCoverage(
  signals: SourceCoverageSignals
): SourceCoverage {
  const benchmarkSources = uniqueSorted(signals.benchmarkSources);
  const benchmarkCategories = uniqueSorted(signals.benchmarkCategories);
  const eloSources = uniqueSorted(signals.eloSources);
  const newsSources = uniqueSorted(signals.newsSources);
  const pricingSources = uniqueSorted(signals.pricingSources);

  const sourceFamilies = [
    benchmarkSources.length > 0 ? "benchmarks" : null,
    eloSources.length > 0 ? "elo" : null,
    newsSources.length > 0 ? "news" : null,
    pricingSources.length > 0 ? "pricing" : null,
    signals.hasCommunitySignals ? "community" : null,
  ].filter((family): family is string => family !== null);

  const totalDistinctSources = new Set([
    ...benchmarkSources,
    ...eloSources,
    ...newsSources,
    ...pricingSources,
    ...(signals.hasCommunitySignals ? ["community-signals"] : []),
  ]).size;

  const independentQualitySourceCount =
    new Set([...benchmarkSources, ...eloSources]).size;

  let corroborationLevel: CorroborationLevel = "none";
  if (independentQualitySourceCount >= 3) corroborationLevel = "strong";
  else if (independentQualitySourceCount >= 2) corroborationLevel = "multi_source";
  else if (independentQualitySourceCount === 1) corroborationLevel = "single_source";

  let biasRisk: BiasRiskLevel = "high";
  if (
    corroborationLevel === "strong" ||
    (corroborationLevel === "multi_source" && sourceFamilies.length >= 4)
  ) {
    biasRisk = "low";
  } else if (corroborationLevel === "multi_source" || sourceFamilies.length >= 3) {
    biasRisk = "medium";
  }

  return {
    totalDistinctSources,
    independentQualitySourceCount,
    sourceFamilyCount: sourceFamilies.length,
    benchmarkSourceCount: benchmarkSources.length,
    benchmarkCategoryCount: benchmarkCategories.length,
    eloSourceCount: eloSources.length,
    newsSourceCount: newsSources.length,
    pricingSourceCount: pricingSources.length,
    corroborationLevel,
    biasRisk,
    sourceFamilies,
    benchmarkSources,
    benchmarkCategories,
    eloSources,
    newsSources,
    pricingSources,
    hasCommunitySignals: signals.hasCommunitySignals,
  };
}

export function getCorroborationMultiplier(
  coverage: SourceCoverage | null | undefined
): number {
  if (!coverage) return 1;

  switch (coverage.corroborationLevel) {
    case "single_source":
      return 0.94;
    case "multi_source":
      return 0.98;
    case "strong":
    case "none":
    default:
      return 1;
  }
}
