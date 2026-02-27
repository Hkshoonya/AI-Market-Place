"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";

interface Snapshot {
  snapshot_date: string;
  quality_score: number | null;
}

interface QualityTrendProps {
  snapshots: Snapshot[];
  modelName?: string;
}

interface ChartPoint {
  date: string;
  label: string;
  score: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
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
      <p style={{ color: "#999", fontSize: 12, margin: 0 }}>{label}</p>
      <p style={{ color: "#00d4aa", fontSize: 14, fontWeight: 600, margin: "4px 0 0" }}>
        {payload[0].value.toFixed(1)}
      </p>
    </div>
  );
}

export function QualityTrend({ snapshots, modelName }: QualityTrendProps) {
  const validData: ChartPoint[] = (snapshots ?? [])
    .filter((s): s is Snapshot & { quality_score: number } => s.quality_score != null)
    .map((s) => ({
      date: s.snapshot_date,
      label: format(parseISO(s.snapshot_date), "MMM dd"),
      score: s.quality_score,
    }));

  if (validData.length < 2) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ minHeight: 300 }}>
        Not enough data to display trend
      </div>
    );
  }

  return (
    <div style={{ minHeight: 300, width: "100%" }}>
      {modelName && (
        <p className="mb-2 text-sm text-muted-foreground">{modelName}</p>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={validData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="qualityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d4aa" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00d4aa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#999", fontSize: 11 }}
            axisLine={{ stroke: "#333" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#999", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#00d4aa"
            strokeWidth={2}
            fill="url(#qualityGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
