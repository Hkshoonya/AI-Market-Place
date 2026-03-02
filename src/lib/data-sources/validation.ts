/**
 * Data validation for adapter outputs.
 * Prevents bad data from corrupting scores.
 */

/** Validate a benchmark score is in expected range */
export function isValidBenchmarkScore(score: number, benchmarkSlug: string): boolean {
  if (benchmarkSlug.includes("elo") || benchmarkSlug.includes("arena")) {
    return score >= 500 && score <= 2500;
  }
  return score >= 0 && score <= 100;
}

/** Check if a score changed too much from previous (possible bad data) */
export function isAnomalousChange(
  newScore: number,
  previousScore: number | null,
  maxChangePercent: number = 30
): boolean {
  if (previousScore == null || previousScore === 0) return false;
  const change = Math.abs(newScore - previousScore) / previousScore * 100;
  return change > maxChangePercent;
}

/** Validate model pricing is reasonable */
export function isValidPricing(inputPrice: number, outputPrice: number): boolean {
  if (inputPrice === 0 && outputPrice === 0) return true;
  if (inputPrice < 0 || outputPrice < 0) return false;
  if (inputPrice > 500 || outputPrice > 500) return false;
  return true;
}

/** Validate download counts (should be positive, not absurdly large) */
export function isValidDownloadCount(downloads: number): boolean {
  return downloads >= 0 && downloads < 100_000_000_000;
}
