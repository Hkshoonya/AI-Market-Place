import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SITE_NAME } from "@/lib/constants/site";
import { createOptionalAdminClient } from "@/lib/supabase/admin";
import type { AgentDeferredItem } from "@/types/database";

export const metadata: Metadata = {
  title: `Product Roadmap | ${SITE_NAME}`,
  description:
    "See what is already live on AI Market Cap, what is planned next, and which major product areas still have blockers.",
  alternates: {
    canonical: "/roadmap",
  },
  openGraph: {
    title: `Product Roadmap | ${SITE_NAME}`,
    description:
      "See what is already live on AI Market Cap, what is planned next, and which major product areas still have blockers.",
  },
  twitter: {
    card: "summary_large_image",
    title: `Product Roadmap | ${SITE_NAME}`,
    description:
      "See what is already live on AI Market Cap, what is planned next, and which major product areas still have blockers.",
  },
};

export const revalidate = 300;

type PublicDeferredItem = Pick<
  AgentDeferredItem,
  "id" | "slug" | "title" | "area" | "reason" | "risk_level" | "required_before" | "status" | "updated_at"
>;

const STATUS_COPY: Record<PublicDeferredItem["status"], string> = {
  open: "Not started",
  planned: "Planned",
  done: "Live now",
  dropped: "Dropped",
};

const RISK_BADGE_VARIANT: Record<PublicDeferredItem["risk_level"], "destructive" | "secondary" | "outline"> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

const AREA_DETAILS: Record<string, { href: string; summary: string }> = {
  workspace: {
    href: "/workspace",
    summary: "Workspace, guided launches, runtime setup, and operator flow.",
  },
  deployment: {
    href: "/deploy",
    summary: "One-click launches, self-host guidance, and dedicated runtime setup.",
  },
  marketplace: {
    href: "/marketplace",
    summary: "Listings, auctions, order flow, and seller operations.",
  },
  payments: {
    href: "/wallet",
    summary: "Wallet funding, payment delivery, credits, and spend controls.",
  },
  rankings: {
    href: "/leaderboards",
    summary: "Rankings, benchmark-backed leaderboards, and public scoring surfaces.",
  },
  data: {
    href: "/models",
    summary: "Model metadata, benchmarks, freshness, and pipeline-backed evidence.",
  },
  search: {
    href: "/search",
    summary: "Model discovery, search quality, and deployability/findability signals.",
  },
  providers: {
    href: "/providers",
    summary: "Provider coverage, metadata quality, and provider-level discovery.",
  },
  social: {
    href: "/commons",
    summary: "Commons feeds, threads, communities, and actor profiles.",
  },
  auth: {
    href: "/start",
    summary: "Authentication, onboarding, account setup, and protected-entry flow.",
  },
};

function groupByArea(items: PublicDeferredItem[]) {
  return items.reduce<Record<string, PublicDeferredItem[]>>((acc, item) => {
    acc[item.area] ??= [];
    acc[item.area].push(item);
    return acc;
  }, {});
}

