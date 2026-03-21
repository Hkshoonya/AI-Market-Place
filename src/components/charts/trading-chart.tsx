"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import useSWR from "swr";
import { SWR_TIERS } from "@/lib/swr/config";
import { cn } from "@/lib/utils";

// lightweight-charts types
type IChartApi = ReturnType<typeof import("lightweight-charts")["createChart"]>;

interface TradingChartProps {
  modelSlug?: string;
  className?: string;
  height?: number;
  defaultMetric?: string;
  defaultRange?: string;
  showControls?: boolean;
}

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  value: number;
}

const METRICS = [
  { value: "popularity_score", label: "Popularity" },
  { value: "adoption_score", label: "Adoption" },
  { value: "economic_footprint_score", label: "Economic" },
  { value: "quality_score", label: "Quality Score" },
  { value: "market_cap_estimate", label: "Market Value" },
  { value: "hf_downloads", label: "Downloads" },
];

const RANGES = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

export function TradingChart({
  modelSlug,
  className,
  height = 400,
  defaultMetric = "popularity_score",
  defaultRange = "30d",
  showControls = true,
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [metric, setMetric] = useState(defaultMetric);
  const [range, setRange] = useState(defaultRange);
  const [chartMode, setChartMode] = useState<"line" | "candle">("line");

  // Build dynamic URL for SWR key -- changes trigger automatic refetch
  const params = new URLSearchParams({ metric, range });
  if (modelSlug) params.set("model", modelSlug);
  const swrKey = `/api/charts/trading?${params.toString()}`;

  const { data, error, isLoading } = useSWR<CandleData[]>(swrKey, {
    ...SWR_TIERS.MEDIUM,
  });

  const chartData = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const accessiblePoints = useMemo(
    () => chartData.slice(Math.max(0, chartData.length - 5)),
    [chartData]
  );

  // Render chart
  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;

    let cancelled = false;

    const initChart = async () => {
      const {
        createChart,
        ColorType,
        LineStyle,
        CrosshairMode,
        CandlestickSeries,
        LineSeries,
        AreaSeries,
      } = await import("lightweight-charts");

      if (cancelled) return;

      // Clean up previous chart
      if (chartRef.current) {
        chartRef.current.remove();
      }

      const chart = createChart(chartContainerRef.current!, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#999",
          fontFamily: "var(--font-geist-mono)",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.04)" },
          horzLines: { color: "rgba(255,255,255,0.04)" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "#00d4aa", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#00d4aa" },
          horzLine: { color: "#00d4aa", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#00d4aa" },
        },
        width: chartContainerRef.current!.clientWidth,
        height,
        timeScale: {
          borderColor: "rgba(255,255,255,0.1)",
          timeVisible: false,
        },
        rightPriceScale: {
          borderColor: "rgba(255,255,255,0.1)",
        },
      });

      chartRef.current = chart;

      if (chartMode === "candle") {
        // v5 API: chart.addSeries(SeriesType, options)
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#00d4aa",
          downColor: "#ef4444",
          borderDownColor: "#ef4444",
          borderUpColor: "#00d4aa",
          wickDownColor: "#ef4444",
          wickUpColor: "#00d4aa",
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candleSeries.setData(chartData as any);
      } else {
        const lineSeries = chart.addSeries(LineSeries, {
          color: "#00d4aa",
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          crosshairMarkerBorderColor: "#00d4aa",
          crosshairMarkerBackgroundColor: "#0a0a0a",
          lastValueVisible: true,
          priceLineVisible: false,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lineSeries.setData(chartData.map((d) => ({ time: d.time, value: d.value })) as any);

        // Add area fill beneath the line
        const areaSeries = chart.addSeries(AreaSeries, {
          topColor: "rgba(0, 212, 170, 0.15)",
          bottomColor: "rgba(0, 212, 170, 0.01)",
          lineColor: "transparent",
          lineWidth: 1,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        areaSeries.setData(chartData.map((d) => ({ time: d.time, value: d.value })) as any);
      }

      chart.timeScale().fitContent();
    };

    initChart();

    // Resize handler
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [chartData, height, chartMode]);

  return (
    <div className={cn("rounded-lg border border-border/50 bg-card/30 backdrop-blur-sm", className)}>
      {showControls && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
          <div className="flex items-center gap-1">
            {METRICS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMetric(m.value)}
                className={cn(
                  "px-2 py-1 text-xs rounded transition-colors",
                  metric === m.value
                    ? "bg-[#00d4aa]/20 text-[#00d4aa]"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setChartMode(chartMode === "line" ? "candle" : "line")}
              className="px-2 py-1 text-xs text-muted-foreground hover:text-white transition-colors"
              aria-label={chartMode === "line" ? "Switch to candlestick chart" : "Switch to line chart"}
            >
              {chartMode === "line" ? "Candles" : "Line"}
            </button>
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={cn(
                  "px-2 py-1 text-xs rounded transition-colors",
                  range === r.value
                    ? "bg-white/10 text-white"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="sr-only">
        <p>
          Trading chart summary for {modelSlug ?? "this model"}, metric {METRICS.find((item) => item.value === metric)?.label ?? metric}, range {RANGES.find((item) => item.value === range)?.label ?? range}, shown as a {chartMode} chart.
        </p>
        {accessiblePoints.length > 0 ? (
          <ol>
            {accessiblePoints.map((point) => (
              <li key={`${point.time}-${point.close}`}>
                {point.time}: open {point.open}, high {point.high}, low {point.low}, close {point.close}.
              </li>
            ))}
          </ol>
        ) : (
          <p>No trading data is available.</p>
        )}
      </div>
      <div className="relative" style={{ height }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="animate-spin h-6 w-6 border-2 border-[#00d4aa] border-t-transparent rounded-full" />
          </div>
        )}
        {!isLoading && error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-red-500 p-4">{error?.message || "Failed to load chart data"}</p>
          </div>
        )}
        {!isLoading && !error && chartData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            No data available for this range
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" aria-hidden="true" />
      </div>
    </div>
  );
}
