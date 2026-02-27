"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

interface QualityDistributionProps {
  data: { name: string; quality: number; provider: string }[];
}

const COLORS = [
  "#FFD700", "#C0C0C0", "#CD7F32",
  "#00d4aa", "#00d4aa", "#00d4aa", "#00d4aa", "#00d4aa",
  "#00b4d8", "#00b4d8", "#00b4d8", "#00b4d8",
  "#666", "#666", "#666", "#666", "#666", "#666", "#666", "#666",
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold">{d?.name}</p>
      <p className="text-xs text-muted-foreground">
        Provider: <span className="text-foreground">{d?.provider}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Quality: <span className="font-medium text-neon">{d?.quality?.toFixed(1)}</span>
      </p>
    </div>
  );
}

export function QualityDistribution({ data }: QualityDistributionProps) {
  if (data.length === 0) return null;

  return (
    <Card className="border-border/50 bg-card mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-neon" />
          Quality Score Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ left: 0, right: 10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "#888" }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#888" }}
              label={{ value: "Quality Score", angle: -90, position: "insideLeft", fill: "#888", fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="quality" radius={[4, 4, 0, 0]} barSize={24}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i] ?? "#00d4aa"} opacity={i < 3 ? 1 : 0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
