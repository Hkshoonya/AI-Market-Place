"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChartCard } from "./chart-card";
import { ChartControls, useChartFilters } from "./chart-controls";
import { useHeatmapTooltip } from "@/hooks/use-heatmap-tooltip";
import { HeatmapGrid } from "./heatmap-grid";

interface BenchmarkScore {
  name: string;
  slug: string;
  provider: string;
  qualityScore: number;
  rank: number;
  scores: Record<string, number | null>;
}

interface BenchmarkInfo {
  slug: string;
  name: string;
  category: string;
}

interface HeatmapData {
  data: BenchmarkScore[];
  benchmarks: BenchmarkInfo[];
}

export default function BenchmarkHeatmap() {
  const { filters, setFilters } = useChartFilters();
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBenchmark, setSortBenchmark] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const containerRef = useRef<HTMLDivElement>(null);

  const { tooltip, handleCellHover, handleCellLeave } = useHeatmapTooltip({ containerRef });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.category) params.set("category", filters.category);
      if (filters.providers.length > 0) params.set("provider", filters.providers.join(","));
      params.set("limit", "30");

      const qs = params.toString();
      const res = await fetch(`/api/charts/benchmark-heatmap${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error(`Failed to fetch heatmap data (${res.status})`);
      const json: HeatmapData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.providers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleColumnSort = (benchmarkSlug: string) => {
    if (sortBenchmark === benchmarkSlug) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBenchmark(benchmarkSlug);
      setSortDirection("desc");
    }
  };

  return (
    <ChartCard
      title="Benchmark Heatmap"
      subtitle="Click a column to sort, click a row to view model details."
    >
      <ChartControls filters={filters} onChange={setFilters} />
      <HeatmapGrid
        models={data?.data ?? []}
        benchmarks={data?.benchmarks ?? []}
        loading={loading}
        error={error}
        sortBenchmark={sortBenchmark}
        sortDirection={sortDirection}
        onColumnSort={handleColumnSort}
        onCellHover={handleCellHover}
        onCellLeave={handleCellLeave}
        tooltip={tooltip}
        containerRef={containerRef}
      />
    </ChartCard>
  );
}
