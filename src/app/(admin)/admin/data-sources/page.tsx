"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/format";
import { toast } from "sonner";

/* eslint-disable @typescript-eslint/no-explicit-any */

const supabase = createClient();

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

export default function AdminDataSourcesPage() {
  const [sources, setSources] = useState<DataSourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    const sb = supabase as any;
    let query = sb
      .from("data_sources")
      .select("*")
      .order("tier", { ascending: true })
      .order("priority", { ascending: true });

    if (tierFilter) {
      query = query.eq("tier", tierFilter);
    }

    const { data, error: fetchErr } = await query;
    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setSources((data ?? []) as DataSourceRow[]);
    }
    setLoading(false);
  }, [tierFilter]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Auto-refresh every 30s when a sync is running
  useEffect(() => {
    if (syncing.size === 0) return;
    const interval = setInterval(fetchSources, 30000);
    return () => clearInterval(interval);
  }, [syncing.size, fetchSources]);

  const toggleEnabled = async (id: number, currentlyEnabled: boolean) => {
    try {
      const res = await fetch("/api/admin/data-sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_enabled: !currentlyEnabled }),
      });

      if (!res.ok) throw new Error("Request failed");
      setSources((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, is_enabled: !currentlyEnabled } : s
        )
      );
      toast.success(currentlyEnabled ? "Data source disabled" : "Data source enabled");
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
      await fetchSources();
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

  // Stats
  const enabledCount = sources.filter((s) => s.is_enabled).length;
  const successCount = sources.filter(
    (s) => s.last_sync_status === "success"
  ).length;
  const failedCount = sources.filter(
    (s) => s.last_sync_status === "failed"
  ).length;
  const totalRecords = sources.reduce(
    (sum, s) => sum + (s.last_sync_records || 0),
    0
  );

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-loss/30 bg-loss/5 p-6 text-loss">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Database className="h-5 w-5 text-neon" />
          Data Sources ({sources.length})
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true);
            fetchSources();
          }}
          className="gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          {
            label: "Enabled",
            value: enabledCount,
            total: sources.length,
            icon: Activity,
            color: "#00d4aa",
          },
          {
            label: "Healthy",
            value: successCount,
            total: enabledCount,
            icon: CheckCircle2,
            color: "#22c55e",
          },
          {
            label: "Failed",
            value: failedCount,
            total: enabledCount,
            icon: XCircle,
            color: "#ef4444",
          },
          {
            label: "Records Synced",
            value: totalRecords.toLocaleString(),
            total: null,
            icon: Database,
            color: "#6366f1",
          },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <stat.icon
                    className="h-4 w-4"
                    style={{ color: stat.color }}
                  />
                </div>
                <div>
                  <p className="text-xl font-bold tabular-nums">
                    {stat.value}
                    {stat.total !== null && (
                      <span className="text-sm font-normal text-muted-foreground">
                        /{stat.total}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-5 animate-pulse rounded bg-secondary" />
                    </td>
                  </tr>
                ))
              ) : sources.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No data sources configured.
                  </td>
                </tr>
              ) : (
                sources.map((source) => {
                  const statusCfg = source.last_sync_status
                    ? STATUS_CONFIG[source.last_sync_status]
                    : null;
                  const isSyncing = syncing.has(source.slug);

                  return (
                    <tr
                      key={source.id}
                      className="border-b border-border/30 hover:bg-secondary/20 transition-colors"
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

                      {/* Status */}
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
                          : "—"}
                      </td>

                      {/* Last sync */}
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {source.last_sync_at ? (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {formatRelativeDate(source.last_sync_at)}
                          </span>
                        ) : (
                          "—"
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
                    </tr>
                  );
                })
              )}
            </tbody>
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
