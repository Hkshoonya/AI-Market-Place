"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, PauseCircle, PlayCircle, Server, Wallet } from "lucide-react";
import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SWR_TIERS } from "@/lib/swr/config";
import { cn } from "@/lib/utils";
import type { WorkspaceDeploymentResponse } from "@/lib/workspace/deployment-summary";

interface DeploymentListSnapshot {
  deployments: WorkspaceDeploymentResponse[];
}

function formatCurrency(value: number | null) {
  if (value == null) return "Not set";
  return `$${value.toFixed(2)}`;
}

export default function DeploymentsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [pendingModelSlug, setPendingModelSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [loading, pathname, router, user]);

  const { data, mutate } = useSWR<DeploymentListSnapshot>(
    user ? "/api/workspace/deployments" : null,
    { ...SWR_TIERS.MEDIUM }
  );

  const deployments = useMemo(() => data?.deployments ?? [], [data?.deployments]);

  useEffect(() => {
    setBudgetDrafts((current) => {
      const next = { ...current };
      for (const deployment of deployments) {
        if (!(deployment.modelSlug in next)) {
          next[deployment.modelSlug] =
            deployment.creditsBudget != null ? String(deployment.creditsBudget) : "";
        }
      }
      return next;
    });
  }, [deployments]);

  const summary = useMemo(() => {
    const ready = deployments.filter((deployment) => deployment.status === "ready").length;
    const paused = deployments.filter((deployment) => deployment.status === "paused").length;
    const totalSpend = deployments.reduce(
      (sum, deployment) => sum + deployment.billing.estimatedSpend,
      0
    );
    return { ready, paused, totalSpend };
  }, [deployments]);

  const updateDeployment = async (
    modelSlug: string,
    action: "pause" | "resume" | "set_budget"
  ) => {
    setPendingModelSlug(modelSlug);
    setError(null);

    try {
      const response = await fetch("/api/workspace/deployment", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelSlug,
          action,
          creditsBudget:
            action === "set_budget"
              ? budgetDrafts[modelSlug]?.trim()
                ? Number(budgetDrafts[modelSlug])
                : null
              : undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update deployment");
      }

      await mutate();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update deployment");
    } finally {
      setPendingModelSlug(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-56 rounded bg-secondary" />
          <div className="h-48 rounded-2xl bg-secondary" />
          <div className="h-48 rounded-2xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="outline" className="border-neon/20 bg-neon/10 text-neon">
            Deployments
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold text-white">Managed model deployments</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Keep track of every in-site deployment you created on AI Market Cap. Review status,
            budget, endpoint, and usage without losing the workspace session.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/workspace">Open Workspace</Link>
          </Button>
          <Button asChild className="bg-neon text-background hover:bg-neon/90">
            <Link href="/models">Browse Models</Link>
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="border-border/50 bg-card/70">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Total deployments
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{deployments.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/70">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Ready now
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.ready}</p>
            <p className="mt-1 text-xs text-muted-foreground">{summary.paused} paused</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/70">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Estimated spend
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">${summary.totalSpend.toFixed(2)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Across all deployment requests</p>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {deployments.length === 0 ? (
        <Card className="border-border/50 bg-card/70">
          <CardContent className="space-y-4 p-8 text-center">
            <Server className="mx-auto h-10 w-10 text-neon" />
            <div>
              <h2 className="text-xl font-semibold text-white">No deployments yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Start from a supported model page and create the managed in-site deployment there.
              </p>
            </div>
            <Button asChild className="bg-neon text-background hover:bg-neon/90">
              <Link href="/models">Find a model to deploy</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {deployments.map((deployment) => {
            const budgetStatusTone =
              deployment.billing.budgetStatus === "healthy"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                : deployment.billing.budgetStatus === "low"
                  ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                  : deployment.billing.budgetStatus === "exhausted"
                    ? "border-red-500/20 bg-red-500/10 text-red-300"
                    : "border-border/50 bg-card/40 text-muted-foreground";

            return (
              <Card key={deployment.id} className="border-border/50 bg-card/70">
                <CardContent className="space-y-5 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-neon/20 bg-neon/10 text-neon">
                          {deployment.deploymentLabel ?? "Managed deployment"}
                        </Badge>
                        <Badge variant="outline" className={cn("capitalize", budgetStatusTone)}>
                          {deployment.billing.budgetStatus}
                        </Badge>
                        <Badge variant="outline" className="border-border/50 bg-card/40 capitalize">
                          {deployment.status}
                        </Badge>
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-white">{deployment.modelName}</h2>
                        <p className="text-sm text-muted-foreground">
                          {deployment.providerName ?? "Unknown provider"} · {deployment.execution.summary}
                        </p>
                      </div>
                      <code className="block text-xs text-foreground">
                        {deployment.endpointPath}
                      </code>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" asChild>
                        <Link href={`/models/${deployment.modelSlug}`}>
                          Model Page
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/workspace">Workspace</Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pendingModelSlug === deployment.modelSlug}
                        onClick={() =>
                          updateDeployment(
                            deployment.modelSlug,
                            deployment.status === "paused" ? "resume" : "pause"
                          )
                        }
                      >
                        {deployment.status === "paused" ? (
                          <>
                            <PlayCircle className="h-4 w-4" />
                            Resume
                          </>
                        ) : (
                          <>
                            <PauseCircle className="h-4 w-4" />
                            Pause
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-lg border border-border/50 bg-card/40 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Requests
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">{deployment.totalRequests}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-card/40 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Tokens
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">{deployment.totalTokens}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-card/40 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Per request
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {formatCurrency(deployment.billing.requestCharge)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-card/40 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Budget remaining
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {formatCurrency(deployment.billing.budgetRemaining)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                    <div>
                      <label
                        htmlFor={`budget-${deployment.id}`}
                        className="text-xs uppercase tracking-[0.14em] text-muted-foreground"
                      >
                        Credits budget
                      </label>
                      <Input
                        id={`budget-${deployment.id}`}
                        inputMode="decimal"
                        placeholder="Set budget cap"
                        value={budgetDrafts[deployment.modelSlug] ?? ""}
                        onChange={(event) =>
                          setBudgetDrafts((current) => ({
                            ...current,
                            [deployment.modelSlug]: event.target.value,
                          }))
                        }
                        className="mt-2"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pendingModelSlug === deployment.modelSlug}
                      onClick={() => updateDeployment(deployment.modelSlug, "set_budget")}
                    >
                      <Wallet className="h-4 w-4" />
                      Save Budget
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      Current cap: {formatCurrency(deployment.creditsBudget)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
