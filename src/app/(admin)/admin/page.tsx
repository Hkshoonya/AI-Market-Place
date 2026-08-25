"use client";

import {
  Activity,
  AlertTriangle,
  Box,
  CircleDollarSign,
  Download,
  KeyRound,
  MousePointerClick,
  PlugZap,
  Rocket,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SWR_TIERS } from "@/lib/swr/config";
import { jsonFetcher } from "@/lib/swr/fetcher";
import { formatNumber } from "@/lib/format";

interface AdminOverviewResponse {
  stats: {
    totalModels: number;
    activeModels: number;
    totalUsers: number;
    totalListings: number;
    activeListings: number;
    totalOrders: number;
    totalDownloads: number;
  };
  activation: {
    activeApiKeys: number;
    activeProviderConnections: number;
    readyDeployments: number;
    paidDataCustomers: number;
    dataRequestsThisMonth: number;
    affiliateClicks30d: number;
  };
  recentModels: { name: string; provider: string; slug: string; created_at: string }[];
  recentUsers: { id: string; display_name: string | null; email: string | null; joined_at: string | null }[];
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

interface AdminCronRun {
  id: string;
  job_name: string | null;
  status: string;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

interface AdminCronOverviewResponse {
  summary: {
    recentRuns: number;
    failedRuns24h: number;
    runningRuns: number;
    lastRunAt: string | null;
  };
  recentFailingRuns: AdminCronRun[];
}

export default function AdminOverviewPage() {
  const { data: overview, isLoading, error, mutate } = useSWR<AdminOverviewResponse>(
    "/api/admin/overview",
    jsonFetcher<AdminOverviewResponse>,
    { ...SWR_TIERS.SLOW }
  );
  const {
    data: inquiryResponse,
    error: inquiryError,
    mutate: mutateInquiries,
  } = useSWR<AdminContactSubmissionsResponse>(
    "/api/admin/contact-submissions?limit=5",
    jsonFetcher<AdminContactSubmissionsResponse>,
    { ...SWR_TIERS.MEDIUM }
  );

  const recentInquiries = inquiryResponse?.data ?? [];
  const {
    data: cronOverview,
    error: cronError,
    mutate: mutateCron,
  } = useSWR<AdminCronOverviewResponse>(
    "/api/admin/cron",
    jsonFetcher<AdminCronOverviewResponse>,
    { ...SWR_TIERS.MEDIUM }
  );
  const recentFailingRuns = cronOverview?.recentFailingRuns ?? [];

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

  if (!overview) {
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

  const { stats } = overview;
  const statCards = [
    { label: "Total Models", value: stats.totalModels, sub: `${stats.activeModels} active`, icon: Box, color: "#00d4aa" },
    { label: "Total Users", value: stats.totalUsers, sub: "registered", icon: Users, color: "#f59e0b" },
    { label: "Marketplace Listings", value: stats.totalListings, sub: `${stats.activeListings} active`, icon: ShoppingBag, color: "#ec4899" },
    { label: "Total Orders", value: stats.totalOrders, sub: "inquiries", icon: Activity, color: "#6366f1" },
    { label: "Total Downloads", value: formatNumber(stats.totalDownloads), sub: "across all models", icon: Download, color: "#06b6d4" },
  ];
  const activationCards = [
    {
      label: "Active API keys",
      value: overview.activation.activeApiKeys,
      icon: KeyRound,
    },
    {
      label: "Provider connections",
      value: overview.activation.activeProviderConnections,
      icon: PlugZap,
    },
    {
      label: "Ready deployments",
      value: overview.activation.readyDeployments,
      icon: Rocket,
    },
    {
      label: "Paid data customers",
      value: overview.activation.paidDataCustomers,
      icon: CircleDollarSign,
    },
    {
      label: "Data requests this month",
      value: overview.activation.dataRequestsThisMonth,
      icon: Activity,
    },
    {
      label: "Affiliate clicks (30d)",
      value: overview.activation.affiliateClicks30d,
      icon: MousePointerClick,
    },
  ];

  return (
    <div className="space-y-8">
      {(inquiryError || cronError) && (
        <Card role="alert" className="border-amber-400/30 bg-amber-400/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-medium">Some operational panels are unavailable</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {inquiryError instanceof Error
                    ? `Marketplace inquiries: ${inquiryError.message}`
                    : cronError instanceof Error
                      ? `Cron health: ${cronError.message}`
                      : "An operational request failed."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                void mutateInquiries();
                void mutateCron();
              }}
              className="inline-flex w-fit rounded-lg border border-border/60 px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary"
            >
              Retry panels
            </button>
          </CardContent>
        </Card>
      )}

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

      <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-neon/[0.04]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CircleDollarSign className="h-5 w-5 text-neon" />
            Activation and revenue signals
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            These are the actions that move registered users toward recurring or affiliate revenue.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {activationCards.map((signal) => (
              <div
                key={signal.label}
                className="rounded-xl border border-border/50 bg-background/40 p-4"
              >
                <signal.icon className="h-4 w-4 text-neon" />
                <p className="mt-4 text-2xl font-semibold tabular-nums">
                  {formatNumber(signal.value)}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  {signal.label}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
              {overview.recentModels.map((m) => (
                <div key={m.slug} className="flex items-center justify-between text-sm">
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
              {overview.recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between text-sm">
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

        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-neon" />
              Cron Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/40 bg-background/30 p-3">
                <p className="text-xs text-muted-foreground">Failed 24h</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {cronOverview?.summary.failedRuns24h ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-border/40 bg-background/30 p-3">
                <p className="text-xs text-muted-foreground">Running Now</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {cronOverview?.summary.runningRuns ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-border/40 bg-background/30 p-3">
                <p className="text-xs text-muted-foreground">Last Run</p>
                <p className="mt-1 text-sm font-medium">
                  {cronOverview?.summary.lastRunAt
                    ? new Date(cronOverview.summary.lastRunAt).toLocaleString()
                    : "No recent runs"}
                </p>
              </div>
            </div>

            {recentFailingRuns.length > 0 ? (
              <div className="space-y-3">
                {recentFailingRuns.map((run) => (
                  <div key={run.id} className="rounded-lg border border-loss/30 bg-loss/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {run.job_name ?? "Unnamed cron job"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {run.error_message ?? "Unknown failure"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {new Date(run.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No failing cron runs recorded in the recent window.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
