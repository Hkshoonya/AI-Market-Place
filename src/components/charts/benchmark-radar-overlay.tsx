"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface ModelScores {
  modelName: string;
  color: string;
  scores: { benchmark: string; score: number; maxScore: number }[];
}

interface BenchmarkRadarOverlayProps {
  models: ModelScores[];
}

const MODEL_COLORS = [
  "#00d4aa",
  "#f59e0b",
  "#ec4899",
  "#6366f1",
  "#ef4444",
];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
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
        maxWidth: 250,
      }}
    >
      <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: 0 }}>
        {label}
      </p>
      {payload.map((entry, i) => (
        <p
          key={i}
          style={{
            color: entry.color,
            fontSize: 12,
            margin: "4px 0 0",
          }}
        >
          {entry.name}: {Number(entry.value).toFixed(1)}%
        </p>
      ))}
    </div>
  );
}

export function BenchmarkRadarOverlay({ models }: BenchmarkRadarOverlayProps) {
  if (models.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ minHeight: 350 }}
      >
        No benchmark data available
      </div>
    );
  }

  // Collect all unique benchmarks across models
  const allBenchmarks = new Set<string>();
  for (const m of models) {
    for (const s of m.scores) {
      allBenchmarks.add(s.benchmark);
    }
  }

  // Build data array: one entry per benchmark, each model as a key
  const data = Array.from(allBenchmarks).map((benchmark) => {
    const entry: Record<string, string | number> = { benchmark };
    for (const m of models) {
      const score = m.scores.find((s) => s.benchmark === benchmark);
      entry[m.modelName] = score
        ? score.maxScore > 0
          ? (score.score / score.maxScore) * 100
          : 0
        : 0;
    }
    return entry;
  });

  return (
    <div style={{ minHeight: 350, width: "100%" }}>
      <ResponsiveContainer width="100%" height={380}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#333" />
          <PolarAngleAxis
            dataKey="benchmark"
            tick={{ fill: "#fff", fontSize: 10 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "#999", fontSize: 10 }}
            axisLine={false}
          />
          {models.map((m, i) => (
            <Radar
              key={m.modelName}
              name={m.modelName}
              dataKey={m.modelName}
              stroke={m.color || MODEL_COLORS[i % MODEL_COLORS.length]}
              fill={m.color || MODEL_COLORS[i % MODEL_COLORS.length]}
              fillOpacity={0.08}
              strokeWidth={2}
            />
          ))}
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
