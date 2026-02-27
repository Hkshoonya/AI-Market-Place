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
    <div
      style={{
        backgroundColor: "#0a0a0a",
        border: "1px solid #333",
        borderRadius: 8,
        padding: "8px 12px",
      }}
    >
      <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: 0 }}>
        {point.name}
      </p>
      <p style={{ color: "#999", fontSize: 11, margin: "2px 0 0" }}>
        {point.provider}
      </p>
      <p style={{ color: "#00d4aa", fontSize: 12, margin: "4px 0 0" }}>
        Speed: {point.speed.toLocaleString()} tok/s
      </p>
      <p style={{ color: "#f59e0b", fontSize: 12, margin: "2px 0 0" }}>
        Cost: ${point.cost.toFixed(2)}/M tokens
      </p>
    </div>
  );
}

export function SpeedCostScatter({ data }: SpeedCostScatterProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ minHeight: 300 }}>
        No speed/cost data available
      </div>
    );
  }

  const avgSpeed = data.reduce((sum, d) => sum + d.speed, 0) / data.length;
  const avgCost = data.reduce((sum, d) => sum + d.cost, 0) / data.length;

  // Group by provider for coloring
  const byProvider = new Map<string, DataPoint[]>();
  for (const point of data) {
    const existing = byProvider.get(point.provider) ?? [];
    existing.push(point);
    byProvider.set(point.provider, existing);
  }

  return (
    <div style={{ minHeight: 300, width: "100%" }}>
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
