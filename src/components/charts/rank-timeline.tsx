"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Brush, Legend,
} from "recharts";
import type { Payload } from "recharts/types/component/DefaultTooltipContent";
import { ChartCard } from "./chart-card";
import { RankTimelineControls } from "./rank-timeline-controls";
import { RankTimelineTags, LINE_COLORS } from "./rank-timeline-tags";
import type { ModelInfo } from "./rank-timeline-tags";

const DEFAULT_SLUGS = ["o3", "claude-4-opus", "deepseek-r1"];

interface TimelineDataPoint {
  date: string;
  [slug: string]: number | string;
}

interface ApiResponse {
  data: TimelineDataPoint[];
  models: ModelInfo[];
}

function CustomTooltip({
  active, payload, label, metric,
}: {
  active?: boolean;
  payload?: ReadonlyArray<Payload<number, string>>;
  label?: string;
  metric: "rank" | "score";
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 6 }}>{label}</p>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color ?? "#666", display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{entry.name}</span>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, marginLeft: "auto" }}>
            {metric === "rank" ? `#${entry.value}` : (entry.value ?? 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RankTimeline() {
  const [slugs, setSlugs] = useState<string[]>(DEFAULT_SLUGS);
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<"rank" | "score">("rank");
  const [data, setData] = useState<TimelineDataPoint[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  const fetchData = useCallback(async () => {
    if (slugs.length === 0) { setData([]); setModels([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ slugs: slugs.join(","), days: String(days), metric });
      const res = await fetch(`/api/charts/rank-timeline?${params}`);
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const json: ApiResponse = await res.json();
      setData(json.data); setModels(json.models);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally { setLoading(false); }
  }, [slugs, days, metric]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addSlug = () => {
    const slug = inputValue.trim().toLowerCase();
    if (slug && !slugs.includes(slug)) setSlugs((prev) => [...prev, slug]);
    setInputValue("");
  };
  const removeSlug = (slug: string) => { setSlugs((prev) => prev.filter((s) => s !== slug)); };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); addSlug(); }
  };
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Compute smart Y-axis domain
  const allValues: number[] = [];
  for (const point of data) {
    for (const slug of slugs) {
      const val = point[slug];
      if (typeof val === "number" && val > 0) allValues.push(val);
    }
  }
  const dataMin = allValues.length > 0 ? Math.min(...allValues) : 1;
  const dataMax = allValues.length > 0 ? Math.max(...allValues) : 100;
  const yPad = Math.max(Math.ceil((dataMax - dataMin) * 0.15), 1);
  const smartYDomain: [number, number] = metric === "rank"
    ? [Math.max(1, dataMin - yPad), dataMax + yPad]
    : [Math.max(0, dataMin - yPad), dataMax + yPad];

  return (
    <ChartCard title="Rank Movement Timeline" subtitle="Track how model rankings change over time">
      <div style={{ padding: "20px 20px 0" }}>
        <RankTimelineControls
          metric={metric} setMetric={setMetric} days={days} setDays={setDays}
          inputValue={inputValue} setInputValue={setInputValue}
          onAddSlug={addSlug} onKeyDown={handleKeyDown}
        />
        <RankTimelineTags slugs={slugs} models={models} onRemoveSlug={removeSlug} />
      </div>

      <div style={{ width: "100%", height: 400, padding: "0 8px 12px" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            Loading chart data...
          </div>
        ) : error ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ef4444", fontSize: 14 }}>
            {error}
          </div>
        ) : data.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            {slugs.length === 0 ? "Add a model to start tracking" : "No data available"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate} stroke="rgba(255,255,255,0.5)" fontSize={11} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
              <YAxis
                reversed={metric === "rank"} stroke="rgba(255,255,255,0.5)" fontSize={11}
                tickLine={false} axisLine={false} width={48} domain={smartYDomain} allowDataOverflow={false}
                tickFormatter={(val: number) => metric === "rank" ? `#${val}` : val.toLocaleString()}
              />
              <Tooltip content={({ active, payload, label }) => (
                <CustomTooltip active={active} payload={payload as ReadonlyArray<Payload<number, string>>} label={label as string} metric={metric} />
              )} />
              <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.5)", paddingTop: 8 }} />
              {slugs.map((slug, i) => {
                const modelInfo = models.find((m) => m.slug === slug);
                return (
                  <Line key={slug} type="monotone" dataKey={slug} name={modelInfo ? modelInfo.name : slug}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }} connectNulls />
                );
              })}
              {data.length > 14 && (
                <Brush dataKey="date" height={28} stroke="rgba(255,255,255,0.15)" fill="#0a0a0a" tickFormatter={formatDate} />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}
