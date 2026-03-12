/**
 * Data Integrity Verification Engine
 *
 * Core verification logic for checking end-to-end data flow from adapters
 * through the database. Detects empty tables, reports freshness violations,
 * and computes per-source quality scores.
 *
 * All computation functions are pure (no side effects) for easy testing.
 * verifyDataIntegrity() orchestrates DB queries and assembles the full report.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncOutputType } from "@/lib/data-sources/types";

// ---------------------------------------------------------------------------
// TABLE_MAP: SyncOutputType -> actual Supabase table name
// ---------------------------------------------------------------------------
// Verified by grepping adapter code:
//   - benchmarks  -> benchmark_scores (from artificial-analysis, livebench, etc.)
//   - elo_ratings -> elo_ratings      (from chatbot-arena)
//   - news        -> model_news       (from livebench, arxiv, etc.)
//   - pricing     -> model_pricing    (from openrouter-models)
//   - rankings    -> models           (rankings update model rows directly)
//   - models      -> models
// ---------------------------------------------------------------------------

export const TABLE_MAP: Record<SyncOutputType, string> = {
  models: "models",
  benchmarks: "benchmark_scores",
  pricing: "model_pricing",
  elo_ratings: "elo_ratings",
  news: "model_news",
  rankings: "models",
};

// ---------------------------------------------------------------------------
// Expected minimum row counts per output type
// ---------------------------------------------------------------------------

const EXPECTED_MINIMUMS: Record<SyncOutputType, number> = {
  models: 100,
  benchmarks: 50,
  pricing: 50,
  elo_ratings: 20,
  news: 10,
  rankings: 100,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceQualityScore {
  slug: string;
  name: string;
  qualityScore: number;
  completeness: number; // 0-1
  freshness: number; // 0-1
  trend: number; // 0-1
  recordCount: number;
  lastSyncAt: string | null;
  syncIntervalHours: number;
  staleSince: string | null; // ISO timestamp when source became stale, null if fresh
  isStale: boolean;
}

export interface TableCoverage {
  table: string;
  rowCount: number;
  isEmpty: boolean;
  responsibleAdapters: string[]; // adapter slugs that write to this table
}

export interface DataIntegrityReport {
  checkedAt: string;
  summary: {
    totalSources: number;
    healthySources: number;
    staleSources: number;
    emptyTables: number;
    averageQualityScore: number;
  };
  qualityScores: SourceQualityScore[];
  tableCoverage: TableCoverage[];
  freshness: {
    staleSourceCount: number;
    staleSources: Array<{
      slug: string;
      name: string;
      lastSyncAt: string | null;
      expectedIntervalHours: number;
      overdueBy: string;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Pure computation functions
// ---------------------------------------------------------------------------

/**
 * Compute completeness score (0-1) based on record count vs expected minimum.
 * Clamped to [0, 1].
 */
export function computeCompleteness(
  recordCount: number,
  expectedMinimum: number
): number {
  if (expectedMinimum <= 0) return recordCount > 0 ? 1.0 : 0;
  return Math.min(1.0, recordCount / expectedMinimum);
}

/**
 * Compute freshness score (0-1).
 *
 * - Returns 0 if lastSyncAt is null (never synced)
 * - Returns 1.0 if within interval
 * - Linear decay from 1.0 to 0 between interval and 4x interval
 * - Returns 0 beyond 4x interval
 */
export function computeFreshness(
  lastSyncAt: string | null,
  intervalHours: number
): number {
  if (!lastSyncAt) return 0;

  const now = Date.now();
  const lastSync = new Date(lastSyncAt).getTime();
  const ageMs = now - lastSync;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  // Within interval: fully fresh
  if (ageMs <= intervalMs) return 1.0;

  // Beyond 4x interval: fully stale
  const maxMs = 4 * intervalMs;
  if (ageMs >= maxMs) return 0;

  // Linear decay in the overdue zone [intervalMs, 4x intervalMs]
  // 1.0 at intervalMs, 0 at 4x intervalMs
  const overdueRange = maxMs - intervalMs; // = 3 * intervalMs
  const overdueMs = ageMs - intervalMs;
  return 1.0 - overdueMs / overdueRange;
}

/**
 * Compute trend score (0-1).
 *
 * - Returns 1.0 if no baseline (previousCount === 0)
 * - Returns 1.0 if latest >= previous
 * - Linear interpolation based on ratio if latest < previous
 * - Minimum 0
 */
export function computeTrend(
  latestCount: number,
  previousCount: number
): number {
  if (previousCount === 0) return 1.0;
  if (latestCount >= previousCount) return 1.0;
  return Math.max(0, latestCount / previousCount);
}

/**
 * Compute overall quality score (0-100) from the three component scores.
 * Weights: completeness=40%, freshness=40%, trend=20%.
 */
