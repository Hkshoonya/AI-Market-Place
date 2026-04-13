const TRUSTED_STRUCTURED_BENCHMARK_SOURCES = new Set<string>([
  "aider",
  "arena-hard-auto",
  "artificial-analysis",
  "bigcode-leaderboard",
  "gaia-benchmark",
  "livebench",
  "livecodebench",
  "open-llm-leaderboard",
  "open-vlm-leaderboard",
  "osworld",
  "seal-leaderboard",
  "swe-bench",
  "tau-bench",
  "terminal-bench",
  "webarena",
]);

type BenchmarkScoreSourceRow = {
  source?: string | null;
};

function getBenchmarkScoreSource(row: unknown) {
  if (!row || typeof row !== "object" || !("source" in row)) {
    return null;
  }

  return typeof row.source === "string" ? row.source : null;
}

export function isTrustedStructuredBenchmarkSource(source: string | null | undefined) {
  return typeof source === "string" && TRUSTED_STRUCTURED_BENCHMARK_SOURCES.has(source);
}

export function countTrustedStructuredBenchmarkScores(rows: unknown) {
  if (!Array.isArray(rows)) return 0;

  let count = 0;
  for (const row of rows) {
    if (isTrustedStructuredBenchmarkSource(getBenchmarkScoreSource(row))) {
      count += 1;
    }
  }

  return count;
}

export function filterTrustedStructuredBenchmarkScores<T extends BenchmarkScoreSourceRow>(
  rows: T[] | null | undefined
): T[];
export function filterTrustedStructuredBenchmarkScores(
  rows: unknown
): BenchmarkScoreSourceRow[];
export function filterTrustedStructuredBenchmarkScores<T extends BenchmarkScoreSourceRow>(
  rows: T[] | null | undefined | unknown
): T[] {
  if (!Array.isArray(rows)) return [];

  return rows.filter((row) =>
    isTrustedStructuredBenchmarkSource(getBenchmarkScoreSource(row))
  ) as T[];
}

export function getTrustedStructuredBenchmarkModelIds(rows: unknown) {
  const modelIds = new Set<string>();
  if (!Array.isArray(rows)) return modelIds;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    if (!("model_id" in row) || typeof row.model_id !== "string") continue;
    if (!isTrustedStructuredBenchmarkSource(getBenchmarkScoreSource(row))) continue;
    modelIds.add(row.model_id);
  }

  return modelIds;
}
