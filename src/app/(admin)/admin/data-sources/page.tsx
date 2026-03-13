"use client";

import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
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
  BarChart2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatRelativeTime } from "@/lib/format";
import {
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
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_sync_at: string | null;
  last_sync_status: "success" | "partial" | "failed" | null;
  last_sync_records: number;
  last_error_message: string | null;
  quarantined_at: string | null;
  quarantine_reason: string | null;
}

type SourceLifecycleState = "active" | "degraded" | "quarantined" | "disabled";

const SOURCE_STATE_CONFIG: Record<
  SourceLifecycleState,
  {
    icon: typeof Shield | typeof ShieldAlert | typeof ShieldX | typeof XCircle;
    color: string;
    bg: string;
    border: string;
    label: string;
  }
> = {
  active: {
    icon: Shield,
    color: "text-gain",
    bg: "bg-gain/10",
    border: "border-gain/30",
    label: "Active",
  },
  degraded: {
    icon: ShieldAlert,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/30",
    label: "Degraded",
  },
  quarantined: {
    icon: ShieldX,
    color: "text-loss",
    bg: "bg-loss/10",
    border: "border-loss/30",
    label: "Quarantined",
  },
  disabled: {
    icon: XCircle,
    color: "text-muted-foreground",
    bg: "bg-secondary/20",
    border: "border-border/40",
    label: "Disabled",
  },
};

