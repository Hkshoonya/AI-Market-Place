"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ModelPrice {
  name: string;
  inputPrice: number | null;
  outputPrice: number | null;
}

interface PriceComparisonProps {
  models: ModelPrice[];
}

interface ChartPoint {
  name: string;
  input: number;
  output: number;
}

function formatDollar(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(4)}`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        backgroundColor: "#0a0a0a",
        border: "1px solid #333",
        borderRadius: 8,
        padding: "8px 12px",
      }}
    >
      <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: 0 }}>
        {label}
      </p>
      {payload.map((entry) => (
        <p
          key={entry.dataKey}
          style={{ color: entry.color, fontSize: 12, margin: "4px 0 0" }}
        >
          {entry.dataKey === "input" ? "Input" : "Output"}: {formatDollar(entry.value)}/M tokens
        </p>
      ))}
    </div>
  );
}

export function PriceComparison({ models }: PriceComparisonProps) {
  const validModels = (models ?? []).filter(
    (m) => m.inputPrice != null || m.outputPrice != null
  );

  if (validModels.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ minHeight: 300 }}>
        No pricing data available
      </div>
    );
  }

  const data: ChartPoint[] = validModels.map((m) => ({
    name: m.name.length > 20 ? m.name.slice(0, 18) + "..." : m.name,
    input: m.inputPrice ?? 0,
    output: m.outputPrice ?? 0,
  }));

  const chartHeight = Math.max(300, data.length * 50 + 60);

  return (
    <div style={{ minHeight: 300, width: "100%" }}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
        >
          <CartesianGrid stroke="#333" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatDollar(v)}
            tick={{ fill: "#999", fontSize: 11 }}
            axisLine={{ stroke: "#333" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#999", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={120}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={32}
            formatter={(value: string) => (
              <span style={{ color: "#999", fontSize: 12 }}>
                {value === "input" ? "Input Price" : "Output Price"}
              </span>
            )}
          />
          <Bar dataKey="input" fill="#00d4aa" radius={[0, 4, 4, 0]} barSize={14} />
          <Bar dataKey="output" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
