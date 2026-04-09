import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SITE_NAME } from "@/lib/constants/site";
import { createOptionalAdminClient } from "@/lib/supabase/admin";
import type { AgentDeferredItem } from "@/types/database";

export const metadata: Metadata = {
  title: `Product Roadmap | ${SITE_NAME}`,
  description:
    "See the major AI Market Cap functionality that is planned, deferred, or blocked before wider rollout.",
  alternates: {
    canonical: "/roadmap",
  },
  openGraph: {
    title: `Product Roadmap | ${SITE_NAME}`,
    description:
      "See the major AI Market Cap functionality that is planned, deferred, or blocked before wider rollout.",
  },
  twitter: {
    card: "summary_large_image",
    title: `Product Roadmap | ${SITE_NAME}`,
    description:
      "See the major AI Market Cap functionality that is planned, deferred, or blocked before wider rollout.",
  },
};

export const revalidate = 300;

type PublicDeferredItem = Pick<
  AgentDeferredItem,
  "id" | "title" | "area" | "reason" | "risk_level" | "required_before" | "status" | "updated_at"
>;

const STATUS_COPY: Record<PublicDeferredItem["status"], string> = {
  open: "Not started",
  planned: "Planned",
  done: "Done",
  dropped: "Dropped",
};

const RISK_BADGE_VARIANT: Record<PublicDeferredItem["risk_level"], "destructive" | "secondary" | "outline"> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
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

export default async function RoadmapPage() {
  const admin = createOptionalAdminClient();
  const { data } = admin
    ? await admin
        .from("agent_deferred_items")
        .select("id, title, area, reason, risk_level, required_before, status, updated_at")
        .in("status", ["open", "planned"])
        .order("risk_level", { ascending: true })
        .order("updated_at", { ascending: false })
        .limit(200)
    : { data: [] as PublicDeferredItem[] };

  const items = (data ?? []) as PublicDeferredItem[];
  const grouped = groupByArea(items);
  const areas = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);
  const highRiskCount = items.filter((item) => item.risk_level === "high").length;
  const blockedCount = items.filter((item) => item.required_before).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="max-w-3xl space-y-4">
        <Badge variant="outline">Public Roadmap</Badge>
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">What We Planned, What Still Needs Shipping</h1>
          <p className="text-base text-muted-foreground">
            This roadmap shows the major product and infrastructure work that is still planned, blocked, or deferred.
            We only list work that materially affects what people can use on AI Market Cap.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Open roadmap items</CardDescription>
              <CardTitle className="text-3xl">{items.length}</CardTitle>
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

      <section className="mt-10 space-y-8">
        {areas.map(([area, areaItems]) => (
          <div key={area} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">{titleCase(area)}</h2>
              <p className="text-sm text-muted-foreground">
                {areaItems.length} planned item{areaItems.length === 1 ? "" : "s"}
              </p>
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
        ))}

        {items.length === 0 ? (
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
