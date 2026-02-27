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
    <div className="rounded-lg border border-[#333] bg-[#0a0a0a] px-3 py-2">
      <p className="m-0 text-[13px] font-semibold text-white">
        {label}
      </p>
      <p className="mt-1 text-xs" style={{ color: item.payload.color }}>
        {item.value} models
      </p>
    </div>
  );
}

export function CategoryDistribution({ data }: CategoryDistributionProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
        No category data available
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.count - a.count);
  const chartHeight = Math.max(300, sorted.length * 36 + 40);

  return (
    <div className="min-h-[300px] w-full" role="img" aria-label={`Category distribution chart showing model counts across ${sorted.length} categories`}>
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
