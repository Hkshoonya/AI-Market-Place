"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Loader2,
  Play,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldX,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatRelativeDate, formatRelativeTime } from "@/lib/format";
import {
  HEALTH_PRIORITY,
  mapSyncJobStatus,
} from "@/lib/pipeline-health-compute";
import { SWR_TIERS } from "@/lib/swr/config";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_LABELS: Record<number, string> = {
  1: "Model Hubs",
  2: "Benchmarks",
  3: "News & Research",
  4: "Community",
};

const TIER_SCHEDULES: Record<number, string> = {
  1: "Every 6 hours",
  2: "Every 12 hours",
  3: "Daily",
  4: "Weekly",
};

const TIER_INTERVAL_LABEL: Record<number, string> = {
  1: "every 6h",
  2: "every 12h",
  3: "every 24h",
  4: "every 7d",
};

const STATUS_CONFIG = {
  success: {
    icon: CheckCircle2,
    color: "text-gain",
    bg: "bg-gain/10",
    border: "border-gain/30",
    label: "Success",
  },
  partial: {
    icon: AlertCircle,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/30",
    label: "Partial",
  },
  failed: {
    icon: XCircle,
    color: "text-loss",
    bg: "bg-loss/10",
    border: "border-loss/30",
    label: "Failed",
  },
} as const;

