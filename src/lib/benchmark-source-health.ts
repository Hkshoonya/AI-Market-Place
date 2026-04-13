import { DATA_SOURCE_SEEDS } from "@/lib/data-sources/seed-config";

export const BENCHMARK_SOURCE_SLUGS = new Set(
  DATA_SOURCE_SEEDS.filter(
    (entry) => entry.is_enabled && entry.output_types.includes("benchmarks")
  ).map((entry) => entry.slug)
);

export interface BenchmarkSourceHealthAdapter {
  slug: string;
  status: "healthy" | "degraded" | "down";
  lastSync: string | null;
  consecutiveFailures: number;
  recordCount: number;
  error: string | null;
}

export function summarizeBenchmarkSourceHealth(
  adapters: BenchmarkSourceHealthAdapter[]
) {
  const benchmarkSources = adapters
    .filter((adapter) => BENCHMARK_SOURCE_SLUGS.has(adapter.slug))
    .sort((left, right) => left.slug.localeCompare(right.slug));

  let healthy = 0;
  let degraded = 0;
  let down = 0;
  let lastSyncAt: string | null = null;

  for (const source of benchmarkSources) {
    if (source.status === "healthy") healthy += 1;
    else if (source.status === "degraded") degraded += 1;
    else down += 1;

    if (!source.lastSync) continue;
    if (!lastSyncAt || Date.parse(source.lastSync) > Date.parse(lastSyncAt)) {
      lastSyncAt = source.lastSync;
    }
  }

  return {
    total: benchmarkSources.length,
    healthy,
    degraded,
    down,
    lastSyncAt,
    sources: benchmarkSources,
  };
}
