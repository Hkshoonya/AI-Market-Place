"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface CategoryItem {
  category: string;
  count: number;
  color: string;
}

interface CategoryDistributionProps {
  data: CategoryItem[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; payload: CategoryItem }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
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
      <p style={{ color: item.payload.color, fontSize: 12, margin: "4px 0 0" }}>
        {item.value} models
      </p>
    </div>
  );
}

export function CategoryDistribution({ data }: CategoryDistributionProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ minHeight: 300 }}>
        No category data available
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.count - a.count);
  const chartHeight = Math.max(300, sorted.length * 36 + 40);

  return (
    <div style={{ minHeight: 300, width: "100%" }}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 8, left: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fill: "#999", fontSize: 11 }}
            axisLine={{ stroke: "#333" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="category"
            tick={{ fill: "#999", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={120}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
            {sorted.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
