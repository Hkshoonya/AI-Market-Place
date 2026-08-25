"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Database,
  KeyRound,
  ListChecks,
  PlugZap,
  RefreshCw,
  Rocket,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatRelativeDate } from "@/lib/format";
import { SWR_TIERS } from "@/lib/swr/config";
import { jsonFetcher } from "@/lib/swr/fetcher";

interface AccountOverview {
  account: {
    email: string | null;
    displayName: string | null;
    joinedAt: string | null;
    isSeller: boolean;
    sellerVerified: boolean;
  };
  progress: {
    trackedModels: number;
    activeApiKeys: number;
    providerConnections: number;
    deployments: number;
    readyDeployments: number;
  };
  usage: {
    dataRequestsThisMonth: number;
    lastDataRequestAt: string | null;
    marketplaceOrders: number;
    sellerListings: number;
  };
  plan: {
    slug: string;
    status: string;
    currentPeriodEnd: string | null;
  };
  recentDeployments: Array<{
    id: string;
    model_slug: string;
    model_name: string;
    provider_name: string | null;
    status: string;
    endpoint_slug: string;
    deployment_kind: string;
    total_requests: number;
    last_used_at: string | null;
    created_at: string;
  }>;
  warnings: string[];
}

export default function DashboardContent() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<AccountOverview>(
    "/api/account/overview",
    jsonFetcher<AccountOverview>,
    { ...SWR_TIERS.MEDIUM }
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="h-64 animate-pulse rounded-3xl bg-secondary" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Card className="border-loss/30 bg-loss/5">
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-loss" />
              <div>
                <p className="font-medium text-loss">Your dashboard could not load</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "No account data returned."}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => void mutate()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const setupSteps = [
    {
      label: "Track a model",
      detail: "Build a watchlist or bookmark a model.",
      complete: data.progress.trackedModels > 0,
      href: "/models",
      cta: "Browse models",
      icon: ListChecks,
    },
    {
      label: "Create an API key",
      detail: "Use platform data and authenticated runtime endpoints.",
      complete: data.progress.activeApiKeys > 0,
      href: "/settings/api-keys",
      cta: "Open API keys",
      icon: KeyRound,
    },
    {
      label: "Connect a provider",
      detail: "Use your own provider account for supported inference paths.",
      complete: data.progress.providerConnections > 0,
      href: "/settings/providers",
      cta: "Connect provider",
      icon: PlugZap,
    },
    {
      label: "Deploy a model",
      detail: "Create a reusable endpoint from a verified deployment route.",
      complete: data.progress.deployments > 0,
      href: "/deploy",
      cta: "Start deployment",
      icon: Rocket,
    },
  ];
  const completedSteps = setupSteps.filter((step) => step.complete).length;
  const nextStep = setupSteps.find((step) => !step.complete) ?? null;
  const completion = Math.round((completedSteps / setupSteps.length) * 100);
  const name = data.account.displayName || data.account.email?.split("@")[0] || "there";
  const planName = data.plan.slug === "free" ? "Explorer" : data.plan.slug;

  const products = [
    {
      title: "Model intelligence",
      description: "Compare current models, save candidates, and follow market changes.",
      href: "/models",
      cta: "Explore models",
      metric: `${data.progress.trackedModels} tracked`,
      icon: BarChart3,
    },
    {
      title: "Data API",
      description: "Query AI Market Cap data with account-scoped keys and measured usage.",
      href: "/settings/api-keys",
      cta: "Manage API access",
      metric: `${formatNumber(data.usage.dataRequestsThisMonth)} requests this month`,
      icon: Database,
    },
    {
      title: "Provider-connected runtime",
      description: "Connect supported providers, deploy models, and keep endpoint activity together.",
      href: "/deployments",
      cta: data.progress.deployments > 0 ? "View deployments" : "Choose a model",
      metric: `${data.progress.readyDeployments} ready`,
      icon: Rocket,
    },
    {
      title: "Marketplace",
      description: "Discover agent products or prepare a seller presence for future revenue.",
      href: data.account.isSeller ? "/dashboard/seller" : "/marketplace",
      cta: data.account.isSeller ? "Seller dashboard" : "Browse marketplace",
      metric: data.account.isSeller
        ? `${data.usage.sellerListings} listings`
        : `${data.usage.marketplaceOrders} orders`,
      icon: ShoppingBag,
    },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-6 sm:py-8">
      <section className="relative overflow-hidden rounded-3xl border border-neon/15 bg-[radial-gradient(circle_at_85%_10%,rgba(0,212,170,0.16),transparent_32%),linear-gradient(135deg,rgba(19,26,31,0.96),rgba(8,12,15,0.98))] p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-neon/20 bg-neon/10 text-neon hover:bg-neon/10">
                {planName} plan
              </Badge>
              <Badge variant="outline" className="border-white/10 text-white/60">
                {data.plan.status}
              </Badge>
            </div>
            <p className="mt-8 text-xs font-medium uppercase tracking-[0.22em] text-neon/80">
              Account command center
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              Welcome back, {name}.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
              Move from model research to API access and deployment without losing your setup context.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button className="bg-neon font-semibold text-background hover:bg-neon/90" asChild>
                <Link href={nextStep?.href ?? "/workspace"}>
                  {nextStep?.cta ?? "Open workspace"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" asChild>
                <Link href="/pricing">View data plans</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">Account setup</p>
              <span className="text-sm font-semibold text-neon">{completion}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-neon transition-[width] duration-500"
                style={{ width: `${completion}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-white/50">
              {completedSteps} of {setupSteps.length} product milestones complete
            </p>
          </div>
        </div>
      </section>

      {data.warnings.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
          <p className="text-xs text-amber-200/70">{data.warnings.join(" ")}</p>
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.6fr]">
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-neon" />
              Next best action
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextStep ? (
              <div className="rounded-2xl border border-neon/15 bg-neon/[0.04] p-5">
                <nextStep.icon className="h-6 w-6 text-neon" />
                <h2 className="mt-5 text-xl font-semibold">{nextStep.label}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {nextStep.detail}
                </p>
                <Button className="mt-5" variant="outline" asChild>
                  <Link href={nextStep.href}>{nextStep.cta}</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-gain/20 bg-gain/5 p-5">
                <CheckCircle2 className="h-6 w-6 text-gain" />
                <h2 className="mt-5 text-xl font-semibold">Core setup complete</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Continue in Workspace or review your live deployments and usage.
                </p>
                <Button className="mt-5" variant="outline" asChild>
                  <Link href="/workspace">Open workspace</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Setup path</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Each step unlocks a more useful product workflow.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={isValidating}
              onClick={() => void mutate()}
              aria-label="Refresh account dashboard"
            >
              <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {setupSteps.map((step, index) => (
              <Link
                key={step.label}
                href={step.href}
                className="group flex items-start gap-3 rounded-xl border border-border/50 p-4 transition-colors hover:border-neon/25 hover:bg-neon/[0.025]"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                    step.complete
                      ? "bg-gain/10 text-gain"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {step.complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium group-hover:text-neon">{step.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {step.detail}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Products available to your account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start free, then move into connected compute or paid data access when it fits.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Paid data upgrades are currently handled as pilot access.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => (
            <Card key={product.title} className="group border-border/50 bg-card transition-colors hover:border-neon/25">
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-center justify-between">
                  <div className="rounded-xl border border-neon/15 bg-neon/10 p-2.5 text-neon">
                    <product.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{product.metric}</span>
                </div>
                <h3 className="mt-6 text-base font-semibold">{product.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                  {product.description}
                </p>
                <Link href={product.href} className="mt-5 inline-flex items-center text-sm font-medium text-neon">
                  {product.cta}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50 bg-card">
          <CardContent className="p-5">
            <Database className="h-4 w-4 text-neon" />
            <p className="mt-4 text-2xl font-semibold tabular-nums">
              {formatNumber(data.usage.dataRequestsThisMonth)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Data API requests this month</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardContent className="p-5">
            <Rocket className="h-4 w-4 text-neon" />
            <p className="mt-4 text-2xl font-semibold tabular-nums">
              {data.progress.deployments}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Deployment records</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardContent className="p-5">
            <CircleDollarSign className="h-4 w-4 text-neon" />
            <p className="mt-4 text-2xl font-semibold capitalize">{planName}</p>
            <p className="mt-1 text-xs text-muted-foreground">Current data access plan</p>
          </CardContent>
        </Card>
      </section>

      {data.recentDeployments.length > 0 ? (
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Recent deployments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentDeployments.map((deployment) => (
              <Link
                key={deployment.id}
                href="/deployments"
                className="flex flex-col gap-2 rounded-xl border border-border/40 p-4 transition-colors hover:bg-secondary/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{deployment.model_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {deployment.provider_name || deployment.deployment_kind}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="outline" className="capitalize">{deployment.status}</Badge>
                  <span>{formatRelativeDate(deployment.last_used_at ?? deployment.created_at)}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
