"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatNumber, formatDate } from "@/lib/format";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";
import { toast } from "sonner";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PAGE_SIZE = 20;
const supabase = createClient();

export default function AdminModelsPage() {
  const [models, setModels] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("models")
      .select("id, slug, name, provider, category, status, overall_rank, quality_score, hf_downloads, created_at, is_open_weights", { count: "exact" });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    if (search) {
      const safeSearch = sanitizeFilterValue(search);
      if (safeSearch) {
        query = query.or(`name.ilike.%${safeSearch}%,provider.ilike.%${safeSearch}%`);
      }
    }

    query = query.order("created_at", { ascending: false });

    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, count } = await query;
    setModels((data as any[]) ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      const { error } = await (supabase as any).from("models").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
      toast.success(`Model ${newStatus === "active" ? "activated" : "deactivated"}`);
      fetchModels();
    } catch {
      toast.error("Failed to update model status");
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Box className="h-5 w-5 text-neon" />
          Models ({totalCount})
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 bg-secondary"
          />
        </div>
        <div className="flex gap-1">
          {["all", "active", "inactive", "draft"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={statusFilter === s ? "bg-neon text-background hover:bg-neon/90" : ""}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border/50">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Model</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Provider</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Rank</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Score</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Downloads</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Open</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Added</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td colSpan={9} className="px-4 py-4">
                      <div className="h-5 animate-pulse rounded bg-secondary" />
                    </td>
                  </tr>
                ))
              ) : models.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No models found.
                  </td>
                </tr>
              ) : (
                models.map((m) => (
                  <tr key={m.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/models/${m.slug}`} className="text-sm font-medium hover:text-neon transition-colors">
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{m.provider}</td>
                    <td className="px-4 py-3 text-center text-sm tabular-nums">
                      {m.overall_rank ? `#${m.overall_rank}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-sm tabular-nums">
                      {m.quality_score ? Number(m.quality_score).toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
                      {formatNumber(m.hf_downloads)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${
                          m.status === "active"
                            ? "border-gain/30 text-gain"
                            : "border-loss/30 text-loss"
                        }`}
                      >
                        {m.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.is_open_weights ? (
                        <Check className="mx-auto h-4 w-4 text-gain" />
                      ) : (
                        <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(m.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => toggleStatus(m.id, m.status)}
                        >
                          {m.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                        <Link href={`/models/${m.slug}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalCount} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
