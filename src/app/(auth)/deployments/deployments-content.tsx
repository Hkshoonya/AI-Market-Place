"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, KeyRound, PauseCircle, PlayCircle, Server, Wallet } from "lucide-react";
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

interface DeploymentActivitySnapshot {
  activity: Array<{
    id: string;
    type: string;
    amount: number;
    description: string | null;
    referenceType: string | null;
    status: string | null;
    createdAt: string | null;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    requestMessage: string | null;
    responsePreview: string | null;
    providerName: string | null;
    modelName: string | null;
    tokensUsed: number | null;
    chargeAmount: number | null;
    durationMs: number | null;
    errorMessage: string | null;
    createdAt: string | null;
  }>;
}

function DeploymentActivity({ deployment }: { deployment: WorkspaceDeploymentResponse }) {
  const { data } = useSWR<DeploymentActivitySnapshot>(
    `/api/workspace/deployments/${deployment.id}/activity`,
    { ...SWR_TIERS.MEDIUM }
  );

  const items = data?.activity ?? [];
  const events = data?.events ?? [];

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Recent activity</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Charges and refunds recorded against this deployment.
        </p>
      </div>
      {events.length === 0 && items.length === 0 ? (
        <div className="rounded-lg border border-border/50 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
          No deployment activity recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-lg border border-border/50 bg-card/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">
                  {event.eventType.replace(/_/g, " ")}
                </p>
                <Badge variant="outline" className="border-border/50 bg-card/40">
                  {event.chargeAmount != null ? `$${event.chargeAmount.toFixed(2)}` : "event"}
                </Badge>
              </div>
              {event.errorMessage ? (
                <p className="mt-2 text-xs text-red-300">{event.errorMessage}</p>
              ) : event.responsePreview ? (
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                  {event.responsePreview}
                </p>
              ) : null}
              {event.requestMessage ? (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  Prompt: {event.requestMessage}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                {event.createdAt ? new Date(event.createdAt).toLocaleString() : "Unknown time"}
                {event.tokensUsed != null ? ` · ${event.tokensUsed} tokens` : ""}
                {event.durationMs != null ? ` · ${event.durationMs}ms` : ""}
              </p>
            </div>
          ))}
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border/50 bg-card/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">
                  {item.description ?? item.type.replace(/_/g, " ")}
                </p>
                <Badge variant="outline" className="border-border/50 bg-card/40 capitalize">
                  ${item.amount.toFixed(2)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Unknown time"} ·{" "}
                {item.status ?? "confirmed"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const [testLoadingSlug, setTestLoadingSlug] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { content?: string; error?: string; provider?: string; model?: string }>
  >({});

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

  const runTestCall = async (deployment: WorkspaceDeploymentResponse) => {
    setTestLoadingSlug(deployment.modelSlug);
    setTestResults((current) => ({
      ...current,
      [deployment.modelSlug]: {},
    }));

    try {
      const response = await fetch(deployment.endpointPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Give a short one-sentence confirmation that deployment for ${deployment.modelName} is working.`,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Test call failed");
      }

      setTestResults((current) => ({
        ...current,
        [deployment.modelSlug]: {
          content: payload.response?.content ?? "Deployment responded.",
          provider: payload.response?.provider,
          model: payload.response?.model,
        },
      }));

      await mutate();
    } catch (testError) {
      setTestResults((current) => ({
        ...current,
        [deployment.modelSlug]: {
          error: testError instanceof Error ? testError.message : "Test call failed",
        },
      }));
    } finally {
      setTestLoadingSlug(null);
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
            A deployment is a saved way to run a model on AI Market Cap with its own endpoint,
            budget, and usage history. Keep track of every model setup you created here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/workspace">Open Workspace</Link>
          </Button>
          <Button asChild className="bg-neon text-background hover:bg-neon/90">
            <Link href="/deploy">Use on AI Market Cap</Link>
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
                Start with a model AI Market Cap can host here, or browse the wider set of models
                with verified provider and self-host paths.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild className="bg-neon text-background hover:bg-neon/90">
                <Link href="/deploy">Find models hosted here</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/models?deployable=true">Browse all deployable models</Link>
              </Button>
            </div>
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
                        <Badge
                          variant="outline"
                          className={cn(
                            deployment.healthStatus === "healthy"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                              : deployment.healthStatus === "error"
                                ? "border-red-500/20 bg-red-500/10 text-red-300"
                                : deployment.healthStatus === "paused"
                                  ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                                  : "border-border/50 bg-card/40 text-muted-foreground"
                          )}
                        >
                          {deployment.healthStatus}
                        </Badge>
                        <Badge variant="outline" className="border-border/50 bg-card/40 capitalize">
                          {deployment.status}
                        </Badge>
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-white">{deployment.modelName}</h2>
                        <p className="text-sm text-muted-foreground">
                          {deployment.providerName ?? "Unknown provider"} ·{" "}
                          {deployment.deploymentKind === "hosted_external"
                            ? "AI Market Cap hosted backend"
                            : deployment.execution.summary}
                        </p>
                        {deployment.lastErrorMessage ? (
                          <p className="mt-2 text-sm text-red-300">{deployment.lastErrorMessage}</p>
                        ) : null}
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

                  <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
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
                    <div className="rounded-lg border border-border/50 bg-card/40 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Last success
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {deployment.lastSuccessAt
                          ? new Date(deployment.lastSuccessAt).toLocaleString()
                          : "No successful request yet"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-card/40 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Success rate
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {deployment.successRate != null ? `${deployment.successRate}%` : "N/A"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {deployment.successfulRequests} ok / {deployment.failedRequests} failed
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-card/40 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Avg latency
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {deployment.avgResponseLatencyMs != null
                          ? `${deployment.avgResponseLatencyMs}ms`
                          : "N/A"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Last:{" "}
                        {deployment.lastResponseLatencyMs != null
                          ? `${deployment.lastResponseLatencyMs}ms`
                          : "N/A"}
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

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-border/50 bg-card/40 p-4">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-neon" />
                        <p className="text-sm font-medium text-white">API onboarding</p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Use an API key with `agent` scope for requests and `read` if you also want
                        to poll deployment status.
                      </p>
                      <code className="mt-3 block overflow-x-auto rounded-md border border-border/50 bg-background/60 px-3 py-2 text-xs text-foreground">
                        {`curl -X POST ${deployment.endpointPath} \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"Hello from AI Market Cap"}'`}
                      </code>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={testLoadingSlug === deployment.modelSlug}
                          onClick={() => runTestCall(deployment)}
                        >
                          {testLoadingSlug === deployment.modelSlug ? "Testing..." : "Run Test Call"}
                        </Button>
                        <Button variant="outline" asChild>
                          <Link
                            href={`/settings/api-keys?intent=deploy&model=${encodeURIComponent(
                              deployment.modelName
                            )}&modelSlug=${encodeURIComponent(deployment.modelSlug)}&action=Deploy`}
                          >
                            Create API Key
                          </Link>
                        </Button>
                        <Button variant="outline" asChild>
                          <Link href="/api-docs">API Docs</Link>
                        </Button>
                      </div>
                      {testResults[deployment.modelSlug]?.error ? (
                        <p className="mt-3 text-xs text-red-300">
                          {testResults[deployment.modelSlug]?.error}
                        </p>
                      ) : null}
                      {testResults[deployment.modelSlug]?.content ? (
                        <div className="mt-3 rounded-md border border-border/50 bg-background/60 px-3 py-2">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            Latest test response
                          </p>
                          <p className="mt-2 text-sm text-white">
                            {testResults[deployment.modelSlug]?.content}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            AI Market Cap ·{" "}
                            {testResults[deployment.modelSlug]?.model ?? "Unknown model"}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-lg border border-border/50 bg-card/40 p-4">
                      <DeploymentActivity deployment={deployment} />
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