const HEALTH_CONFIG = {
  healthy: {
    icon: Shield,
    color: "text-gain",
    bg: "bg-gain/10",
    border: "border-gain/30",
    label: "Healthy",
  },
  degraded: {
    icon: ShieldAlert,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/30",
    label: "Degraded",
  },
  down: {
    icon: ShieldX,
    color: "text-loss",
    bg: "bg-loss/10",
    border: "border-loss/30",
    label: "Down",
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataSourceRow {
  id: number;
  slug: string;
  name: string;
  adapter_type: string;
  description: string | null;
  is_enabled: boolean;
  tier: number;
  sync_interval_hours: number;
  output_types: string[];
  last_sync_at: string | null;
  last_sync_status: "success" | "partial" | "failed" | null;
  last_sync_records: number;
  last_error_message: string | null;
}

interface DataSourcesResponse {
  data: DataSourceRow[];
}

interface AdapterHealth {
  slug: string;
  status: "healthy" | "degraded" | "down";
  lastSync: string | null;
  consecutiveFailures: number;
  recordCount: number;
  error: string | null;
}

interface PipelineHealthDetail {
  status: "healthy" | "degraded" | "down";
  healthy: number;
  degraded: number;
  down: number;
  checkedAt: string;
  adapters: AdapterHealth[];
}

interface SyncJob {
  id: string;
  source: string;
  job_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  records_processed: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface SyncJobsResponse {
  data: SyncJob[];
}

// ---------------------------------------------------------------------------
// SyncHistoryInline component
// ---------------------------------------------------------------------------

function formatDuration(durationMs: unknown): string {
  if (durationMs === null || durationMs === undefined) return "\u2014";
  const ms = Number(durationMs);
  if (isNaN(ms)) return "\u2014";
  if (ms < 1000) return "<1s";
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function SyncHistoryInline({ slug }: { slug: string }) {
  const { data, isLoading } = useSWR<SyncJobsResponse>(
    slug ? `/api/admin/sync?source=${slug}&limit=10` : null,
    { ...SWR_TIERS.SLOW }
  );

  if (isLoading) {
    return (
      <div className="space-y-2 rounded-lg bg-secondary/5 p-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  const jobs = data?.data ?? [];

  if (jobs.length === 0) {
    return (
      <div className="rounded-lg bg-secondary/5 p-3 text-center text-xs text-muted-foreground">
        No sync history found
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-secondary/5 p-3 space-y-1">
      <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">
        Recent Sync Jobs
      </p>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1.5 text-xs">
        {/* Header row */}
        <span className="text-[10px] font-medium text-muted-foreground/70">Time</span>
        <span className="text-[10px] font-medium text-muted-foreground/70 text-center">Status</span>
        <span className="text-[10px] font-medium text-muted-foreground/70 text-right">Records</span>
        <span className="text-[10px] font-medium text-muted-foreground/70 text-right">Duration</span>

        {jobs.map((job) => {
          const mappedStatus = mapSyncJobStatus(job.status);
          const isRunning = mappedStatus === "running";
          const statusCfg =
            mappedStatus in STATUS_CONFIG
              ? STATUS_CONFIG[mappedStatus as keyof typeof STATUS_CONFIG]
              : null;
          const durationMs = job.metadata?.duration_ms;
          const isError = job.error_message && mappedStatus === "failed";
          const truncatedError = isError
            ? job.error_message!.length > 80
              ? job.error_message!.slice(0, 80) + "..."
              : job.error_message!
            : null;

          return [
            // Time + optional error
            <div key={`${job.id}-time`} className="min-w-0">
              <span className="text-muted-foreground">
                {formatRelativeTime(job.created_at)}
              </span>
              {truncatedError && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="mt-0.5 text-[11px] text-loss cursor-help truncate">
                      {truncatedError}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">{job.error_message}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>,

            // Status badge
            <div key={`${job.id}-status`} className="flex items-start justify-center pt-0.5">
              {isRunning ? (
                <Badge
                  variant="outline"
                  className="text-[10px] border-blue-400/30 text-blue-400"
                >
                  <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />
                  Running
                </Badge>
              ) : statusCfg ? (
                <Badge
                  variant="outline"
                  className={`text-[10px] ${statusCfg.border} ${statusCfg.color}`}
                >
                  <statusCfg.icon className="mr-1 h-2.5 w-2.5" />
                  {statusCfg.label}
                </Badge>
              ) : (
                <span className="text-[10px] text-muted-foreground">Unknown</span>
              )}
            </div>,

            // Records
            <span
              key={`${job.id}-records`}
              className="text-right text-muted-foreground tabular-nums"
            >
              {job.records_processed !== null
                ? job.records_processed.toLocaleString()
                : "\u2014"}
            </span>,

            // Duration
            <span
              key={`${job.id}-duration`}
              className="text-right text-muted-foreground tabular-nums"
            >
              {formatDuration(durationMs)}
            </span>,
          ];
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function AdminDataSourcesPage() {
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [healthFilter, setHealthFilter] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Data sources fetch
  const { data, isLoading: loading, error, mutate } = useSWR<DataSourcesResponse>(
    "/api/admin/data-sources",
    { ...SWR_TIERS.SLOW }
  );

  // Pipeline health fetch
  const { data: healthData, mutate: mutateHealth } = useSWR<PipelineHealthDetail>(
    "/api/admin/pipeline/health",
    { ...SWR_TIERS.SLOW }
  );

  const allSources = data?.data ?? [];

  // Build health lookup map
  const healthBySlug = new Map(
    (healthData?.adapters ?? []).map((a) => [a.slug, a])
  );

  // Apply tier filter then health filter
  const filteredSources = allSources
    .filter((s) => (tierFilter ? s.tier === tierFilter : true))
    .filter((s) => {
      if (!healthFilter) return true;
      const adapterHealth = healthBySlug.get(s.slug);
      return (adapterHealth?.status ?? "healthy") === healthFilter;
    });

  // Sort stale-first: down > degraded > healthy, then by tier
  const sortedSources = [...filteredSources].sort((a, b) => {
    const ha = healthBySlug.get(a.slug)?.status ?? "healthy";
    const hb = healthBySlug.get(b.slug)?.status ?? "healthy";
    const hDiff = HEALTH_PRIORITY[ha] - HEALTH_PRIORITY[hb];
    if (hDiff !== 0) return hDiff;
    return a.tier - b.tier;
  });

  // Auto-refresh every 30s when a sync is running
  useEffect(() => {
    if (syncing.size === 0) return;
    const interval = setInterval(() => {
      mutate();
      mutateHealth();
    }, 30000);
    return () => clearInterval(interval);
  }, [syncing.size, mutate, mutateHealth]);

  const totalRecords = allSources.reduce(
    (sum, s) => sum + (s.last_sync_records || 0),
    0
  );

  const toggleEnabled = async (id: number, currentlyEnabled: boolean) => {
    try {
      const res = await fetch("/api/admin/data-sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_enabled: !currentlyEnabled }),
      });

      if (!res.ok) throw new Error("Request failed");
      toast.success(currentlyEnabled ? "Data source disabled" : "Data source enabled");
      mutate();
    } catch {
      toast.error("Failed to update data source");
    }
  };

  const triggerSync = async (slug: string) => {
    setSyncing((prev) => new Set([...prev, slug]));
    try {
      const res = await fetch(`/api/admin/sync/${slug}`, { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      toast.success("Sync completed successfully");
      mutate();
      mutateHealth();
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing((prev) => {
        const next = new Set(prev);
        next.delete(slug);
        return next;
      });
    }
  };

  const toggleRow = (slug: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-loss/30 bg-loss/5 p-6 text-loss">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-sm">{error.message || "Failed to load data sources"}</p>
      </div>
    );
  }

  // Pipeline status pill color
  const pipelineStatus = healthData?.status ?? "healthy";
  const pipelinePillClass =
    pipelineStatus === "down"
      ? "bg-loss/10 text-loss border-loss/30"
      : pipelineStatus === "degraded"
      ? "bg-amber-400/10 text-amber-400 border-amber-400/30"
      : "bg-gain/10 text-gain border-gain/30";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Database className="h-5 w-5 text-neon" />
          Data Sources ({sortedSources.length})
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { mutate(); mutateHealth(); }}
          className="gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Pipeline status pill */}
      {healthData && (
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
            pipelinePillClass
          )}
        >
          <Activity className="h-3 w-3" />
          <span>
            Pipeline:{" "}
            <span className="capitalize">{pipelineStatus}</span>
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            Last run: {formatRelativeTime(healthData.checkedAt)}
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        {/* Healthy card */}
        <Card
          className={cn(
            "border-border/50 bg-card cursor-pointer transition-all",
            healthFilter === "healthy" ? "ring-2 ring-neon" : ""
          )}
          onClick={() =>
            setHealthFilter((prev) => (prev === "healthy" ? null : "healthy"))
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gain/15">
                <Shield className="h-4 w-4 text-gain" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">
                  {healthData?.healthy ?? 0}
                </p>
                <p className="text-[11px] text-muted-foreground">Healthy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Degraded card */}
        <Card
          className={cn(
            "border-border/50 bg-card cursor-pointer transition-all",
            healthFilter === "degraded" ? "ring-2 ring-neon" : ""
          )}
          onClick={() =>
            setHealthFilter((prev) => (prev === "degraded" ? null : "degraded"))
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">
                  {healthData?.degraded ?? 0}
                </p>
                <p className="text-[11px] text-muted-foreground">Degraded</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Down card */}
        <Card
          className={cn(
            "border-border/50 bg-card cursor-pointer transition-all",
            healthFilter === "down" ? "ring-2 ring-neon" : ""
          )}
          onClick={() =>
            setHealthFilter((prev) => (prev === "down" ? null : "down"))
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-loss/15">
                <ShieldX className="h-4 w-4 text-loss" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">
                  {healthData?.down ?? 0}
                </p>
                <p className="text-[11px] text-muted-foreground">Down</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Records Synced card (not clickable) */}
        <Card className="border-border/50 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: "#6366f115" }}
              >
                <Database className="h-4 w-4" style={{ color: "#6366f1" }} />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">
                  {totalRecords.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground">Records Synced</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier filter */}
      <div className="flex gap-1">
        <Button
          variant={tierFilter === null ? "default" : "outline"}
          size="sm"
          onClick={() => setTierFilter(null)}
          className={
            tierFilter === null
              ? "bg-neon text-background hover:bg-neon/90"
              : ""
          }
        >
          All
        </Button>
        {[1, 2, 3, 4].map((t) => (
          <Button
            key={t}
            variant={tierFilter === t ? "default" : "outline"}
            size="sm"
            onClick={() => setTierFilter(t)}
            className={
              tierFilter === t
                ? "bg-neon text-background hover:bg-neon/90"
                : ""
            }
          >
            Tier {t}
          </Button>
        ))}
      </div>

      {/* Data sources table */}
      <div className="overflow-hidden rounded-xl border border-border/50">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Source
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                  Tier
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                  Health
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                  Enabled
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  Records
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Last Sync
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                  Actions
                </th>
                <th className="px-2 py-3 w-8" />
              </tr>
            </thead>
            <TooltipProvider>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="h-5 animate-pulse rounded bg-secondary" />
                      </td>
                    </tr>
                  ))
                ) : sortedSources.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Database className="h-10 w-10 text-muted-foreground/30" />
                        <p className="text-sm font-medium text-muted-foreground">
                          No data sources found
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          {tierFilter || healthFilter
                            ? "Try adjusting your filters"
                            : "Data sources will appear here once configured"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedSources.map((source) => {
                    const statusCfg = source.last_sync_status
                      ? STATUS_CONFIG[source.last_sync_status]
                      : null;
                    const isSyncing = syncing.has(source.slug);
                    const adapterHealth = healthBySlug.get(source.slug);
                    const healthStatus = adapterHealth?.status ?? "healthy";
                    const healthCfg = HEALTH_CONFIG[healthStatus];
                    const isExpanded = expandedRows.has(source.slug);

                    // Row tint based on health status
                    const rowBg =
                      healthStatus === "down"
                        ? "bg-red-500/5 hover:bg-red-500/10"
                        : healthStatus === "degraded"
                        ? "bg-amber-400/5 hover:bg-amber-400/10"
                        : "hover:bg-secondary/20";

                    // Last sync with expected interval
                    const intervalLabel = TIER_INTERVAL_LABEL[source.tier] ?? `every ${source.sync_interval_hours}h`;

                    return [
                      <tr
                        key={source.id}
                        className={cn(
                          "border-b border-border/30 transition-colors",
                          rowBg
                        )}
                      >
                        {/* Source name + description */}
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">{source.name}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">
                              {source.description}
                            </p>
                            {source.last_error_message &&
                              source.last_sync_status === "failed" && (
                                <p className="mt-1 text-[11px] text-loss line-clamp-1">
                                  {source.last_error_message}
                                </p>
                              )}
                          </div>
                        </td>

                        {/* Tier */}
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className="text-[10px] border-border/50"
                          >
                            T{source.tier} ·{" "}
                            {TIER_LABELS[source.tier] ?? "Other"}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {TIER_SCHEDULES[source.tier]}
                          </p>
                        </td>

                        {/* Sync status */}
                        <td className="px-4 py-3 text-center">
                          {statusCfg ? (
                            <Badge
                              variant="outline"
                              className={`text-[11px] ${statusCfg.border} ${statusCfg.color}`}
                            >
                              <statusCfg.icon className="mr-1 h-3 w-3" />
                              {statusCfg.label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Never synced
                            </span>
                          )}
                        </td>

                        {/* Health badge */}
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[11px] ${healthCfg.border} ${healthCfg.color}`}
                          >
                            <healthCfg.icon className="mr-1 h-3 w-3" />
                            {healthCfg.label}
                          </Badge>
                        </td>

                        {/* Enabled toggle */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() =>
                              toggleEnabled(source.id, source.is_enabled)
                            }
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              source.is_enabled
                                ? "bg-neon"
                                : "bg-secondary"
                            }`}
                            aria-label={`${source.is_enabled ? "Disable" : "Enable"} ${source.name}`}
                            role="switch"
                            aria-checked={source.is_enabled}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${
                                source.is_enabled
                                  ? "translate-x-[18px]"
                                  : "translate-x-[3px]"
                              }`}
                            />
                          </button>
                        </td>

                        {/* Records */}
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                          {source.last_sync_records > 0
                            ? source.last_sync_records.toLocaleString()
                            : "\u2014"}
                        </td>

                        {/* Last sync with expected interval */}
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {source.last_sync_at ? (
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span>
                                {formatRelativeTime(source.last_sync_at)}{" "}
                                <span className="text-[10px] text-muted-foreground/60">
                                  ({intervalLabel})
                                </span>
                              </span>
                            </span>
                          ) : (
                            "\u2014"
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1.5"
                            onClick={() => triggerSync(source.slug)}
                            disabled={isSyncing || !source.is_enabled}
                          >
                            {isSyncing ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Syncing
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3" />
                                Sync
                              </>
                            )}
                          </Button>
                        </td>

                        {/* Expand chevron */}
                        <td className="px-2 py-3 text-center">
                          <button
                            onClick={() => toggleRow(source.slug)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>,

                      // Expanded sync history row
                      isExpanded && (
                        <tr
                          key={`${source.id}-history`}
                          className="border-b border-border/30 bg-secondary/10"
                        >
                          <td colSpan={9} className="px-4 py-3">
                            <SyncHistoryInline slug={source.slug} />
                          </td>
                        </tr>
                      ),
                    ];
                  })
                )}
              </tbody>
            </TooltipProvider>
          </table>
        </div>
      </div>

      {/* Output types legend */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="font-medium">Output types:</span>
        {["models", "benchmarks", "pricing", "elo_ratings", "news"].map(
          (type) => (
            <Badge
              key={type}
              variant="outline"
              className="text-[10px] border-border/30"
            >
              {type}
            </Badge>
          )
        )}
      </div>
    </div>
  );
}
