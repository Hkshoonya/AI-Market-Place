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
    <div className="rounded-lg border border-[#333] bg-[#0a0a0a] px-3 py-2">
      <p className="m-0 text-[13px] font-semibold text-white">
        {label}
      </p>
      {payload.map((entry) => (
        <p
          key={entry.dataKey}
          className="mt-1 text-xs"
          style={{ color: entry.color }}
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
      <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
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
    <div className="min-h-[300px] w-full" role="img" aria-label={`Price comparison bar chart for ${data.length} models showing input and output pricing`}>
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
              <span className="text-xs text-[#999]">
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
