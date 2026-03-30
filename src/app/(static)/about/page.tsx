import Link from "next/link";
import type { Metadata } from "next";
import {
  Activity,
  Globe,
  ShieldCheck,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { listPublishedRevenueReports } from "@/lib/revenue/reporting";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "About",
  description: "About AI Market Cap, the definitive platform for tracking AI models.",
  openGraph: {
    title: "About",
    description: "About AI Market Cap, the definitive platform for tracking AI models.",
    url: `${SITE_URL}/about`,
  },
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
};

const VALUE_CARDS = [
  {
    icon: Globe,
    title: "Global Coverage",
    desc: "Tracking AI models from every major provider and open-source contributor worldwide.",
  },
  {
    icon: Zap,
    title: "Real-Time Data",
    desc: "Benchmark scores, pricing, and ranking signals are refreshed continuously through the platform pipeline.",
  },
  {
    icon: Users,
    title: "Community Driven",
    desc: "Users, builders, and collaborators can review models, trade agent products, and contribute to the ecosystem.",
  },
];

const REVENUE_BUCKETS = [
  "50% Product Treasury",
  "25% Core Operations & Maintenance",
  "25% Open Collaborator Pool",
];

export default async function AboutPage() {
  const reports = await listPublishedRevenueReports().catch(() => []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neon/10">
          <Activity className="h-8 w-8 text-neon" />
        </div>
        <h1 className="mt-6 text-4xl font-bold">About AI Market Cap</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          We track, rank, compare, and operationalize the AI model economy so users can
          make decisions with current data, visible methodology, and transparent platform
          governance.
        </p>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-3">
        {VALUE_CARDS.map((item) => (
          <Card key={item.title} className="border-border/50">
            <CardContent className="p-6 text-center">
              <item.icon className="mx-auto h-8 w-8 text-neon" />
              <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-16 rounded-xl border border-border/50 bg-card p-8">
        <h2 className="text-2xl font-bold">Our Mission</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          The AI landscape changes fast. New models launch daily, benchmark positions shift,
          pricing moves, and product quality varies by workload. AI Market Cap exists to make
          that movement legible across public rankings, model detail, marketplace activity,
          and operator visibility.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          That means publishing enough evidence for users to trust what they see, enough
          context for collaborators to improve the platform, and enough product scaffolding
          for agent sellers and buyers to operate without guesswork.
        </p>
      </div>

      <div className="mt-16 rounded-xl border border-border/50 bg-card p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neon/10">
            <Wallet className="h-6 w-6 text-neon" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold">Revenue transparency</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              If AI Market Cap collects revenue, the reporting logic and monthly publication
              channel remain public. Gross revenue, deductions, net platform revenue, and
              collaborator allocation rules are published so contributors and sponsors can
              inspect how platform economics are handled.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {REVENUE_BUCKETS.map((bucket) => (
            <Card key={bucket} className="border-border/50 bg-background/30">
              <CardContent className="p-5">
                <p className="text-sm font-medium">{bucket}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-xl border border-border/40 bg-background/30 p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-neon" />
              <h3 className="font-semibold">Transparency standard</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Net platform revenue is calculated after refunds, taxes, processor fees,
              pass-through seller payouts, and direct infrastructure or tooling costs tied to
              the reporting period. Collaborator payouts follow a public points formula and
              must be backed by a monthly report.
            </p>
            <div className="mt-4">
              <Link href="/activity" className="text-sm text-neon hover:underline">
                Follow platform activity
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-background/30 p-5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-neon" />
              <h3 className="font-semibold">Monthly revenue reports</h3>
            </div>
            {reports.length > 0 ? (
              <div className="mt-4 space-y-3">
                {reports.map((report) => (
                  <Link
                    key={report.slug}
                    href={`https://github.com/AI-Market-Cap/AI-Market-Cap/blob/main/reports/revenue/${report.filename}`}
                    className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-sm hover:border-neon/40 hover:bg-neon/5"
                  >
                    <span>{report.title}</span>
                    <span className="text-xs text-muted-foreground">Open report</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                The first monthly revenue report will be published here once platform revenue
                is booked into a public reporting window.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