export function computeQualityScore(params: {
  completeness: number;
  freshness: number;
  trend: number;
}): number {
  const weighted =
    params.completeness * 0.4 +
    params.freshness * 0.4 +
    params.trend * 0.2;
  return Math.round(weighted * 100);
}

// ---------------------------------------------------------------------------
// Duration formatting helper
// ---------------------------------------------------------------------------

/**
 * Format a duration in milliseconds as a human-readable string.
 * Examples: "2h 30m", "3d 12h", "45m"
 */
function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalDays > 0) {
    const remainingHours = totalHours % 24;
    return remainingHours > 0
      ? `${totalDays}d ${remainingHours}h`
      : `${totalDays}d`;
  }

  if (totalHours > 0) {
    const remainingMinutes = totalMinutes % 60;
    return remainingMinutes > 0
      ? `${totalHours}h ${remainingMinutes}m`
      : `${totalHours}h`;
  }

  return `${totalMinutes}m`;
}

// ---------------------------------------------------------------------------
// Type for the data source rows we fetch
// ---------------------------------------------------------------------------

interface DataSourceRow {
  slug: string;
  name: string;
  output_types: string[];
  sync_interval_hours: number;
  last_sync_at: string | null;
  last_sync_records: number | null;
  is_enabled: boolean;
}

interface PipelineHealthRow {
  source_slug: string;
  last_success_at: string | null;
  expected_interval_hours: number;
  consecutive_failures: number;
}

