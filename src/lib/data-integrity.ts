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
import type { PublicSurfaceReadinessBlocker } from "@/lib/models/public-surface-readiness";
import {
  getTrustedBenchmarkHfUrl,
  getTrustedBenchmarkWebsiteUrl,
  isBenchmarkExpectedModel,
} from "@/lib/data-sources/shared/benchmark-coverage";
import { computePublicMetadataCoverage } from "@/lib/public-metadata-coverage-compute";

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
  matchRate: number | null; // 0-100
  warningCount: number;
  optionalSkipCount: number;
  knownCatalogGapCount: number;
  unmatchedModelCount: number;
  lastSyncStatus: "success" | "partial" | "failed" | null;
  diagnosticPenalty: number; // 0-100 points deducted from base score
  issueSummary: string | null;
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
    warningSources: number;
    lowMatchSources: number;
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
  modelEvidence: {
    totalModels: number;
    lowBiasRiskModels: number;
    mediumBiasRiskModels: number;
    highBiasRiskModels: number;
    corroboratedModels: number;
    averageIndependentQualitySources: number;
    averageDistinctSources: number;
  };
  benchmarkMetadata: {
    benchmarkExpectedModels: number;
    withTrustedHfLocator: number;
    withTrustedWebsiteLocator: number;
    withAnyTrustedBenchmarkLocator: number;
    missingTrustedBenchmarkLocatorCount: number;
    trustedLocatorCoveragePct: number;
    missingTrustedBenchmarkLocator: Array<{
      slug: string;
      provider: string;
      category: string | null;
      releaseDate: string | null;
    }>;
  };
  publicMetadata: {
    activeModels: number;
    completeDiscoveryMetadataCount: number;
    completeDiscoveryMetadataPct: number;
    defaultPublicSurfaceReadyCount: number;
    defaultPublicSurfaceReadyPct: number;
    trustTierCounts: {
      official: number;
      trusted_catalog: number;
      community: number;
      wrapper: number;
    };
    lowTrustActiveCount: number;
    lowTrustReadyCount: number;
    topReadinessBlockers: Array<{
      reason: PublicSurfaceReadinessBlocker;
      count: number;
    }>;
    missingCategoryCount: number;
    missingReleaseDateCount: number;
    openWeightsMissingLicenseCount: number;
    llmMissingContextWindowCount: number;
    rankingContaminationCount: number;
    official: {
      activeModels: number;
      completeDiscoveryMetadataCount: number;
      completeDiscoveryMetadataPct: number;
      defaultPublicSurfaceReadyCount: number;
      defaultPublicSurfaceReadyPct: number;
      topReadinessBlockers: Array<{
        reason: PublicSurfaceReadinessBlocker;
        count: number;
      }>;
      missingCategoryCount: number;
      missingReleaseDateCount: number;
      openWeightsMissingLicenseCount: number;
      llmMissingContextWindowCount: number;
      rankingContaminationCount: number;
      providers: Array<{
        provider: string;
        total: number;
        complete: number;
        ready: number;
        complete_pct: number;
        ready_pct: number;
        missingCategoryCount: number;
        missingReleaseDateCount: number;
        releaseDateExemptAliasCount: number;
      }>;
      recentIncompleteModels: Array<{
        slug: string;
        provider: string;
        category: string | null;
        releaseDate: string | null;
      }>;
      recentNotReadyModels: Array<{
        slug: string;
        provider: string;
        category: string | null;
        releaseDate: string | null;
        reasons: PublicSurfaceReadinessBlocker[];
      }>;
      recentRankingContaminationModels: Array<{
        slug: string;
        provider: string;
        category: string | null;
        releaseDate: string | null;
        reasons: PublicSurfaceReadinessBlocker[];
      }>;
    };
    providers: Array<{
      provider: string;
      total: number;
      complete: number;
      ready: number;
      complete_pct: number;
      ready_pct: number;
      missingCategoryCount: number;
      missingReleaseDateCount: number;
      releaseDateExemptAliasCount: number;
    }>;
    recentIncompleteModels: Array<{
      slug: string;
      provider: string;
      category: string | null;
      releaseDate: string | null;
    }>;
    recentNotReadyModels: Array<{
      slug: string;
      provider: string;
      category: string | null;
      releaseDate: string | null;
      reasons: PublicSurfaceReadinessBlocker[];
    }>;
    recentRankingContaminationModels: Array<{
      slug: string;
      provider: string;
      category: string | null;
      releaseDate: string | null;
      reasons: PublicSurfaceReadinessBlocker[];
    }>;
    recentLowTrustModels: Array<{
      slug: string;
      provider: string;
      category: string | null;
      releaseDate: string | null;
      trustTier: "official" | "trusted_catalog" | "community" | "wrapper";
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
  quarantined_at?: string | null;
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
  status: "success" | "partial" | "failed" | null;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface ModelSnapshotCoverageRow {
  source_coverage: {
    biasRisk?: "low" | "medium" | "high";
    corroborationLevel?: string;
    independentQualitySourceCount?: number;
    totalDistinctSources?: number;
  } | null;
}

interface ActiveModelMetadataRow {
  slug: string;
  provider: string;
  category: string | null;
  hf_model_id: string | null;
  website_url: string | null;
  release_date: string | null;
}

interface SyncDiagnostics {
  matchRate: number | null;
  warningCount: number;
  optionalSkipCount: number;
  knownCatalogGapCount: number;
  unmatchedModelCount: number;
  lastSyncStatus: "success" | "partial" | "failed" | null;
  diagnosticPenalty: number;
  issueSummary: string | null;
}

const METADATA_PAGE_SIZE = 1000;

function parseMatchRate(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(100, raw));
  }
  if (typeof raw !== "string") return null;
  const parsed = Number.parseFloat(raw.replace("%", "").trim());
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, parsed));
}

function getArrayCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function extractSyncDiagnostics(job?: SyncJobRow): SyncDiagnostics {
  const metadata = job?.metadata ?? null;
  const matchRateScope = typeof metadata?.matchRateScope === "string"
    ? metadata.matchRateScope
    : null;
  const matchRate =
    matchRateScope === "broad_public_leaderboard"
      ? null
      : parseMatchRate(metadata?.matchRate);
  const knownCatalogGapCount = getArrayCount(metadata?.knownCatalogGapModels);
  const optionalSkipCount = getArrayCount(metadata?.optionalHandleSkips);
  const unmatchedModelCount = Math.max(
    0,
    getArrayCount(metadata?.unmatchedModels) - knownCatalogGapCount
  );

  let rawWarningCount = 0;
  if (
    metadata &&
    typeof metadata.warningCount === "number" &&
    Number.isFinite(metadata.warningCount)
  ) {
    rawWarningCount = metadata.warningCount;
  } else {
    rawWarningCount =
      getArrayCount(metadata?.warnings) +
      getArrayCount(metadata?.providerWarnings) +
      getArrayCount(metadata?.handleWarnings) +
      knownCatalogGapCount +
      optionalSkipCount;
  }

  const structuralWarnings = Math.max(
    0,
    rawWarningCount - optionalSkipCount - knownCatalogGapCount
  );

  let diagnosticPenalty = 0;
  if (job?.status === "failed") diagnosticPenalty += 35;
  else if (job?.status === "partial") diagnosticPenalty += 15;

  if (job?.error_message) diagnosticPenalty += 10;

  if (matchRate !== null) {
    if (matchRate < 15) diagnosticPenalty += 20;
    else if (matchRate < 35) diagnosticPenalty += 12;
    else if (matchRate < 60) diagnosticPenalty += 5;
  }

  diagnosticPenalty += Math.min(15, structuralWarnings * 3);
  diagnosticPenalty += Math.min(10, unmatchedModelCount * 2);
  diagnosticPenalty = Math.min(45, diagnosticPenalty);

  let issueSummary: string | null = null;
  if (job?.status === "failed") {
    issueSummary = job.error_message ?? "Latest sync failed";
  } else if (matchRate !== null && matchRate < 15) {
    issueSummary = `Low match rate: ${matchRate.toFixed(1)}%`;
  } else if (structuralWarnings > 0) {
    issueSummary = `${structuralWarnings} warning${structuralWarnings === 1 ? "" : "s"} in latest sync`;
  } else if (unmatchedModelCount > 0) {
    issueSummary = `${unmatchedModelCount} unmatched model${unmatchedModelCount === 1 ? "" : "s"} in latest sync`;
  }

  return {
    matchRate,
    warningCount: structuralWarnings,
    optionalSkipCount,
    knownCatalogGapCount,
    unmatchedModelCount,
    lastSyncStatus: job?.status ?? null,
    diagnosticPenalty,
    issueSummary,
  };
}

