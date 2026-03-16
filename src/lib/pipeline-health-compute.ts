/**
 * Shared pipeline health computation utilities
 *
 * Used by:
 * - /api/pipeline/health/route.ts (public + CRON_SECRET endpoint)
 * - /api/admin/pipeline/health/route.ts (admin session endpoint)
 * - Admin dashboard frontend for client-side sorting
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HealthStatus = "healthy" | "degraded" | "down";

export interface HealthRow {
  consecutive_failures: number;
  last_success_at: string | null;
  expected_interval_hours: number;
}

export interface HealthSourceSnapshot {
  sync_interval_hours?: number | null;
  last_success_at?: string | null;
  last_sync_at?: string | null;
}

// ---------------------------------------------------------------------------
// computeStatus
// ---------------------------------------------------------------------------

/**
 * Compute adapter health status from pipeline_health row data.
 *
 * Rules (worst wins):
 *   consecutive_failures >= 3  OR  staleness > 4x interval  -> "down"
 *   recent success <= 1x interval and failures < 3          -> "healthy"
 *   consecutive_failures >= 1  OR  staleness > 2x interval  -> "degraded"
 *   otherwise                                                -> "healthy"
 *
 * This intentionally treats a source with fresh data as healthy even if the
 * latest sync attempt hit a transient upstream error (for example a 429).
 *
 * Note: last_success_at = null means never synced => staleness = Infinity => "down"
 */
export function computeStatus(row: HealthRow): HealthStatus {
  const failures = row.consecutive_failures;
  const intervalMs = row.expected_interval_hours * 60 * 60 * 1000;
  const sinceLastSync = row.last_success_at
    ? Date.now() - new Date(row.last_success_at).getTime()
    : Infinity;

  if (failures >= 3 || sinceLastSync > 4 * intervalMs) return "down";
  if (sinceLastSync <= intervalMs) return "healthy";
  if (failures >= 1 || sinceLastSync > 2 * intervalMs) return "degraded";
  return "healthy";
}

/**
 * Build the effective health row used by public/admin health endpoints.
 *
 * Prefer pipeline_health.last_success_at when present. If the secondary
 * pipeline_health row is missing or has no success timestamp yet, fall back to
 * data_sources.last_success_at and then to legacy data_sources.last_sync_at.
 */
export function resolveEffectiveHealthRow(
  source: HealthSourceSnapshot,
  row?: Partial<HealthRow> | null
): HealthRow {
  const canonicalInterval = source.sync_interval_hours ?? 0;
  const rowInterval = row?.expected_interval_hours ?? 0;

  return {
    consecutive_failures: row?.consecutive_failures ?? 0,
    last_success_at:
      row?.last_success_at ??
      source.last_success_at ??
      source.last_sync_at ??
      null,
    expected_interval_hours:
      Math.max(rowInterval, canonicalInterval, 6),
  };
}

// ---------------------------------------------------------------------------
// mapSyncJobStatus
// ---------------------------------------------------------------------------

/**
 * Map sync_jobs.status DB strings to display vocabulary used by the admin dashboard.
 *
 * Bridges the vocabulary mismatch between sync_jobs table and STATUS_CONFIG in page.tsx.
 */
export function mapSyncJobStatus(dbStatus: string): string {
  switch (dbStatus) {
    case "completed":
      return "success";
    case "failed":
      return "failed";
    case "running":
      return "running";
    default:
      return "unknown";
  }
}

// ---------------------------------------------------------------------------
// HEALTH_PRIORITY
// ---------------------------------------------------------------------------

/**
 * Priority values for client-side sorting: lower value = shown first (stale-first).
 *
 * Usage: adapters.sort((a, b) => HEALTH_PRIORITY[a.status] - HEALTH_PRIORITY[b.status])
 */
export const HEALTH_PRIORITY: Record<HealthStatus, number> = {
  down: 0,
  degraded: 1,
  healthy: 2,
};
