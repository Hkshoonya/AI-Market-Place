"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChartCard } from "./chart-card";
import { ChartControls, useChartFilters } from "./chart-controls";

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

function getScoreColor(score: number | null): string {
  if (score === null) return "rgba(255,255,255,0.03)";
  const clamped = Math.max(0, Math.min(100, score));
  // Red (0) -> Yellow (50) -> Green (100)
  const hue = (clamped / 100) * 120; // 0=red, 60=yellow, 120=green
  return `hsl(${hue}, 70%, 35%)`;
}

export default function BenchmarkHeatmap() {
  const router = useRouter();
  const { filters, setFilters } = useChartFilters();
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBenchmark, setSortBenchmark] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    modelName: string;
    benchmarkName: string;
    score: number | null;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleCellHover = (
    e: React.MouseEvent,
    modelName: string,
    benchmarkName: string,
    score: number | null
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      modelName,
      benchmarkName,
      score,
    });
  };

  const handleCellLeave = () => {
    setTooltip(null);
  };

  // Filter benchmarks that have at least one non-null score
  const activeBenchmarks =
    data?.benchmarks.filter((b) =>
      data.data.some((model) => model.scores[b.slug] !== null && model.scores[b.slug] !== undefined)
    ) ?? [];

  // Sort models
  const sortedModels = data?.data
    ? [...data.data].sort((a, b) => {
        if (!sortBenchmark) {
          return a.rank - b.rank;
        }
        const aScore = a.scores[sortBenchmark] ?? -1;
        const bScore = b.scores[sortBenchmark] ?? -1;
        return sortDirection === "desc" ? bScore - aScore : aScore - bScore;
      })
    : [];

  // Scale column width based on number of benchmarks for better readability
  const colMinWidth = activeBenchmarks.length > 12 ? 64 : activeBenchmarks.length > 8 ? 72 : 90;
  const gridTemplateColumns = `180px repeat(${activeBenchmarks.length}, minmax(${colMinWidth}px, 1fr))`;

  return (
    <ChartCard
      title="Benchmark Heatmap"
      subtitle="Click a column to sort, click a row to view model details."
    >
      <ChartControls filters={filters} onChange={setFilters} />

      <div
        ref={containerRef}
        style={{
          position: "relative",
          marginTop: "16px",
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: "700px",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "8px",
          background: "#0a0a0a",
        }}
      >
        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "80px 20px",
              color: "rgba(255,255,255,0.5)",
              fontSize: "14px",
            }}
          >
            Loading heatmap data...
          </div>
        )}

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "80px 20px",
              color: "#ff6b6b",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && sortedModels.length === 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "80px 20px",
              color: "rgba(255,255,255,0.5)",
              fontSize: "14px",
            }}
          >
            No benchmark data available for the selected filters.
          </div>
        )}

        {!loading && !error && sortedModels.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns,
              minWidth: `${180 + activeBenchmarks.length * 70}px`,
            }}
          >
            {/* Header row - model name column */}
            <div
              style={{
                position: "sticky",
                left: 0,
                top: 0,
                zIndex: 20,
                background: "#0a0a0a",
                padding: "10px 12px",
                fontSize: "11px",
                fontWeight: 600,
                color: "#00d4aa",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                borderRight: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "flex-end",
              }}
            >
              Model
            </div>

            {/* Header row - benchmark columns */}
            {activeBenchmarks.map((benchmark) => {
              const isActive = sortBenchmark === benchmark.slug;
              return (
                <div
                  key={benchmark.slug}
                  onClick={() => handleColumnSort(benchmark.slug)}
                  title={`${benchmark.name} (${benchmark.category})`}
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    background: isActive ? "rgba(0,212,170,0.08)" : "#0a0a0a",
                    padding: "8px 6px",
                    fontSize: "10px",
                    fontWeight: 500,
                    color: isActive ? "#00d4aa" : "rgba(255,255,255,0.6)",
                    textAlign: "center",
                    borderBottom: isActive
                      ? "2px solid #00d4aa"
                      : "1px solid rgba(255,255,255,0.06)",
                    cursor: "pointer",
                    userSelect: "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    transition: "background 0.15s, color 0.15s",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "2px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "9px",
                      color: "rgba(255,255,255,0.3)",
                      textTransform: "uppercase",
                    }}
                  >
                    {benchmark.category}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                    {benchmark.name}
                    {isActive && (
                      <span style={{ marginLeft: "3px", fontSize: "9px" }}>
                        {sortDirection === "desc" ? "\u25BC" : "\u25B2"}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}

            {/* Data rows */}
            {sortedModels.map((model, rowIdx) => (
              <>
                {/* Model name cell (sticky) */}
                <div
                  key={`name-${model.slug}`}
                  onClick={() => router.push(`/models/${model.slug}`)}
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 5,
                    background: rowIdx % 2 === 0 ? "#0a0a0a" : "#0d0d0d",
                    padding: "8px 12px",
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.8)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    borderRight: "1px solid rgba(255,255,255,0.06)",
                    cursor: "pointer",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(0,212,170,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      rowIdx % 2 === 0 ? "#0a0a0a" : "#0d0d0d";
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.3)",
                      minWidth: "20px",
                    }}
                  >
                    {model.rank}
                  </span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {model.name}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.25)",
                      marginLeft: "auto",
                      flexShrink: 0,
                    }}
                  >
                    {model.provider}
                  </span>
                </div>

                {/* Score cells */}
                {activeBenchmarks.map((benchmark) => {
                  const score = model.scores[benchmark.slug] ?? null;
                  return (
                    <div
                      key={`cell-${model.slug}-${benchmark.slug}`}
                      onMouseEnter={(e) =>
                        handleCellHover(e, model.name, benchmark.name, score)
                      }
                      onMouseLeave={handleCellLeave}
                      style={{
                        background: getScoreColor(score),
                        padding: "8px 4px",
                        fontSize: "11px",
                        fontWeight: 500,
                        color:
                          score === null
                            ? "rgba(255,255,255,0.15)"
                            : score > 60
                              ? "rgba(255,255,255,0.9)"
                              : "rgba(255,255,255,0.8)",
                        textAlign: "center",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "opacity 0.15s",
                        cursor: "default",
                      }}
                    >
                      {score !== null ? score.toFixed(1) : "\u2014"}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        )}

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: "absolute",
              left: tooltip.x + 12,
              top: tooltip.y - 40,
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "12px",
              color: "rgba(255,255,255,0.9)",
              pointerEvents: "none",
              zIndex: 50,
              whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "2px" }}>{tooltip.modelName}</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", marginBottom: "4px" }}>
              {tooltip.benchmarkName}
            </div>
            <div
              style={{
                color: tooltip.score !== null ? "#00d4aa" : "rgba(255,255,255,0.3)",
                fontWeight: 600,
                fontSize: "14px",
              }}
            >
              {tooltip.score !== null ? `${tooltip.score.toFixed(2)}` : "No data"}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {!loading && !error && sortedModels.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginTop: "12px",
            fontSize: "11px",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          <span>Low (0)</span>
          <div
            style={{
              width: "120px",
              height: "10px",
              borderRadius: "5px",
              background:
                "linear-gradient(to right, hsl(0,70%,35%), hsl(60,70%,35%), hsl(120,70%,35%))",
            }}
          />
          <span>High (100)</span>
          <div
            style={{
              width: "1px",
              height: "12px",
              background: "rgba(255,255,255,0.1)",
              margin: "0 4px",
            }}
          />
          <div
            style={{
              width: "16px",
              height: "10px",
              borderRadius: "3px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
          <span>No data</span>
        </div>
      )}
    </ChartCard>
  );
}
