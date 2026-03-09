"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import { SWR_TIERS } from "@/lib/swr/config";
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
  const [sortBenchmark, setSortBenchmark] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const containerRef = useRef<HTMLDivElement>(null);

  const { tooltip, handleCellHover, handleCellLeave } = useHeatmapTooltip({ containerRef });

  // Build dynamic URL for SWR key
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.providers.length > 0) params.set("provider", filters.providers.join(","));
  params.set("limit", "30");
  const qs = params.toString();
  const swrKey = `/api/charts/benchmark-heatmap${qs ? `?${qs}` : ""}`;

  const { data, error, isLoading } = useSWR<HeatmapData>(swrKey, {
    ...SWR_TIERS.MEDIUM,
  });

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
        loading={isLoading}
        error={error ? (error?.message || "Failed to load heatmap data") : null}
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
