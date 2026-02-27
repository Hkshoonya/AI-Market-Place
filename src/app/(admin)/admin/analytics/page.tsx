"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Box,
  Download,
  Globe,
  Layers,
  Star,
  TrendingUp,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/format";
import { CATEGORIES } from "@/lib/constants/categories";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface AnalyticsData {
  categoryBreakdown: { category: string; count: number; label: string; color: string }[];
  providerBreakdown: { provider: string; count: number }[];
  topDownloaded: { name: string; provider: string; hf_downloads: number }[];
  topRated: { name: string; provider: string; quality_score: number }[];
  openVsClosed: { open: number; closed: number };
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold">{label || payload[0]?.name}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs text-muted-foreground">
          {entry.name}: <span className="font-medium text-foreground">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      const supabase = createClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const [
        { data: allModels },
        { data: topDownloaded },
        { data: topRated },
      ] = await Promise.all([
        sb.from("models").select("category, provider, is_open_weights").eq("status", "active"),
        sb.from("models").select("name, provider, hf_downloads").eq("status", "active").order("hf_downloads", { ascending: false, nullsFirst: false }).limit(10),
        sb.from("models").select("name, provider, quality_score").eq("status", "active").not("quality_score", "is", null).order("quality_score", { ascending: false }).limit(10),
      ]);

      const models = (allModels as any[]) ?? [];

      // Category breakdown
      const catMap = new Map<string, number>();
      models.forEach((m) => catMap.set(m.category, (catMap.get(m.category) ?? 0) + 1));
      const categoryBreakdown = Array.from(catMap.entries())
        .map(([cat, count]) => {
          const config = CATEGORIES.find((c) => c.slug === cat);
          return { category: cat, count, label: config?.label ?? cat, color: config?.color ?? "#666" };
        })
        .sort((a, b) => b.count - a.count);

      // Provider breakdown
      const provMap = new Map<string, number>();
      models.forEach((m) => provMap.set(m.provider, (provMap.get(m.provider) ?? 0) + 1));
      const providerBreakdown = Array.from(provMap.entries())
        .map(([provider, count]) => ({ provider, count }))
        .sort((a, b) => b.count - a.count);

      // Open vs closed
      const open = models.filter((m) => m.is_open_weights).length;
      const closed = models.length - open;

      setData({
        categoryBreakdown,
        providerBreakdown,
        topDownloaded: ((topDownloaded as any[]) ?? []).map((m) => ({
          name: m.name,
          provider: m.provider,
          hf_downloads: Number(m.hf_downloads) || 0,
        })),
        topRated: ((topRated as any[]) ?? []).map((m) => ({
          name: m.name,
          provider: m.provider,
          quality_score: Number(m.quality_score) || 0,
        })),
        openVsClosed: { open, closed },
      });
      setLoading(false);
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-neon" />
        Platform Analytics
      </h2>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50 bg-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon/10">
                <Globe className="h-5 w-5 text-neon" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.providerBreakdown.length}</p>
                <p className="text-xs text-muted-foreground">Unique Providers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gain/10">
                <Box className="h-5 w-5 text-gain" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.openVsClosed.open}</p>
                <p className="text-xs text-muted-foreground">Open Weight Models</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-loss/10">
                <Box className="h-5 w-5 text-loss" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.openVsClosed.closed}</p>
                <p className="text-xs text-muted-foreground">Closed Source Models</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Open vs Closed Donut */}
      <Card className="border-border/50 bg-card mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-neon" />
            Open vs Closed Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width={300} height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Open Weights", value: data.openVsClosed.open },
                    { name: "Closed Source", value: data.openVsClosed.closed },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="transparent"
                >
                  <Cell fill="#00d4aa" />
                  <Cell fill="#ef5350" />
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 ml-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#00d4aa]" />
                <span className="text-sm">Open Weights ({data.openVsClosed.open})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#ef5350]" />
                <span className="text-sm">Closed Source ({data.openVsClosed.closed})</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Category breakdown */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5 text-neon" />
              Models by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, data.categoryBreakdown.length * 36)}>
              <BarChart data={data.categoryBreakdown} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 11, fill: "#888" }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                  {data.categoryBreakdown.map((cat, i) => (
                    <Cell key={i} fill={cat.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Provider breakdown */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-neon" />
              Models by Provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, data.providerBreakdown.slice(0, 10).length * 36)}>
              <BarChart data={data.providerBreakdown.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis type="category" dataKey="provider" width={100} tick={{ fontSize: 11, fill: "#888" }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill="#00d4aa" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top downloaded */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Download className="h-5 w-5 text-neon" />
              Most Downloaded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topDownloaded.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{m.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{m.provider}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">
                    {formatNumber(m.hf_downloads)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top rated */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="h-5 w-5 text-neon" />
              Highest Rated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topRated.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{m.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{m.provider}</span>
                  </div>
                  <span className="text-neon font-semibold tabular-nums">
                    {m.quality_score.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