function getSourceLifecycleState(
  source: DataSourceRow,
  health?: AdapterHealth
): SourceLifecycleState {
  if (!source.is_enabled) return "disabled";
  if (source.quarantined_at) return "quarantined";
  if (health && health.status !== "healthy") return "degraded";
  if (source.last_sync_status === "failed") return "degraded";
  return "active";
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

interface SourceQualityScore {
  slug: string;
  name: string;
  qualityScore: number;
  completeness: number;
  freshness: number;
  trend: number;
  recordCount: number;
  lastSyncAt: string | null;
  syncIntervalHours: number;
  staleSince: string | null;
  isStale: boolean;
}

interface TableCoverage {
  table: string;
  rowCount: number;
  isEmpty: boolean;
  responsibleAdapters: string[];
}

interface DataIntegrityReport {
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
  modelEvidence: {
    totalModels: number;
    lowBiasRiskModels: number;
    mediumBiasRiskModels: number;
    highBiasRiskModels: number;
    corroboratedModels: number;
    averageIndependentQualitySources: number;
    averageDistinctSources: number;
  };
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

function qualityColor(score: number): { text: string; bg: string } {
  if (score >= 70) return { text: "text-gain", bg: "bg-gain/10" };
  if (score >= 40) return { text: "text-amber-400", bg: "bg-amber-400/10" };
  return { text: "text-loss", bg: "bg-loss/10" };
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
  const [drawerSlug, setDrawerSlug] = useState<string | null>(null);
  const [drawerSyncing, setDrawerSyncing] = useState(false);
  const [drawerHistoryLimit, setDrawerHistoryLimit] = useState(25);
  const { mutate: globalMutate } = useSWRConfig();

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

  // Data integrity fetch
  const {
    data: integrityData,
    isLoading: integrityLoading,
    mutate: mutateIntegrity,
  } = useSWR<DataIntegrityReport>("/api/admin/data-integrity", {
    ...SWR_TIERS.SLOW,
  });

  // Drawer per-adapter sync history (only fetches when a drawer is open)
  const {
    data: drawerHistoryData,
    isLoading: drawerHistoryLoading,
    mutate: mutateDrawerHistory,
  } = useSWR<SyncJobsResponse>(
    drawerSlug ? `/api/admin/sync?source=${drawerSlug}&limit=${drawerHistoryLimit}` : null,
    { ...SWR_TIERS.SLOW }
  );

  // Reset history limit when a different drawer opens
  useEffect(() => {
    setDrawerHistoryLimit(25);
  }, [drawerSlug]);

  const allSources = data?.data ?? [];

  // Build health lookup map
  const healthBySlug = new Map(
    (healthData?.adapters ?? []).map((a) => [a.slug, a])
  );

  const stateBySlug = new Map(
    allSources.map((source) => [
      source.slug,
      getSourceLifecycleState(source, healthBySlug.get(source.slug)),
    ])
  );

  // Apply tier filter then health filter
  const filteredSources = allSources
    .filter((s) => (tierFilter ? s.tier === tierFilter : true))
    .filter((s) => {
      if (!healthFilter) return true;
      return stateBySlug.get(s.slug) === healthFilter;
    });

  const statePriority: Record<SourceLifecycleState, number> = {
    quarantined: 0,
    degraded: 1,
    active: 2,
    disabled: 3,
  };

  const sortedSources = [...filteredSources].sort((a, b) => {
    const stateA = stateBySlug.get(a.slug) ?? "active";
    const stateB = stateBySlug.get(b.slug) ?? "active";
    const stateDiff = statePriority[stateA] - statePriority[stateB];
    if (stateDiff !== 0) return stateDiff;
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
  const activeCount = allSources.filter((s) => stateBySlug.get(s.slug) === "active").length;
  const degradedCount = allSources.filter((s) => stateBySlug.get(s.slug) === "degraded").length;
  const quarantinedCount = allSources.filter((s) => stateBySlug.get(s.slug) === "quarantined").length;
  const disabledCount = allSources.filter((s) => stateBySlug.get(s.slug) === "disabled").length;

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

  const runVerification = async () => {
    await mutateIntegrity();
    toast.success("Verification complete");
  };

  // Derive selected source from slug (avoid stale reference after mutate)
  const selectedSource = allSources.find((s) => s.slug === drawerSlug) ?? null;

  const triggerSyncFromDrawer = async (slug: string | null) => {
    if (!slug) return;
    setDrawerSyncing(true);
    try {
      const res = await fetch(`/api/admin/sync/${slug}`, { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      toast.success("Sync completed");
      await Promise.all([
        mutateDrawerHistory(),
        mutate(),
        mutateHealth(),
      ]);
      // Also invalidate any expanded inline history rows for this slug
      globalMutate(
        (key: unknown) =>
          typeof key === "string" &&
          key.startsWith(`/api/admin/sync?source=${slug}`),
        undefined,
        { revalidate: true }
      );
    } catch {
      toast.error("Sync failed");
    } finally {
      setDrawerSyncing(false);
    }
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
            healthFilter === "active" ? "ring-2 ring-neon" : ""
          )}
          onClick={() =>
            setHealthFilter((prev) => (prev === "active" ? null : "active"))
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gain/15">
                <Shield className="h-4 w-4 text-gain" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">
                  {activeCount}
                </p>
                <p className="text-[11px] text-muted-foreground">Active</p>
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
                  {degradedCount}
                </p>
                <p className="text-[11px] text-muted-foreground">Degraded</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quarantined card */}
        <Card
          className={cn(
            "border-border/50 bg-card cursor-pointer transition-all",
            healthFilter === "quarantined" ? "ring-2 ring-neon" : ""
          )}
          onClick={() =>
            setHealthFilter((prev) => (prev === "quarantined" ? null : "quarantined"))
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-loss/15">
                <ShieldX className="h-4 w-4 text-loss" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">
                  {quarantinedCount}
                </p>
                <p className="text-[11px] text-muted-foreground">Quarantined</p>
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

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="outline" className="border-border/40 text-[10px]">
          Disabled by operator: {disabledCount}
        </Badge>
        <Badge variant="outline" className="border-border/40 text-[10px]">
          Pipeline health: {healthData?.status ?? "healthy"}
        </Badge>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Data Integrity Panel                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-4">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <BarChart2 className="h-4 w-4 text-neon" />
            Data Integrity
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={runVerification}
            disabled={integrityLoading}
            className="gap-2 text-xs"
          >
            {integrityLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" />
                Run Verification
              </>
            )}
          </Button>
        </div>

        {/* Quality summary cards */}
        {integrityLoading && !integrityData ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="border-border/50 bg-card">
                <CardContent className="p-4">
                  <div className="h-10 animate-pulse rounded bg-secondary" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : integrityData ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {/* Average Quality card */}
              <Card className="border-border/50 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        qualityColor(integrityData.summary.averageQualityScore).bg
                      )}
                    >
                      <BarChart2
                        className={cn(
                          "h-4 w-4",
                          qualityColor(integrityData.summary.averageQualityScore).text
                        )}
                      />
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-xl font-bold tabular-nums",
                          qualityColor(integrityData.summary.averageQualityScore).text
                        )}
                      >
                        {Math.round(integrityData.summary.averageQualityScore)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Avg Quality · {integrityData.summary.totalSources} sources
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stale Sources card */}
              <Card className="border-border/50 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        integrityData.summary.staleSources > 0
                          ? "bg-loss/15"
                          : "bg-gain/15"
                      )}
                    >
                      <Clock
                        className={cn(
                          "h-4 w-4",
                          integrityData.summary.staleSources > 0
                            ? "text-loss"
                            : "text-gain"
                        )}
                      />
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-xl font-bold tabular-nums",
                          integrityData.summary.staleSources > 0
                            ? "text-loss"
                            : "text-gain"
                        )}
                      >
                        {integrityData.summary.staleSources}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Stale Sources · overdue for sync
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Empty Tables card */}
              <Card className="border-border/50 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        integrityData.summary.emptyTables > 0
                          ? "bg-loss/15"
                          : "bg-gain/15"
                      )}
                    >
                      <Database
                        className={cn(
                          "h-4 w-4",
                          integrityData.summary.emptyTables > 0
                            ? "text-loss"
                            : "text-gain"
                        )}
                      />
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-xl font-bold tabular-nums",
                          integrityData.summary.emptyTables > 0
                            ? "text-loss"
                            : "text-gain"
                        )}
                      >
                        {integrityData.summary.emptyTables}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Empty Tables · missing data
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-border/50 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neon/10">
                      <Shield className="h-4 w-4 text-neon" />
                    </div>
                    <div>
                      <p className="text-xl font-bold tabular-nums text-foreground">
                        {integrityData.modelEvidence.averageIndependentQualitySources.toFixed(1)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Avg Independent Quality Sources
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gain/15">
                      <CheckCircle2 className="h-4 w-4 text-gain" />
                    </div>
                    <div>
                      <p className="text-xl font-bold tabular-nums text-gain">
                        {integrityData.modelEvidence.corroboratedModels}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Corroborated Models Â· multi-source evidence
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-loss/15">
                      <ShieldAlert className="h-4 w-4 text-loss" />
                    </div>
                    <div>
                      <p className="text-xl font-bold tabular-nums text-loss">
                        {integrityData.modelEvidence.highBiasRiskModels}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        High Bias Risk Models Â· single-sided evidence
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Table Coverage pills */}
            {integrityData.tableCoverage.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Table Coverage
                </p>
                <TooltipProvider>
                  <div className="flex flex-wrap gap-2">
                    {integrityData.tableCoverage.map((tc) => (
                      <Tooltip key={tc.table}>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[11px] cursor-default",
                              tc.isEmpty
                                ? "border-loss/30 text-loss bg-loss/5"
                                : "border-gain/30 text-gain bg-gain/5"
                            )}
                          >
                            {tc.table}
                            <span className="ml-1 opacity-70">
                              {tc.isEmpty
                                ? "0 rows"
                                : tc.rowCount.toLocaleString()}
                            </span>
                          </Badge>
                        </TooltipTrigger>
                        {tc.isEmpty && tc.responsibleAdapters.length > 0 && (
                          <TooltipContent>
                            <p className="text-xs">
                              Responsible: {tc.responsibleAdapters.join(", ")}
                            </p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              </div>
            )}

            {/* Stale Sources alert panel */}
            {integrityData.freshness.staleSources.length > 0 && (
              <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-4">
                <p className="text-xs font-semibold text-amber-400 mb-3 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Stale Sources ({integrityData.freshness.staleSourceCount})
                </p>
                <div className="space-y-2">
                  {integrityData.freshness.staleSources.map((ss) => (
                    <div
                      key={ss.slug}
                      className="flex items-start justify-between gap-4 text-xs"
                    >
                      <span className="font-medium text-foreground">
                        {ss.name}
                      </span>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-muted-foreground">
                          Last sync:{" "}
                          {ss.lastSyncAt
                            ? formatRelativeTime(ss.lastSyncAt)
                            : "never"}
                        </span>
                        <span className="text-amber-400 font-medium">
                          Overdue by {ss.overdueBy}
                        </span>
                        <span className="text-muted-foreground/70">
                          Expected every {ss.expectedIntervalHours}h
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
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
                    const lifecycleState = stateBySlug.get(source.slug) ?? "active";
                    const lifecycleCfg = SOURCE_STATE_CONFIG[lifecycleState];
                    const isExpanded = expandedRows.has(source.slug);

                    // Row tint based on health status
                    const rowBg =
                      lifecycleState === "quarantined"
                        ? "bg-red-500/5 hover:bg-red-500/10"
                        : lifecycleState === "degraded"
                        ? "bg-amber-400/5 hover:bg-amber-400/10"
                        : lifecycleState === "disabled"
                        ? "bg-secondary/5 hover:bg-secondary/10"
                        : "hover:bg-secondary/20";

                    // Last sync with expected interval
                    const intervalLabel = TIER_INTERVAL_LABEL[source.tier] ?? `every ${source.sync_interval_hours}h`;

                    const qualityScore = integrityData?.qualityScores.find(
                      (q) => q.slug === source.slug
                    );

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
                            <div className="flex items-center gap-2">
                              <button
                                className="text-sm font-medium text-left hover:text-neon transition-colors hover:underline"
                                onClick={() => setDrawerSlug(source.slug)}
                              >
                                {source.name}
                              </button>
                              {qualityScore != null && (
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                                    qualityColor(qualityScore.qualityScore).bg,
                                    qualityColor(qualityScore.qualityScore).text
                                  )}
                                >
                                  {Math.round(qualityScore.qualityScore)}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">
                              {source.description}
                            </p>
                            {source.quarantined_at && (
                              <p className="mt-1 text-[11px] text-loss line-clamp-1">
                                Quarantined: {source.quarantine_reason ?? "permanent upstream failure"}
                              </p>
                            )}
                            {source.last_error_message &&
                              source.last_sync_status === "failed" &&
                              !source.quarantined_at && (
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
                            className={`text-[11px] ${lifecycleCfg.border} ${lifecycleCfg.color}`}
                          >
                            <lifecycleCfg.icon className="mr-1 h-3 w-3" />
                            {lifecycleCfg.label}
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
                          {source.last_success_at ? (
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span>
                                {formatRelativeTime(source.last_success_at)}{" "}
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
                          <td colSpan={9} className="px-4 py-3 space-y-3">
                            {(source.quarantined_at || !source.is_enabled) && (
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                {source.quarantined_at && (
                                  <Badge variant="outline" className="border-loss/30 text-loss">
                                    Quarantined {formatRelativeTime(source.quarantined_at)}
                                  </Badge>
                                )}
                                {!source.is_enabled && (
                                  <Badge variant="outline" className="border-border/40 text-muted-foreground">
                                    Disabled by operator
                                  </Badge>
                                )}
                              </div>
                            )}
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

      {/* Adapter detail drawer */}
      <Sheet
        open={!!drawerSlug}
        onOpenChange={(open) => {
          if (!open) setDrawerSlug(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border/50 p-4 pb-3">
            <SheetTitle className="flex items-center justify-between gap-2 pr-6">
              <span className="truncate">{selectedSource?.name ?? "Adapter Detail"}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 gap-1.5 text-xs"
                onClick={() => triggerSyncFromDrawer(drawerSlug)}
                disabled={drawerSyncing || !selectedSource?.is_enabled}
              >
                {drawerSyncing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    Sync Now
                  </>
                )}
              </Button>
            </SheetTitle>
          </SheetHeader>

          {selectedSource && (
            <div className="flex flex-col gap-4 p-4">
              {/* Config summary */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Configuration
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-xs text-muted-foreground self-center">Tier</dt>
                  <dd>
                    <Badge variant="outline" className="text-[10px] border-border/50">
                      T{selectedSource.tier} — {TIER_LABELS[selectedSource.tier] ?? "Other"}
                    </Badge>
                  </dd>

                  <dt className="text-xs text-muted-foreground self-center">Sync Interval</dt>
                  <dd className="text-sm">{TIER_SCHEDULES[selectedSource.tier] ?? `Every ${selectedSource.sync_interval_hours}h`}</dd>

                  <dt className="text-xs text-muted-foreground self-start pt-0.5">Output Types</dt>
                  <dd className="flex flex-wrap gap-1">
                    {selectedSource.output_types.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px] border-border/30">
                        {t}
                      </Badge>
                    ))}
                  </dd>

                  <dt className="text-xs text-muted-foreground self-center">Health</dt>
                  <dd>
                    {(() => {
                      const cfg =
                        SOURCE_STATE_CONFIG[
                          stateBySlug.get(selectedSource.slug) ?? "active"
                        ];
                      return (
                        <Badge variant="outline" className={`text-[10px] ${cfg.border} ${cfg.color}`}>
                          <cfg.icon className="mr-1 h-2.5 w-2.5" />
                          {cfg.label}
                        </Badge>
                      );
                    })()}
                  </dd>

                  <dt className="text-xs text-muted-foreground self-center">Failures</dt>
                  <dd>
                    {(() => {
                      const failures = healthBySlug.get(selectedSource.slug)?.consecutiveFailures ?? 0;
                      return (
                        <span className={cn("text-sm tabular-nums", failures > 0 ? "text-loss font-medium" : "text-muted-foreground")}>
                          {failures}
                        </span>
                      );
                    })()}
                  </dd>

                  <dt className="text-xs text-muted-foreground self-center">Last Success</dt>
                  <dd className="text-sm text-muted-foreground">
                    {selectedSource.last_success_at
                      ? formatRelativeTime(selectedSource.last_success_at)
                      : "\u2014"}
                  </dd>

                  <dt className="text-xs text-muted-foreground self-center">Last Attempt</dt>
                  <dd className="text-sm text-muted-foreground">
                    {selectedSource.last_attempt_at
                      ? formatRelativeTime(selectedSource.last_attempt_at)
                      : "\u2014"}
                  </dd>
                </dl>
              </div>

              {selectedSource.quarantined_at && (
                <div className="rounded-lg bg-loss/5 border border-loss/30 p-3">
                  <p className="text-xs font-medium text-loss mb-1.5">Quarantined Source</p>
                  <p className="text-xs text-loss/80 whitespace-pre-wrap break-all">
                    {selectedSource.quarantine_reason ?? "Permanent upstream failure detected."}
                  </p>
                  <p className="mt-2 text-[11px] text-loss/70">
                    Quarantined {formatRelativeTime(selectedSource.quarantined_at)}. Manual sync will retry and clear quarantine automatically on success.
                  </p>
                </div>
              )}

              {/* Full error message */}
              {selectedSource.last_error_message && selectedSource.last_sync_status === "failed" && (
                <div className="rounded-lg bg-loss/5 border border-loss/30 p-3">
                  <p className="text-xs font-medium text-loss mb-1.5">Last Error</p>
                  <p className="text-xs text-loss/80 whitespace-pre-wrap break-all">
                    {selectedSource.last_error_message}
                  </p>
                </div>
              )}

              {/* Sync history */}
              <div>
                <p className="text-sm font-medium mb-2">Sync History</p>
                {drawerHistoryLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : (
                  <>
                    {(() => {
                      const jobs = drawerHistoryData?.data ?? [];
                      if (jobs.length === 0) {
                        return (
                          <div className="rounded-lg bg-secondary/5 p-3 text-center text-xs text-muted-foreground">
                            No sync history found
                          </div>
                        );
                      }
                      return (
                        <div className="divide-y divide-border/30 rounded-lg border border-border/30 overflow-hidden">
                          {jobs.map((job) => {
                            const mappedStatus = mapSyncJobStatus(job.status);
                            const isRunning = mappedStatus === "running";
                            const statusCfg =
                              mappedStatus in STATUS_CONFIG
                                ? STATUS_CONFIG[mappedStatus as keyof typeof STATUS_CONFIG]
                                : null;
                            const durationMs = job.metadata?.duration_ms;
                            return (
                              <div key={job.id} className="px-3 py-2 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {formatRelativeTime(job.created_at)}
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                      {job.records_processed !== null
                                        ? `${job.records_processed.toLocaleString()} records`
                                        : "\u2014"}
                                    </span>
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                      {formatDuration(durationMs)}
                                    </span>
                                    {isRunning ? (
                                      <Badge variant="outline" className="text-[10px] border-blue-400/30 text-blue-400">
                                        <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />
                                        Running
                                      </Badge>
                                    ) : statusCfg ? (
                                      <Badge variant="outline" className={`text-[10px] ${statusCfg.border} ${statusCfg.color}`}>
                                        <statusCfg.icon className="mr-1 h-2.5 w-2.5" />
                                        {statusCfg.label}
                                      </Badge>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">Unknown</span>
                                    )}
                                  </div>
                                </div>
                                {job.error_message && mappedStatus === "failed" && (
                                  <p className="text-[11px] text-loss break-all">
                                    {job.error_message}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Load More */}
                    {(drawerHistoryData?.data?.length ?? 0) >= drawerHistoryLimit && (
                      <div className="mt-2 flex justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => setDrawerHistoryLimit((prev) => prev + 25)}
                        >
                          Load more
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
