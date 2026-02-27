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
  hf_downloads: number | null;
}

interface DownloadsTrendProps {
  snapshots: Snapshot[];
}

interface ChartPoint {
  date: string;
  label: string;
  downloads: number;
}

function abbreviateNumber(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

function formatFullNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
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
        {formatFullNumber(payload[0].value)} downloads
      </p>
    </div>
  );
}

export function DownloadsTrend({ snapshots }: DownloadsTrendProps) {
  const validData: ChartPoint[] = (snapshots ?? [])
    .filter((s): s is Snapshot & { hf_downloads: number } => s.hf_downloads != null)
    .map((s) => ({
      date: s.snapshot_date,
      label: format(parseISO(s.snapshot_date), "MMM dd"),
      downloads: s.hf_downloads,
    }));

  if (validData.length < 2) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ minHeight: 300 }}>
        Not enough download data to display trend
      </div>
    );
  }

  return (
    <div style={{ minHeight: 300, width: "100%" }}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={validData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="downloadsGradient" x1="0" y1="0" x2="0" y2="1">
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
            tickFormatter={abbreviateNumber}
            tick={{ fill: "#999", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="downloads"
            stroke="#00d4aa"
            strokeWidth={2}
            fill="url(#downloadsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
