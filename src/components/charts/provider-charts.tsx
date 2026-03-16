"use client";

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon, BarChart3 } from "lucide-react";

interface ProviderChartData {
  name: string;
  models: number;
  downloads: number;
  avgCapability: number | null;
}

const CHART_COLORS = [
  "#00d4aa", "#00b4d8", "#e040fb", "#ff6d00", "#ffab00",
  "#66bb6a", "#42a5f5", "#ef5350", "#ab47bc", "#78909c",
];

// Custom dark tooltip matching the site theme
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number | string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-foreground">{label || payload[0]?.name}</p>
      {payload.map((entry, i: number) => (
        <p key={i} className="text-xs text-muted-foreground">
          {entry.name}: <span className="font-medium text-foreground">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export function ProviderCharts({ providers }: { providers: ProviderChartData[] }) {
  // Top 8 for pie chart, rest grouped as "Other"
  const top8 = providers.slice(0, 8);
  const otherCount = providers.slice(8).reduce((s, p) => s + p.models, 0);
  const pieData = [
    ...top8.map((p) => ({ name: p.name, value: p.models })),
    ...(otherCount > 0 ? [{ name: "Other", value: otherCount }] : []),
  ];

  // Quality comparison - only providers with quality scores, top 10
  const qualityData = providers
    .filter((p) => p.avgCapability != null && p.avgCapability > 0)
    .slice(0, 10)
    .map((p) => ({ name: p.name, quality: Number(p.avgCapability!.toFixed(1)) }));

  return (
    <div className="grid gap-6 md:grid-cols-2 mb-8">
      {/* Market Share Pie Chart */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChartIcon className="h-4 w-4 text-neon" />
            Market Share by Models
          </CardTitle>
        </CardHeader>
        <CardContent role="img" aria-label={`Pie chart showing market share distribution across ${pieData.length} providers`}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                stroke="transparent"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
            {pieData.map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="text-[11px] text-muted-foreground">{entry.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quality Score Comparison Bar Chart */}
      {qualityData.length > 0 && (
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-neon" />
              Average Capability Score
            </CardTitle>
          </CardHeader>
          <CardContent role="img" aria-label={`Bar chart comparing average capability scores across ${qualityData.length} providers`}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={qualityData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 11, fill: "#888" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="quality" fill="#00d4aa" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
