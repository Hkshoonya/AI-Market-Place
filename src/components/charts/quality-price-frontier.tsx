"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ZAxis,
} from "recharts";
import { ChartCard } from "./chart-card";
import { ChartControls, useChartFilters } from "./chart-controls";

const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: "#10a37f",
  Anthropic: "#d4a574",
  Google: "#4285f4",
  Meta: "#0668E1",
  Mistral: "#ff7000",
  DeepSeek: "#4f9cf7",
  xAI: "#ffffff",
  Cohere: "#39594d",
  "Stability AI": "#8b5cf6",
  default: "#666",
};

interface QualityPriceDataPoint {
  slug: string;
  name: string;
  provider: string;
  qualityScore: number;
  inputPrice: number;
  parameterCount: number;
  rank: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: QualityPriceDataPoint;
  }>;
}

function CustomScatterTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div
      style={{
        background: "rgba(15, 15, 15, 0.95)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "8px",
        padding: "12px 16px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        backdropFilter: "blur(12px)",
        minWidth: "200px",
      }}
    >
      <p
        style={{
          color: "#ffffff",
          fontWeight: 600,
          fontSize: "14px",
          margin: "0 0 8px 0",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          paddingBottom: "6px",
        }}
      >
        {data.name}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>
            Provider
          </span>
          <span
            style={{
              color: PROVIDER_COLORS[data.provider] || PROVIDER_COLORS.default,
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            {data.provider}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>
            Quality Score
          </span>
          <span style={{ color: "#00d4aa", fontSize: "12px", fontWeight: 500 }}>
            {data.qualityScore.toFixed(1)}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>
            Price
          </span>
          <span
            style={{ color: "#ffffff", fontSize: "12px", fontWeight: 500 }}
          >
            ${data.inputPrice.toFixed(2)}/M tokens
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>
            Rank
          </span>
          <span
            style={{ color: "#ffffff", fontSize: "12px", fontWeight: 500 }}
          >
            #{data.rank}
          </span>
        </div>
      </div>
    </div>
  );
}

function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[provider] || PROVIDER_COLORS.default;
}

export default function QualityPriceFrontier() {
  const [data, setData] = useState<QualityPriceDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logScale, setLogScale] = useState(false);
  const { filters, setFilters } = useChartFilters();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.category) params.set("category", filters.category);
      if (filters.providers.length > 0) params.set("provider", filters.providers.join(","));

      const queryString = params.toString();
      const url = `/api/charts/quality-price${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Failed to fetch data: ${res.status}`);
      }

      const json = await res.json();
      setData(json.data ?? json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chart data");
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.providers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group data by provider for color-coded scatter series
  const groupedByProvider = data.reduce<Record<string, QualityPriceDataPoint[]>>(
    (acc, point) => {
      const provider = point.provider || "Unknown";
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(point);
      return acc;
    },
    {}
  );

  // Determine bubble size range from parameter counts
  const paramCounts = data.map((d) => d.parameterCount).filter(Boolean);
  const minParam = paramCounts.length > 0 ? Math.min(...paramCounts) : 1;
  const maxParam = paramCounts.length > 0 ? Math.max(...paramCounts) : 1000;

  // Compute smart axis domains from data
  const prices = data.map((d) => d.inputPrice).filter((p) => p > 0);
  const scores = data.map((d) => d.qualityScore).filter(Boolean);

  // Use 95th percentile for X-axis to avoid extreme outliers stretching the chart
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const p95Price = sortedPrices[Math.floor(sortedPrices.length * 0.95)] ?? 10;
  const xMax = Math.ceil(p95Price * 1.15); // 15% padding above p95

  // Y-axis: fit to actual score range with padding
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 100;
  const yPadding = Math.max((maxScore - minScore) * 0.1, 3);
  const yMin = Math.max(0, Math.floor(minScore - yPadding));
  const yMax = Math.min(100, Math.ceil(maxScore + yPadding));

  const handleDotClick = (entry: QualityPriceDataPoint) => {
    if (entry?.slug) {
      window.location.href = `/models/${entry.slug}`;
    }
  };

  return (
    <ChartCard
      title="Quality vs Price Frontier"
      subtitle="Quality scores vs input pricing. Bubble size = parameter count."
    >
      <div style={{ marginBottom: "16px" }}>
        <ChartControls filters={filters} onChange={setFilters} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
          paddingLeft: "8px",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "rgba(255,255,255,0.5)",
            fontSize: "12px",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={logScale}
            onChange={(e) => setLogScale(e.target.checked)}
            style={{ accentColor: "#00d4aa" }}
          />
          Log scale (X-axis)
        </label>
      </div>

      {loading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "400px",
            color: "rgba(255,255,255,0.5)",
            fontSize: "14px",
          }}
        >
          Loading chart data...
        </div>
      )}

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "400px",
            color: "#ef4444",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "400px",
            color: "rgba(255,255,255,0.5)",
            fontSize: "14px",
          }}
        >
          No data available for the selected filters.
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <ResponsiveContainer width="100%" height={500}>
          <ScatterChart
            margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
            style={{ background: "#0a0a0a" }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={true}
              horizontal={true}
            />
            <XAxis
              type="number"
              dataKey="inputPrice"
              name="Input Price"
              unit="$/M"
              scale={logScale ? "log" : "auto"}
              domain={logScale ? ["auto", "auto"] : [0, xMax]}
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
              label={{
                value: "Input Price ($/M tokens)",
                position: "insideBottom",
                offset: -10,
                fill: "rgba(255,255,255,0.5)",
                fontSize: 12,
              }}
              allowDataOverflow
              tickFormatter={(val: number) =>
                val >= 1 ? `$${val.toFixed(0)}` : `$${val.toFixed(2)}`
              }
            />
            <YAxis
              type="number"
              dataKey="qualityScore"
              name="Quality Score"
              domain={[yMin, yMax]}
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
              label={{
                value: "Quality Score",
                angle: -90,
                position: "insideLeft",
                offset: 0,
                fill: "rgba(255,255,255,0.5)",
                fontSize: 12,
              }}
            />
            <ZAxis
              type="number"
              dataKey="parameterCount"
              range={[40, 400]}
              domain={[minParam, maxParam]}
              name="Parameters"
            />
            <Tooltip
              content={<CustomScatterTooltip />}
              cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.1)" }}
            />
            <Legend
              wrapperStyle={{
                color: "rgba(255,255,255,0.5)",
                fontSize: "12px",
                paddingTop: "12px",
              }}
            />
            {Object.entries(groupedByProvider).map(([provider, points]) => (
              <Scatter
                key={provider}
                name={provider}
                data={points}
                fill={getProviderColor(provider)}
                fillOpacity={0.8}
                stroke={getProviderColor(provider)}
                strokeWidth={1}
                strokeOpacity={0.4}
                cursor="pointer"
                onClick={(_data: unknown, _index: number, event: React.MouseEvent) => {
                  // Recharts ScatterPointItem has payload with the original data
                  const point = _data as { payload?: QualityPriceDataPoint };
                  const entry = point?.payload;
                  if (entry?.slug) {
                    event?.preventDefault?.();
                    handleDotClick(entry);
                  }
                }}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
