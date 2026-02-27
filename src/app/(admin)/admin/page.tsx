"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Box,
  Download,
  Eye,
  ShoppingBag,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/format";

interface AdminStats {
  totalModels: number;
  activeModels: number;
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  totalOrders: number;
  totalViews: number;
  totalDownloads: number;
  recentModels: { name: string; provider: string; slug: string; created_at: string }[];
  recentUsers: { display_name: string | null; email: string | null; joined_at: string | null }[];
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const [
        { count: totalModels },
        { count: activeModels },
        { count: totalUsers },
        { count: totalListings },
        { count: activeListings },
        { count: totalOrders },
        { data: modelsAgg },
        { data: recentModels },
        { data: recentUsers },
      ] = await Promise.all([
        sb.from("models").select("*", { count: "exact", head: true }),
        sb.from("models").select("*", { count: "exact", head: true }).eq("status", "active"),
        sb.from("profiles").select("*", { count: "exact", head: true }),
        sb.from("marketplace_listings").select("*", { count: "exact", head: true }),
        sb.from("marketplace_listings").select("*", { count: "exact", head: true }).eq("status", "active"),
        sb.from("marketplace_orders").select("*", { count: "exact", head: true }),
        sb.from("models").select("hf_downloads").eq("status", "active"),
        sb.from("models").select("name, provider, slug, created_at").order("created_at", { ascending: false }).limit(5),
        sb.from("profiles").select("display_name, email, joined_at").order("joined_at", { ascending: false }).limit(5),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalDownloads = ((modelsAgg as any[]) ?? []).reduce(
        (sum, m) => sum + (Number(m.hf_downloads) || 0),
        0
      );

      setStats({
        totalModels: totalModels ?? 0,
        activeModels: activeModels ?? 0,
        totalUsers: totalUsers ?? 0,
        totalListings: totalListings ?? 0,
        activeListings: activeListings ?? 0,
        totalOrders: totalOrders ?? 0,
        totalViews: 0,
        totalDownloads,
        recentModels: (recentModels ?? []) as any[],
        recentUsers: (recentUsers ?? []) as any[],
      });
      setLoading(false);
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    { label: "Total Models", value: stats.totalModels, sub: `${stats.activeModels} active`, icon: Box, color: "#00d4aa" },
    { label: "Total Users", value: stats.totalUsers, sub: "registered", icon: Users, color: "#f59e0b" },
    { label: "Marketplace Listings", value: stats.totalListings, sub: `${stats.activeListings} active`, icon: ShoppingBag, color: "#ec4899" },
    { label: "Total Orders", value: stats.totalOrders, sub: "inquiries", icon: Activity, color: "#6366f1" },
    { label: "Total Downloads", value: formatNumber(stats.totalDownloads), sub: "across all models", icon: Download, color: "#06b6d4" },
  ];

  return (
    <div className="space-y-8">
      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">
                    {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent models */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-neon" />
              Recent Models
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentModels.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{m.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{m.provider}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {m.created_at ? new Date(m.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent users */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-neon" />
              Recent Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentUsers.map((u, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {u.display_name || u.email || "Unknown user"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {u.joined_at ? new Date(u.joined_at).toLocaleDateString() : ""}
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
