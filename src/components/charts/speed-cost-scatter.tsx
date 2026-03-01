"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  ZAxis,
} from "recharts";

interface DataPoint {
  name: string;
  speed: number;
  cost: number;
  provider: string;
  color: string;
}

interface SpeedCostScatterProps {
  data: DataPoint[];
}

function formatDollar(value: number): string {
  if (value >= 1) return `$${value.toFixed(0)}`;
  return `$${value.toFixed(2)}`;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DataPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#333] bg-[#0a0a0a] px-3 py-2">
      <p className="m-0 text-[13px] font-semibold text-white">
        {point.name}
      </p>
      <p className="mt-0.5 text-[11px] text-[#999]">
        {point.provider}
      </p>
      <p className="mt-1 text-xs text-[#00d4aa]">
        Speed: {point.speed.toLocaleString()} tok/s
      </p>
      <p className="mt-0.5 text-xs text-[#f59e0b]">
        Cost: ${point.cost.toFixed(2)}/M tokens
      </p>
    </div>
  );
}

export function SpeedCostScatter({ data }: SpeedCostScatterProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
        No speed/cost data available
      </div>
    );
  }

  const avgSpeed = data.reduce((sum, d) => sum + d.speed, 0) / data.length;
  const avgCost = data.reduce((sum, d) => sum + d.cost, 0) / data.length;

  // Smart axis scaling: clip to 95th percentile to avoid outlier stretching
  const sortedCosts = [...data].map((d) => d.cost).sort((a, b) => a - b);
  const sortedSpeeds = [...data].map((d) => d.speed).sort((a, b) => a - b);
  const p95Cost = sortedCosts[Math.floor(sortedCosts.length * 0.95)] ?? 10;
  const p95Speed = sortedSpeeds[Math.floor(sortedSpeeds.length * 0.95)] ?? 200;
  const xDomain: [number, number] = [0, Math.ceil(p95Cost * 1.15)];
  const yDomain: [number, number] = [0, Math.ceil(p95Speed * 1.15)];

  // Group by provider for coloring
  const byProvider = new Map<string, DataPoint[]>();
  for (const point of data) {
    const existing = byProvider.get(point.provider) ?? [];
    existing.push(point);
    byProvider.set(point.provider, existing);
  }

  return (
    <div className="min-h-[300px] w-full" role="img" aria-label={`Speed versus cost scatter chart comparing ${data.length} AI models`}>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#333" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="cost"
            name="Cost"
            tickFormatter={formatDollar}
            tick={{ fill: "#999", fontSize: 11 }}
            axisLine={{ stroke: "#333" }}
            tickLine={false}
            domain={xDomain}
            allowDataOverflow
            label={{
              value: "Cost ($/M tokens)",
              position: "insideBottom",
              offset: -2,
              fill: "#999",
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="speed"
            name="Speed"
            tick={{ fill: "#999", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
            domain={yDomain}
            allowDataOverflow
            label={{
              value: "Speed (tok/s)",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              fill: "#999",
              fontSize: 11,
            }}
          />
          <ZAxis range={[64, 64]} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={avgSpeed}
            stroke="#00d4aa"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          <ReferenceLine
            x={avgCost}
            stroke="#00d4aa"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          {Array.from(byProvider.entries()).map(([provider, points]) => (
            <Scatter
              key={provider}
              name={provider}
              data={points}
              fill={points[0].color}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
