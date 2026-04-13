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