interface SyncJobRow {
  source_slug: string;
  records_processed: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Main verification function
// ---------------------------------------------------------------------------

/**
 * Run a full data integrity check and return a structured report.
 *
 * Queries:
 *   - data_sources: adapter config and last sync info
 *   - pipeline_health: freshness data (last_success_at)
 *   - sync_jobs: recent job records for trend computation (last 2 per source)
 *   - each expected table: row count via count query
 */
export async function verifyDataIntegrity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<DataIntegrityReport> {
  const checkedAt = new Date().toISOString();
  const now = Date.now();

  // ── Fetch data sources ────────────────────────────────────────────────────
  const { data: rawDataSources, error: dsError } = await supabase
    .from("data_sources")
    .select(
      "slug, name, output_types, sync_interval_hours, last_sync_at, last_sync_records, is_enabled"
    );

  if (dsError) {
    throw new Error(`Failed to fetch data_sources: ${dsError.message}`);
  }

  const dataSources: DataSourceRow[] = rawDataSources ?? [];

  // ── Fetch pipeline_health rows ────────────────────────────────────────────
  const { data: rawPipelineHealth, error: phError } = await supabase
    .from("pipeline_health")
    .select(
      "source_slug, last_success_at, expected_interval_hours, consecutive_failures"
    );

  if (phError) {
    throw new Error(`Failed to fetch pipeline_health: ${phError.message}`);
  }

  const pipelineHealth: PipelineHealthRow[] = rawPipelineHealth ?? [];
  const healthBySlug = new Map(pipelineHealth.map((r) => [r.source_slug, r]));

  // ── Fetch recent sync_jobs (last 2 per source) ────────────────────────────
  const { data: rawSyncJobs, error: sjError } = await supabase
    .from("sync_jobs")
    .select("source_slug, records_processed, created_at")
    .order("created_at", { ascending: false })
    .limit(200); // fetch enough to get 2 per source across all sources

  if (sjError) {
    throw new Error(`Failed to fetch sync_jobs: ${sjError.message}`);
  }

  // Build map: slug -> last 2 jobs
  const syncJobsBySlug = new Map<string, SyncJobRow[]>();
  for (const job of rawSyncJobs ?? []) {
    const existing = syncJobsBySlug.get(job.source_slug) ?? [];
    if (existing.length < 2) {
      existing.push(job as SyncJobRow);
      syncJobsBySlug.set(job.source_slug, existing);
    }
  }

  // ── Determine which tables to check ──────────────────────────────────────
  // Collect unique DB table names from all enabled adapters' output_types
  const tableToAdapters = new Map<string, string[]>();
  for (const source of dataSources) {
    if (!source.is_enabled) continue;
    const outputTypes = (source.output_types ?? []) as SyncOutputType[];
    for (const ot of outputTypes) {
      const tableName = TABLE_MAP[ot];
      if (!tableName) continue;
      const adapters = tableToAdapters.get(tableName) ?? [];
      if (!adapters.includes(source.slug)) {
        adapters.push(source.slug);
      }
      tableToAdapters.set(tableName, adapters);
    }
  }

  // ── Count rows in each expected table ────────────────────────────────────
  const tableCountResults = await Promise.all(
    Array.from(tableToAdapters.keys()).map(async (tableName) => {
      const { count, error } = await supabase
        .from(tableName)
        .select("*", { count: "exact", head: true });
      return { tableName, count: count ?? 0, error };
    })
  );

  const tableRowCounts = new Map<string, number>();
  for (const { tableName, count } of tableCountResults) {
    tableRowCounts.set(tableName, count);
  }

  // ── Compute quality scores per source ────────────────────────────────────
  const qualityScores: SourceQualityScore[] = [];

  for (const source of dataSources) {
    const healthRow = healthBySlug.get(source.slug);
    const lastSyncAt = healthRow?.last_success_at ?? source.last_sync_at;
    const intervalHours = source.sync_interval_hours ?? 6;

    // Freshness
    const freshnessScore = computeFreshness(lastSyncAt, intervalHours);

    // Completeness: use last_sync_records vs expected minimum for primary output_type
    const outputTypes = (source.output_types ?? []) as SyncOutputType[];
    const primaryOutputType = outputTypes[0] ?? "models";
    const expectedMin = EXPECTED_MINIMUMS[primaryOutputType] ?? 50;
    const recordCount = source.last_sync_records ?? 0;
    const completenessScore = computeCompleteness(recordCount, expectedMin);

    // Trend: compare last 2 sync jobs
    const jobs = syncJobsBySlug.get(source.slug) ?? [];
    const latestCount = jobs[0]?.records_processed ?? 0;
    const previousCount = jobs[1]?.records_processed ?? 0;
    const trendScore = computeTrend(latestCount, previousCount);

    const qualityScore = computeQualityScore({
      completeness: completenessScore,
      freshness: freshnessScore,
      trend: trendScore,
    });

    // Determine staleness
    const isStale = freshnessScore === 0;
    let staleSince: string | null = null;

    if (isStale && lastSyncAt) {
      // staleSince = when it first became stale (= lastSyncAt + intervalHours)
      const lastSyncMs = new Date(lastSyncAt).getTime();
      staleSince = new Date(
        lastSyncMs + intervalHours * 60 * 60 * 1000
      ).toISOString();
    } else if (isStale && !lastSyncAt) {
      // Never synced — stale from the start; use epoch as sentinel
      staleSince = new Date(0).toISOString();
    }

    qualityScores.push({
      slug: source.slug,
      name: source.name,
      qualityScore,
      completeness: completenessScore,
      freshness: freshnessScore,
      trend: trendScore,
      recordCount,
      lastSyncAt,
      syncIntervalHours: intervalHours,
      staleSince,
      isStale,
    });
  }

  // ── Build table coverage ──────────────────────────────────────────────────
  const tableCoverage: TableCoverage[] = Array.from(
    tableToAdapters.entries()
  ).map(([table, adapters]) => {
    const rowCount = tableRowCounts.get(table) ?? 0;
    return {
      table,
      rowCount,
      isEmpty: rowCount === 0,
      responsibleAdapters: adapters,
    };
  });

  // ── Build freshness report ────────────────────────────────────────────────
  const staleSources: DataIntegrityReport["freshness"]["staleSources"] = [];

  for (const source of dataSources) {
    const healthRow = healthBySlug.get(source.slug);
    const lastSyncAt = healthRow?.last_success_at ?? source.last_sync_at;
    const intervalHours = source.sync_interval_hours ?? 6;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    const isStale =
      !lastSyncAt ||
      now - new Date(lastSyncAt).getTime() > intervalMs;

    if (isStale) {
      let overdueMs = 0;
      if (lastSyncAt) {
        overdueMs = now - new Date(lastSyncAt).getTime() - intervalMs;
      } else {
        overdueMs = intervalMs; // Never synced: treat as 1 interval overdue
      }
      overdueMs = Math.max(0, overdueMs);

      staleSources.push({
        slug: source.slug,
        name: source.name,
        lastSyncAt,
        expectedIntervalHours: intervalHours,
        overdueBy: formatDuration(overdueMs),
      });
    }
  }

  // ── Assemble summary ──────────────────────────────────────────────────────
  const totalSources = dataSources.length;
  const staleCount = qualityScores.filter((s) => s.isStale).length;
  const healthySources = totalSources - staleCount;
  const emptyTables = tableCoverage.filter((t) => t.isEmpty).length;
  const averageQualityScore =
    totalSources > 0
      ? Math.round(
          qualityScores.reduce((sum, s) => sum + s.qualityScore, 0) /
            totalSources
        )
      : 0;

  return {
    checkedAt,
    summary: {
      totalSources,
      healthySources,
      staleSources: staleCount,
      emptyTables,
      averageQualityScore,
    },
    qualityScores,
    tableCoverage,
    freshness: {
      staleSourceCount: staleSources.length,
      staleSources,
    },
  };
}
