"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";

interface ProviderSlice {
  provider: string;
  count: number;
  color: string;
}

interface ProviderMarketShareProps {
  data: ProviderSlice[];
}

const RADIAN = Math.PI / 180;

function renderCustomLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const percent = Number(props.percent ?? 0);

  if (percent < 0.04) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: ProviderSlice }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-[#333] bg-[#0a0a0a] px-3 py-2">
      <p className="m-0 text-[13px] font-semibold text-white">
        {item.name}
      </p>
      <p className="mt-1 text-xs" style={{ color: item.payload.color }}>
        {item.value} models
      </p>
    </div>
  );
}

export function ProviderMarketShare({ data }: ProviderMarketShareProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
        No provider data available
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  // Group small providers (<2%) into "Others" for cleaner visualization
  const threshold = total * 0.02;
  const significantSlices: ProviderSlice[] = [];
  let othersCount = 0;
  for (const d of data) {
    if (d.count >= threshold) {
      significantSlices.push(d);
    } else {
      othersCount += d.count;
    }
  }
  if (othersCount > 0) {
    significantSlices.push({ provider: "Others", count: othersCount, color: "#444" });
  }

  // Dynamic chart height based on number of visible slices
  const chartHeight = Math.max(350, significantSlices.length > 12 ? 420 : 380);
  const legendHeight = significantSlices.length > 10 ? 60 : 36;
  const accessibleSlices = significantSlices
    .slice()
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  return (
    <div className="relative w-full" style={{ minHeight: chartHeight }} role="img" aria-label={`Provider market share pie chart showing distribution of ${total} models across ${data.length} providers`}>
      <div className="sr-only">
        <p>Provider market share summary.</p>
        <ol>
          {accessibleSlices.map((slice) => (
            <li key={slice.provider}>
              {slice.provider}: {slice.count} models, {((slice.count / total) * 100).toFixed(1)} percent.
            </li>
          ))}
        </ol>
      </div>
      <div aria-hidden="true">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <PieChart>
          <Pie
            data={significantSlices}
            dataKey="count"
            nameKey="provider"
            cx="50%"
            cy="42%"
            innerRadius="35%"
            outerRadius="60%"
            paddingAngle={2}
            label={renderCustomLabel}
            labelLine={false}
          >
            {significantSlices.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={legendHeight}
            formatter={(value: string) => (
              <span className="text-xs text-[#999]">{value}</span>
            )}
          />
          {/* Center text */}
          <text
            x="50%"
            y="42%"
            textAnchor="middle"
            dominantBaseline="central"
          >
            <tspan x="50%" dy="-8" fill="#fff" fontSize={20} fontWeight={700}>
              {total}
            </tspan>
            <tspan x="50%" dy="20" fill="#999" fontSize={11}>
              total
            </tspan>
          </text>
        </PieChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