async function fetchAllActiveModelMetadata(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<ActiveModelMetadataRow[]> {
  const rows: ActiveModelMetadataRow[] = [];

  for (let from = 0; ; from += METADATA_PAGE_SIZE) {
    const to = from + METADATA_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("models")
      .select("slug, provider, category, hf_model_id, website_url, release_date")
      .eq("status", "active")
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch active model metadata: ${error.message}`);
    }

    const page = (data ?? []) as ActiveModelMetadataRow[];
    rows.push(...page);

    if (page.length < METADATA_PAGE_SIZE) {
      break;
    }
  }

  return rows;
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
      "slug, name, output_types, sync_interval_hours, last_sync_at, last_sync_records, is_enabled, quarantined_at"
    );

  if (dsError) {
    throw new Error(`Failed to fetch data_sources: ${dsError.message}`);
  }

  const dataSources: DataSourceRow[] = rawDataSources ?? [];
  const enabledDataSources = dataSources.filter(
    (source) => source.is_enabled && !source.quarantined_at
  );

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
    .select("source_slug, records_processed, created_at, status, error_message, metadata")
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
  for (const source of enabledDataSources) {
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

  for (const source of enabledDataSources) {
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
    const baseQualityScore = computeQualityScore({
      completeness: completenessScore,
      freshness: freshnessScore,
      trend: trendScore,
    });
    const diagnostics = extractSyncDiagnostics(jobs[0]);
    const qualityScore = Math.max(
      0,
      Math.round(baseQualityScore - diagnostics.diagnosticPenalty)
    );

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
      matchRate: diagnostics.matchRate,
      warningCount: diagnostics.warningCount,
      optionalSkipCount: diagnostics.optionalSkipCount,
      knownCatalogGapCount: diagnostics.knownCatalogGapCount,
      unmatchedModelCount: diagnostics.unmatchedModelCount,
      lastSyncStatus: diagnostics.lastSyncStatus,
      diagnosticPenalty: diagnostics.diagnosticPenalty,
      issueSummary: diagnostics.issueSummary,
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

  for (const source of enabledDataSources) {
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
  const totalSources = enabledDataSources.length;
  const staleCount = qualityScores.filter((s) => s.isStale).length;
  const warningSources = qualityScores.filter((s) => s.warningCount > 0).length;
  const lowMatchSources = qualityScores.filter(
    (s) => s.matchRate !== null && s.matchRate < 35
  ).length;
  const healthySources = totalSources - staleCount;
  const emptyTables = tableCoverage.filter((t) => t.isEmpty).length;
  const averageQualityScore =
    totalSources > 0
      ? Math.round(
          qualityScores.reduce((sum, s) => sum + s.qualityScore, 0) /
            totalSources
        )
      : 0;

  const { data: latestSnapshotRows, error: snapshotError } = await supabase
    .from("model_snapshots")
    .select("source_coverage")
    .eq("snapshot_date", checkedAt.split("T")[0]);

  if (snapshotError) {
    throw new Error(`Failed to fetch model_snapshots: ${snapshotError.message}`);
  }

  const snapshotCoverages = (latestSnapshotRows ?? []) as ModelSnapshotCoverageRow[];
  const totalModels = snapshotCoverages.length;
  const lowBiasRiskModels = snapshotCoverages.filter(
    (row) => row.source_coverage?.biasRisk === "low"
  ).length;
  const mediumBiasRiskModels = snapshotCoverages.filter(
    (row) => row.source_coverage?.biasRisk === "medium"
  ).length;
  const highBiasRiskModels = snapshotCoverages.filter(
    (row) => row.source_coverage?.biasRisk === "high"
  ).length;
  const corroboratedModels = snapshotCoverages.filter((row) => {
    const level = row.source_coverage?.corroborationLevel;
    return level === "multi_source" || level === "strong";
  }).length;
  const averageIndependentQualitySources =
    totalModels > 0
      ? snapshotCoverages.reduce(
          (sum, row) =>
            sum + (row.source_coverage?.independentQualitySourceCount ?? 0),
          0
        ) / totalModels
      : 0;
  const averageDistinctSources =
    totalModels > 0
      ? snapshotCoverages.reduce(
          (sum, row) => sum + (row.source_coverage?.totalDistinctSources ?? 0),
          0
        ) / totalModels
      : 0;

  const activeModelMetadata = await fetchAllActiveModelMetadata(supabase);
  const publicMetadataCoverage = await computePublicMetadataCoverage(
    supabase as never
  );
  const benchmarkExpectedModels = activeModelMetadata.filter((model) =>
    isBenchmarkExpectedModel(model)
  );
  const withTrustedHfLocator = benchmarkExpectedModels.filter((model) =>
    Boolean(getTrustedBenchmarkHfUrl(model))
  ).length;
  const withTrustedWebsiteLocator = benchmarkExpectedModels.filter((model) =>
    Boolean(getTrustedBenchmarkWebsiteUrl(model))
  ).length;
  const missingTrustedBenchmarkLocatorRows = benchmarkExpectedModels.filter(
    (model) =>
      !getTrustedBenchmarkHfUrl(model) && !getTrustedBenchmarkWebsiteUrl(model)
  );
  const missingTrustedBenchmarkLocator = missingTrustedBenchmarkLocatorRows
    .sort(
      (left, right) =>
        Date.parse(right.release_date ?? "0") - Date.parse(left.release_date ?? "0")
    )
    .slice(0, 25)
    .map((model) => ({
      slug: model.slug,
      provider: model.provider,
      category: model.category,
      releaseDate: model.release_date,
    }));
  const missingTrustedBenchmarkLocatorCount =
    missingTrustedBenchmarkLocatorRows.length;
  const withAnyTrustedBenchmarkLocator =
    benchmarkExpectedModels.length - missingTrustedBenchmarkLocatorCount;
  const trustedLocatorCoveragePct =
    benchmarkExpectedModels.length > 0
      ? Math.round(
          ((benchmarkExpectedModels.length - missingTrustedBenchmarkLocatorCount) /
            benchmarkExpectedModels.length) *
            1000
        ) / 10
      : 100;

  return {
    checkedAt,
    summary: {
      totalSources,
      healthySources,
      staleSources: staleCount,
      warningSources,
      lowMatchSources,
      emptyTables,
      averageQualityScore,
    },
    qualityScores,
    tableCoverage,
    freshness: {
      staleSourceCount: staleSources.length,
      staleSources,
    },
    modelEvidence: {
      totalModels,
      lowBiasRiskModels,
      mediumBiasRiskModels,
      highBiasRiskModels,
      corroboratedModels,
      averageIndependentQualitySources:
        Math.round(averageIndependentQualitySources * 10) / 10,
      averageDistinctSources: Math.round(averageDistinctSources * 10) / 10,
    },
    benchmarkMetadata: {
      benchmarkExpectedModels: benchmarkExpectedModels.length,
      withTrustedHfLocator,
      withTrustedWebsiteLocator,
      withAnyTrustedBenchmarkLocator,
      missingTrustedBenchmarkLocatorCount,
      trustedLocatorCoveragePct,
      missingTrustedBenchmarkLocator,
    },
    publicMetadata: {
      ...publicMetadataCoverage,
      recentNotReadyModels: publicMetadataCoverage.recentNotReadyModels.map(
        (model) => ({
          slug: model.slug,
          provider: model.provider,
          category: model.category,
          releaseDate: model.release_date,
          reasons: model.reasons,
        })
      ),
      recentRankingContaminationModels:
        publicMetadataCoverage.recentRankingContaminationModels.map((model) => ({
          slug: model.slug,
          provider: model.provider,
          category: model.category,
          releaseDate: model.release_date,
          reasons: model.reasons,
        })),
      recentLowTrustModels: publicMetadataCoverage.recentLowTrustModels.map(
        (model) => ({
          slug: model.slug,
          provider: model.provider,
          category: model.category,
          releaseDate: model.release_date,
          trustTier: model.trust_tier,
        })
      ),
      official: {
        ...publicMetadataCoverage.official,
        recentIncompleteModels:
          publicMetadataCoverage.official.recentIncompleteModels.map((model) => ({
            slug: model.slug,
            provider: model.provider,
            category: model.category,
            releaseDate: model.release_date,
          })),
        recentNotReadyModels:
          publicMetadataCoverage.official.recentNotReadyModels.map((model) => ({
            slug: model.slug,
            provider: model.provider,
            category: model.category,
            releaseDate: model.release_date,
            reasons: model.reasons,
          })),
        recentRankingContaminationModels:
          publicMetadataCoverage.official.recentRankingContaminationModels.map(
            (model) => ({
              slug: model.slug,
              provider: model.provider,
              category: model.category,
              releaseDate: model.release_date,
              reasons: model.reasons,
            })
          ),
      },
      recentIncompleteModels: publicMetadataCoverage.recentIncompleteModels.map(
        (model) => ({
          slug: model.slug,
          provider: model.provider,
          category: model.category,
          releaseDate: model.release_date,
        })
      ),
    },
  };
}
