"use client";

import {
  Activity,
  Box,
  Download,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { SWR_TIERS } from "@/lib/swr/config";
import { formatNumber } from "@/lib/format";
import type { Model } from "@/types/database";

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

interface AdminContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  created_at: string;
  listingTitle: string | null;
  listingSlug: string | null;
  link: string | null;
}

interface AdminContactSubmissionsResponse {
  data: AdminContactSubmission[];
}

export default function AdminOverviewPage() {
  const { data: stats, isLoading, error, mutate } = useSWR<AdminStats>(
    'supabase:admin-overview',
    async () => {
      const supabase = createClient();

      const [
        { count: totalModels },
        { count: activeModels },
        { count: totalUsers },
        { count: totalListings },
        { count: activeListings },
        { count: totalOrders },
        { data: modelsAgg, error: modelsAggError },
        { data: recentModels, error: recentModelsError },
        { data: recentUsers, error: recentUsersError },
      ] = await Promise.all([
        supabase.from("models").select("*", { count: "exact", head: true }),
        supabase.from("models").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("marketplace_listings").select("*", { count: "exact", head: true }),
        supabase.from("marketplace_listings").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("marketplace_orders").select("*", { count: "exact", head: true }),
        supabase.from("models").select("hf_downloads").eq("status", "active"),
        supabase.from("models").select("name, provider, slug, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("profiles").select("display_name, email, joined_at").order("joined_at", { ascending: false }).limit(5),
      ]);

      if (modelsAggError) throw modelsAggError;
      if (recentModelsError) throw recentModelsError;
      if (recentUsersError) throw recentUsersError;

      const totalDownloads = (modelsAgg ?? []).reduce(
        (sum: number, m: Pick<Model, "hf_downloads">) => sum + (Number(m.hf_downloads) || 0),
        0
      );

      return {
        totalModels: totalModels ?? 0,
        activeModels: activeModels ?? 0,
        totalUsers: totalUsers ?? 0,
        totalListings: totalListings ?? 0,
        activeListings: activeListings ?? 0,
        totalOrders: totalOrders ?? 0,
        totalViews: 0,
        totalDownloads,
        recentModels: (recentModels ?? []) as AdminStats["recentModels"],
        recentUsers: (recentUsers ?? []) as AdminStats["recentUsers"],
      };
    },
    { ...SWR_TIERS.SLOW }
  );
  const { data: inquiryResponse } = useSWR<AdminContactSubmissionsResponse>(
    "/api/admin/contact-submissions?limit=5",
    async (key: string) => {
      const response = await fetch(key);
      if (!response.ok) {
        throw new Error("Failed to load contact submissions");
      }

      return response.json() as Promise<AdminContactSubmissionsResponse>;
    },
    { ...SWR_TIERS.MEDIUM }
  );

  const recentInquiries = inquiryResponse?.data ?? [];

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-loss/30 bg-loss/5">
        <CardHeader>
          <CardTitle className="text-loss">Unable to load admin overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="inline-flex rounded-lg bg-neon px-3 py-2 text-sm font-medium text-background transition-colors hover:bg-neon/90"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle>No admin data available yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The overview will populate after the first successful admin data fetch.
          </p>
        </CardContent>
      </Card>
    );
  }

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
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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

        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-neon" />
              Recent Marketplace Inquiries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentInquiries.length > 0 ? (
              <div className="space-y-3">
                {recentInquiries.map((submission) => (
                  <div key={submission.id} className="rounded-lg border border-border/40 bg-background/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {submission.listingTitle ?? submission.subject}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {submission.name} · {submission.email}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {new Date(submission.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {submission.subject}
                    </p>
                    {submission.link ? (
                      <a
                        href={submission.link}
                        className="mt-3 inline-flex text-xs text-neon hover:underline"
                      >
                        Open listing
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No marketplace inquiries have been recorded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
