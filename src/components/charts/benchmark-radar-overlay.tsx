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
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="max-w-[250px] rounded-lg border border-[#333] bg-[#0a0a0a] px-3 py-2">
      <p className="m-0 text-[13px] font-semibold text-white">
        {label}
      </p>
      {payload.map((entry, i) => (
        <p
          key={i}
          className="mt-1 text-xs"
          style={{ color: entry.color }}
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
        className="flex min-h-[350px] items-center justify-center text-muted-foreground"
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
    <div className="min-h-[350px] w-full" role="img" aria-label={`Benchmark comparison radar chart overlaying ${models.length} models across ${allBenchmarks.size} benchmarks`}>
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