function titleCase(value: string) {
  return value
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAreaDetails(area: string) {
  return AREA_DETAILS[area] ?? { href: "/roadmap", summary: "Tracked product work in this area." };
}

function sortRoadmapItems(items: PublicDeferredItem[]) {
  const riskRank = { high: 0, medium: 1, low: 2 } as const;
  const statusRank = { open: 0, planned: 1, done: 2, dropped: 3 } as const;

  return [...items].sort((left, right) => {
    const leftStatus = statusRank[left.status];
    const rightStatus = statusRank[right.status];
    if (leftStatus !== rightStatus) {
      return leftStatus - rightStatus;
    }

    const leftRisk = riskRank[left.risk_level];
    const rightRisk = riskRank[right.risk_level];
    if (leftRisk != rightRisk) {
      return leftRisk - rightRisk;
    }

    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  });
}

export default async function RoadmapPage() {
  const admin = createOptionalAdminClient();
  const { data } = admin
    ? await admin
        .from("agent_deferred_items")
        .select("id, slug, title, area, reason, risk_level, required_before, status, updated_at")
        .in("status", ["open", "planned", "done"])
        .order("updated_at", { ascending: false })
        .limit(200)
    : { data: [] as PublicDeferredItem[] };

  const allItems = sortRoadmapItems((data ?? []) as PublicDeferredItem[]);
  const plannedItems = allItems.filter((item) => item.status === "open" || item.status === "planned");
  const shippedItems = allItems.filter((item) => item.status === "done").slice(0, 6);
  const groupedPlanned = groupByArea(plannedItems);
  const areas = Object.entries(groupedPlanned).sort((a, b) => {
    const openDelta = b[1].length - a[1].length;
    if (openDelta !== 0) {
      return openDelta;
    }
    return a[0].localeCompare(b[0]);
  });
  const highRiskCount = plannedItems.filter((item) => item.risk_level === "high").length;
  const blockedCount = plannedItems.filter((item) => item.required_before).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="max-w-3xl space-y-4">
        <Badge variant="outline">Public Roadmap</Badge>
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">What Is Live, What Ships Next</h1>
          <p className="text-base text-muted-foreground">
            This roadmap is the public view of major AI Market Cap product work. It separates
            what people can already use from the work still planned or blocked before broader
            rollout.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Open roadmap items</CardDescription>
              <CardTitle className="text-3xl">{plannedItems.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Recently shipped</CardDescription>
              <CardTitle className="text-3xl">{shippedItems.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>High-risk blockers</CardDescription>
              <CardTitle className="text-3xl">{highRiskCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Blocked by another milestone</CardDescription>
              <CardTitle className="text-3xl">{blockedCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      {shippedItems.length > 0 ? (
        <section className="mt-10 space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Live Now</h2>
            <p className="text-sm text-muted-foreground">
              Recently completed work that is already part of the product people can use.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {shippedItems.map((item) => {
              const areaDetails = getAreaDetails(item.area);
              return (
                <Card key={item.id} className="gap-4">
                  <CardHeader className="gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{titleCase(item.area)}</Badge>
                      <Badge variant="secondary">{STATUS_COPY[item.status]}</Badge>
                    </div>
                    <CardTitle className="text-xl leading-snug">{item.title}</CardTitle>
                    <CardDescription>{item.reason}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                    <span>Last reviewed {new Date(item.updated_at).toLocaleDateString()}</span>
                    <Link
                      href={areaDetails.href}
                      className="inline-flex items-center gap-1 text-foreground transition hover:text-neon"
                    >
                      Open area
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-10 space-y-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Next Up</h2>
          <p className="text-sm text-muted-foreground">
            The biggest product and infrastructure work that still needs shipping.
          </p>
        </div>

        {areas.map(([area, areaItems]) => {
          const areaDetails = getAreaDetails(area);
          return (
            <div key={area} className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <h3 className="text-2xl font-semibold tracking-tight">{titleCase(area)}</h3>
                  <p className="text-sm text-muted-foreground">{areaDetails.summary}</p>
                  <p className="text-sm text-muted-foreground">
                    {areaItems.length} planned item{areaItems.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Link
                  href={areaDetails.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-foreground transition hover:text-neon"
                >
                  Open {titleCase(area)}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {areaItems.map((item) => (
                  <Card key={item.id} className="gap-4">
                    <CardHeader className="gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={RISK_BADGE_VARIANT[item.risk_level]}>{titleCase(item.risk_level)} risk</Badge>
                        <Badge variant="outline">{STATUS_COPY[item.status]}</Badge>
                        {item.required_before ? (
                          <Badge variant="secondary">Blocked by {titleCase(item.required_before)}</Badge>
                        ) : null}
                      </div>
                      <CardTitle className="text-xl leading-snug">{item.title}</CardTitle>
                      <CardDescription>{item.reason}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Last reviewed {new Date(item.updated_at).toLocaleDateString()}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}

        {plannedItems.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No open roadmap items</CardTitle>
              <CardDescription>There are no public roadmap items to show right now.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </section>
    </main>
  );
}
