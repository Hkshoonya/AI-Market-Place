"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface BenchmarkScore {
  benchmark: string;
  score: number;
  maxScore: number;
}

interface BenchmarkRadarProps {
  scores: BenchmarkScore[];
  modelName?: string;
}

interface RadarDataPoint {
  benchmark: string;
  normalized: number;
  raw: number;
  max: number;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: RadarDataPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#333] bg-[#0a0a0a] px-3 py-2">
      <p className="m-0 text-[13px] font-semibold text-white">
        {data.benchmark}
      </p>
      <p className="mt-1 text-xs text-[#00d4aa]">
        {data.raw} / {data.max} ({data.normalized.toFixed(1)}%)
      </p>
    </div>
  );
}

export function BenchmarkRadar({ scores, modelName }: BenchmarkRadarProps) {
  if (!scores || scores.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
        No benchmark data available
      </div>
    );
  }

  const data: RadarDataPoint[] = scores.map((s) => ({
    benchmark: s.benchmark,
    normalized: s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0,
    raw: s.score,
    max: s.maxScore,
  }));

  return (
    <div className="min-h-[300px] w-full" role="img" aria-label={`Benchmark radar chart${modelName ? ` for ${modelName}` : ""} showing scores across ${data.length} benchmarks`}>
      {modelName && (
        <p className="mb-2 text-center text-sm text-muted-foreground">
          {modelName}
        </p>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="#333" />
          <PolarAngleAxis
            dataKey="benchmark"
            tick={{ fill: "#fff", fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "#999", fontSize: 10 }}
            axisLine={false}
          />
          <Radar
            name={modelName ?? "Score"}
            dataKey="normalized"
            stroke="#00d4aa"
            fill="#00d4aa"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
