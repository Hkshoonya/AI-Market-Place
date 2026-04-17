"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  Copy,
  KeyRound,
  PauseCircle,
  PlayCircle,
  Search,
  Server,
  Trash2,
  Wallet,
} from "lucide-react";
import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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

type DeploymentViewFilter =
  | "all"
  | "attention"
  | "ready"
  | "paused"
  | "provisioning";

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

function getDeploymentStatePresentation(deployment: WorkspaceDeploymentResponse) {
  if (deployment.status === "failed" || deployment.healthStatus === "error") {
    return {
      label: "Needs repair",
      className: "border-red-500/20 bg-red-500/10 text-red-300",
    };
  }

  if (deployment.status === "paused") {
    return {
      label: "Paused",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    };
  }

  if (deployment.status === "provisioning") {
    return {
      label: "Provisioning",
      className: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
    };
  }

  return {
    label: "Ready",
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  };
}

function getDeploymentNextStep(deployment: WorkspaceDeploymentResponse) {
  if (deployment.status === "failed" || deployment.healthStatus === "error") {
    return {
      title: "Review the last error",
      detail:
        deployment.lastErrorMessage ??
        "Open this model in workspace and review the last deployment error before retrying requests.",
      tone: "border-red-500/20 bg-red-500/10",
      workspaceLabel: "Open deployment workflow",
      workspaceAction: "Review deployment error",
    };
  }

  if (deployment.status === "provisioning") {
    return {
      title: "Wait for setup to finish",
      detail:
        "This deployment is still being prepared. Come back when it turns ready, then run a quick test.",
      tone: "border-cyan-500/20 bg-cyan-500/10",
      workspaceLabel: "Open deployment workflow",
      workspaceAction: "Watch deployment setup",
    };
  }

  if (deployment.status === "paused") {
    return {
      title: "Resume before sending requests",
      detail:
        "This deployment is paused. Resume it first, then run a quick test or continue from workspace.",
      tone: "border-amber-500/20 bg-amber-500/10",
      workspaceLabel: "Open deployment workflow",
      workspaceAction: "Resume deployment workflow",
    };
  }

  if (deployment.billing.budgetStatus === "exhausted") {
    return {
      title: "Add budget before more traffic",
      detail:
        "This deployment has no tracked budget remaining. Update the budget, then run a quick test.",
      tone: "border-red-500/20 bg-red-500/10",
      workspaceLabel: "Open deployment workflow",
      workspaceAction: "Fix deployment budget",
    };
  }

  if (deployment.billing.budgetStatus === "low") {
    return {
      title: "Top up budget soon",
      detail:
        "Budget is getting low. Keep the endpoint healthy by topping up before new traffic spikes.",
      tone: "border-amber-500/20 bg-amber-500/10",
      workspaceLabel: "Open deployment workflow",
      workspaceAction: "Check deployment budget",
    };
  }

  return {
    title: "Ready for traffic",
    detail: "Run a quick test, then use this endpoint directly or continue from workspace.",
    tone: "border-emerald-500/20 bg-emerald-500/10",
    workspaceLabel: "Open deployment workflow",
    workspaceAction: "Use live deployment",
  };
}

export default function DeploymentsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const workspace = useWorkspace();
  const [pendingModelSlug, setPendingModelSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [testLoadingSlug, setTestLoadingSlug] = useState<string | null>(null);
  const [copiedEndpointSlug, setCopiedEndpointSlug] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<DeploymentViewFilter>("all");
  const [deploymentQuery, setDeploymentQuery] = useState("");
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
    const provisioning = deployments.filter(
      (deployment) => deployment.status === "provisioning"
    ).length;
    const attention = deployments.filter(
      (deployment) =>
        deployment.status === "failed" ||
        deployment.healthStatus === "error" ||
        deployment.billing.budgetStatus === "exhausted"
    ).length;
    const totalSpend = deployments.reduce(
      (sum, deployment) => sum + deployment.billing.estimatedSpend,
      0
    );
    const firstAttention =
      deployments.find(
        (deployment) =>
          deployment.status === "failed" ||
          deployment.healthStatus === "error" ||
          deployment.billing.budgetStatus === "exhausted"
      ) ?? null;
    const firstPaused = deployments.find((deployment) => deployment.status === "paused") ?? null;
    const firstProvisioning =
      deployments.find((deployment) => deployment.status === "provisioning") ?? null;
    return {
      ready,
      paused,
      provisioning,
      attention,
      totalSpend,
      firstAttention,
      firstPaused,
      firstProvisioning,
    };
  }, [deployments]);

  const showActionQueue = summary.attention > 0 || summary.paused > 0 || summary.provisioning > 0;

  const filterCounts = useMemo(
    () => ({
      all: deployments.length,
      attention: deployments.filter(
        (deployment) =>
          deployment.status === "failed" ||
          deployment.healthStatus === "error" ||
          deployment.billing.budgetStatus === "exhausted"
      ).length,
      ready: deployments.filter((deployment) => deployment.status === "ready").length,
      paused: deployments.filter((deployment) => deployment.status === "paused").length,
      provisioning: deployments.filter((deployment) => deployment.status === "provisioning")
        .length,
    }),
    [deployments]
  );

  const filteredDeployments = useMemo(() => {
    const normalizedQuery = deploymentQuery.trim().toLowerCase();

    return deployments.filter((deployment) => {
      const matchesFilter =
        viewFilter === "all"
          ? true
          : viewFilter === "attention"
            ? deployment.status === "failed" ||
              deployment.healthStatus === "error" ||
              deployment.billing.budgetStatus === "exhausted"
            : viewFilter === "ready"
              ? deployment.status === "ready"
              : viewFilter === "paused"
                ? deployment.status === "paused"
                : deployment.status === "provisioning";

      if (!matchesFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        deployment.modelName,
        deployment.modelSlug,
        deployment.providerName,
        deployment.endpointSlug,
        deployment.deploymentLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [deploymentQuery, deployments, viewFilter]);

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

  const copyEndpoint = async (deployment: WorkspaceDeploymentResponse) => {
    try {
      await navigator.clipboard.writeText(deployment.endpointPath);
      setCopiedEndpointSlug(deployment.modelSlug);
      window.setTimeout(() => {
        setCopiedEndpointSlug((current) =>
          current === deployment.modelSlug ? null : current
        );
      }, 1600);
    } catch {
      setError("Failed to copy deployment endpoint");
    }
  };

  const removeDeployment = async (modelSlug: string) => {
    setPendingModelSlug(modelSlug);
    setError(null);

    try {
      const response = await fetch("/api/workspace/deployment", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelSlug,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to remove deployment");
      }

      setTestResults((current) => {
        const next = { ...current };
        delete next[modelSlug];
        return next;
      });
      setBudgetDrafts((current) => {
        const next = { ...current };
        delete next[modelSlug];
        return next;
      });
      await mutate();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove deployment");
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
            A deployment is a saved way to run a model on AI Market Cap with its own endpoint,
            budget, and usage history. Keep track of every model setup you created here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/deploy#deploy-directory">Browse launch directory</Link>
          </Button>
          <Button asChild className="bg-neon text-background hover:bg-neon/90">
            <Link href="/deploy">Start guided setup</Link>
          </Button>
        </div>
      </div>

      <Card className="mb-4 border-border/50 bg-card/70">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border/50 bg-background/30 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Total deployments
            </p>
            <p className="mt-1 text-xl font-semibold text-white">{deployments.length}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/30 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Ready now
            </p>
            <p className="mt-1 text-xl font-semibold text-white">{summary.ready}</p>
            <p className="mt-1 text-xs text-muted-foreground">{summary.paused} paused</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/30 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Needs attention
            </p>
            <p className="mt-1 text-xl font-semibold text-white">{summary.attention}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.provisioning} provisioning · {summary.paused} paused
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/30 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Estimated spend
            </p>
            <p className="mt-1 text-xl font-semibold text-white">${summary.totalSpend.toFixed(2)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Across all deployment requests</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4 border-cyan-500/30 bg-cyan-500/10">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/80">
              Operate in 3 steps
            </p>
            <h2 className="mt-1 text-base font-semibold text-white">
              Check the state, use the top actions, then open details only when needed.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className="bg-cyan-500/10 text-cyan-100">1. Check the state</Badge>
            <Badge className="bg-cyan-500/10 text-cyan-100">2. Use the top actions</Badge>
            <Badge className="bg-cyan-500/10 text-cyan-100">3. Open details only if needed</Badge>
            <Badge className="bg-emerald-500/10 text-emerald-200">Ready</Badge>
            <Badge className="bg-amber-500/10 text-amber-100">Paused</Badge>
            <Badge className="bg-cyan-500/10 text-cyan-100">Provisioning</Badge>
            <Badge className="bg-red-500/10 text-red-200">Needs repair</Badge>
          </div>
        </CardContent>
      </Card>

      {showActionQueue ? (
        <Card className="mb-6 border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-amber-200/80">
                Action queue
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                Review problem deployments first, then return to live traffic.
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-amber-50/80">
                {summary.attention > 0
                  ? `${summary.attention} deployment${summary.attention === 1 ? " needs" : "s need"} attention right now.`
                  : "No deployments are currently broken."} {summary.paused > 0
                  ? `${summary.paused} paused deployment${summary.paused === 1 ? " is" : "s are"} waiting to be resumed.`
                  : ""} {summary.provisioning > 0
                  ? `${summary.provisioning} deployment${summary.provisioning === 1 ? " is" : "s are"} still being prepared.`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.firstAttention ? (
                <Button asChild className="bg-amber-400 text-background hover:bg-amber-300">
                  <a href={`#deployment-${summary.firstAttention.modelSlug}`}>Review attention first</a>
                </Button>
              ) : null}
              {summary.firstPaused ? (
                <Button variant="outline" asChild>
                  <a href={`#deployment-${summary.firstPaused.modelSlug}`}>Resume paused deployment</a>
                </Button>
              ) : null}
              {summary.firstProvisioning ? (
                <Button variant="outline" asChild>
                  <a href={`#deployment-${summary.firstProvisioning.modelSlug}`}>Watch setup in progress</a>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {deployments.length > 0 ? (
        <Card className="mb-6 border-border/50 bg-card/70">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  View deployments
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Showing {filteredDeployments.length} of {deployments.length} deployment
                  {deployments.length === 1 ? "" : "s"}.
                </p>
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={deploymentQuery}
                  onChange={(event) => setDeploymentQuery(event.target.value)}
                  placeholder="Search by model, provider, or endpoint"
                  className="pl-9"
                  aria-label="Search deployments"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "all", label: "All" },
                { key: "attention", label: "Needs attention" },
                { key: "ready", label: "Ready" },
                { key: "paused", label: "Paused" },
                { key: "provisioning", label: "Provisioning" },
              ].map((item) => {
                const key = item.key as DeploymentViewFilter;
                return (
                  <Button
                    key={key}
                    type="button"
                    variant={viewFilter === key ? "default" : "outline"}
                    className={cn(
                      viewFilter === key
                        ? "bg-neon text-background hover:bg-neon/90"
                        : "border-border/50 bg-card/40"
                    )}
                    onClick={() => setViewFilter(key)}
                  >
                    {item.label}
                    <Badge
                      variant="outline"
                      className={cn(
                        "ml-2",
                        viewFilter === key
                          ? "border-background/20 bg-background/10 text-background"
                          : "border-border/50 bg-background/40"
                      )}
                    >
                      {filterCounts[key]}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

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
                Start with a guided setup for a model this site can run here, or browse the wider
                set of models with verified provider and self-host paths.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild className="bg-neon text-background hover:bg-neon/90">
                <Link href="/deploy">Start guided setup</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/models?deployable=true">Browse all deployable models</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : filteredDeployments.length === 0 ? (
        <Card className="border-border/50 bg-card/70">
          <CardContent className="space-y-4 p-8 text-center">
            <Server className="mx-auto h-10 w-10 text-neon" />
            <div>
              <h2 className="text-xl font-semibold text-white">No deployments match this view</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Try another status filter or clear the search text to bring deployments back into view.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                className="bg-neon text-background hover:bg-neon/90"
                onClick={() => {
                  setViewFilter("all");
                  setDeploymentQuery("");
                }}
              >
                Show all deployments
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredDeployments.map((deployment) => {
            const budgetStatusTone =
              deployment.billing.budgetStatus === "healthy"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                : deployment.billing.budgetStatus === "low"
                  ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                  : deployment.billing.budgetStatus === "exhausted"
                    ? "border-red-500/20 bg-red-500/10 text-red-300"
                    : "border-border/50 bg-card/40 text-muted-foreground";
            const nextStep = getDeploymentNextStep(deployment);
            const statePresentation = getDeploymentStatePresentation(deployment);

            return (
              <Card id={`deployment-${deployment.modelSlug}`} key={deployment.id} className="border-border/50 bg-card/70 scroll-mt-24">
                <CardContent className="space-y-5 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-neon/20 bg-neon/10 text-neon">
                          {deployment.deploymentLabel ?? "Managed deployment"}
                        </Badge>
                        <Badge variant="outline" className={statePresentation.className}>
                          {statePresentation.label}
                        </Badge>
                        <Badge variant="outline" className={cn("capitalize", budgetStatusTone)}>
                          {deployment.billing.budgetStatus}
                        </Badge>
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-white">{deployment.modelName}</h2>
                        <p className="text-sm text-muted-foreground">
                          {deployment.providerName ?? "Unknown provider"} ·{" "}
                          {deployment.deploymentKind === "hosted_external"
                            ? "AI Market Cap dedicated runtime"
                            : deployment.execution.summary}
                        </p>
                        {deployment.lastErrorMessage ? (
                          <p className="mt-2 text-sm text-red-300">{deployment.lastErrorMessage}</p>
                        ) : null}
                      </div>
                      <div className={cn("rounded-xl border px-3 py-3", nextStep.tone)}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Next step
                          </p>
                          <p className="text-sm font-medium text-white">{nextStep.title}</p>
                        </div>
                        {!showActionQueue ? (
                          <p className="mt-2 text-sm text-muted-foreground">{nextStep.detail}</p>
                        ) : null}
                      </div>
                      <div className="rounded-lg border border-border/50 bg-card/40 px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Endpoint
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              void copyEndpoint(deployment);
                            }}
                          >
                            {copiedEndpointSlug === deployment.modelSlug ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <code className="mt-2 block text-xs text-foreground">{deployment.endpointPath}</code>
                      </div>
                    </div>

                    <div className="space-y-3 lg:w-[22rem] lg:flex-none">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Primary actions
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <Button
                            type="button"
                            className="bg-cyan-500 text-background hover:bg-cyan-400 sm:col-span-2"
                            disabled={
                              testLoadingSlug === deployment.modelSlug ||
                              deployment.status !== "ready"
                            }
                            onClick={() => runTestCall(deployment)}
                          >
                            {testLoadingSlug === deployment.modelSlug ? "Testing..." : "Run Quick Test"}
                          </Button>
                          <Button variant="outline" asChild>
                            <a href={`#deployment-budget-${deployment.id}`}>Manage Budget</a>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              workspace.openWorkspace({
                                model: deployment.modelName,
                                modelSlug: deployment.modelSlug,
                                provider: deployment.providerName,
                                action: nextStep.workspaceAction,
                                nextUrl: `/models/${deployment.modelSlug}?tab=deploy#model-tabs`,
                                autoStartDeployment: false,
                                suggestedAmount:
                                  deployment.creditsBudget ?? deployment.monthlyPriceEstimate ?? null,
                              })
                            }
                          >
                            {nextStep.workspaceLabel}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Secondary actions
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button variant="outline" asChild>
                            <Link href={`/models/${deployment.modelSlug}`}>
                              Model Page
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
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
                          <ConfirmDialog
                            trigger={
                              <Button
                                type="button"
                                variant="outline"
                                className="border-red-500/20 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                                disabled={pendingModelSlug === deployment.modelSlug}
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </Button>
                            }
                            title={`Remove ${deployment.modelName}?`}
                            description="This removes the AI Market Cap deployment endpoint and its saved usage state. Hosted deployments will also be removed from the connected backend when possible."
                            confirmLabel="Remove deployment"
                            variant="destructive"
                            onConfirm={() => {
                              void removeDeployment(deployment.modelSlug);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {testResults[deployment.modelSlug]?.error ? (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-red-200/80">
                        Latest test response
                      </p>
                      <p className="mt-2 text-sm text-red-200">
                        {testResults[deployment.modelSlug]?.error}
                      </p>
                    </div>
                  ) : null}
                  {testResults[deployment.modelSlug]?.content ? (
                    <div className="rounded-lg border border-border/50 bg-background/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Latest test response
                      </p>
                      <p className="mt-2 text-sm text-white">
                        {testResults[deployment.modelSlug]?.content}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        AI Market Cap · {testResults[deployment.modelSlug]?.model ?? "Unknown model"}
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-border/50 bg-card/40 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Live snapshot
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                          <span className="rounded-full border border-border/50 bg-background/40 px-2.5 py-1 text-foreground">
                            Requests: {deployment.totalRequests}
                          </span>
                          <span className="rounded-full border border-border/50 bg-background/40 px-2.5 py-1 text-foreground">
                            Tokens: {deployment.totalTokens}
                          </span>
                          <span className="rounded-full border border-border/50 bg-background/40 px-2.5 py-1 text-foreground">
                            Budget left: {formatCurrency(deployment.billing.budgetRemaining)}
                          </span>
                          <span className="rounded-full border border-border/50 bg-background/40 px-2.5 py-1 text-foreground">
                            Avg latency:{" "}
                            {deployment.avgResponseLatencyMs != null
                              ? `${deployment.avgResponseLatencyMs}ms`
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                      <details className="rounded-lg border border-border/50 bg-background/40 p-3 lg:max-w-md">
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Performance details
                        </summary>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                              Per request
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {formatCurrency(deployment.billing.requestCharge)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                              Success rate
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {deployment.successRate != null ? `${deployment.successRate}%` : "N/A"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {deployment.successfulRequests} ok / {deployment.failedRequests} failed
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                              Last success
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {deployment.lastSuccessAt
                                ? new Date(deployment.lastSuccessAt).toLocaleString()
                                : "No successful request yet"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                              Last latency
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {deployment.lastResponseLatencyMs != null
                                ? `${deployment.lastResponseLatencyMs}ms`
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>

                  <details
                    id={`deployment-budget-${deployment.id}`}
                    className="rounded-xl border border-border/50 bg-card/40 p-4 scroll-mt-24"
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">Budget and billing controls</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Set or change the cap for this deployment without touching the runtime.
                          </p>
                        </div>
                        <Badge variant="outline" className={cn("capitalize", budgetStatusTone)}>
                          {deployment.billing.budgetStatus}
                        </Badge>
                      </div>
                    </summary>
                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
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
                  </details>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <details className="rounded-xl border border-border/50 bg-card/40 p-4">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-neon" />
                          <div>
                            <p className="text-sm font-medium text-white">API access details</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Open this only when you need the curl example, API key path, or docs.
                            </p>
                          </div>
                        </div>
                      </summary>
                      <p className="mt-3 text-sm text-muted-foreground">
                        Use an API key with `agent` scope for requests and `read` if you also want
                        to poll deployment status.
                      </p>
                      <code className="mt-3 block overflow-x-auto rounded-md border border-border/50 bg-background/60 px-3 py-2 text-xs text-foreground">
{`curl -X POST ${deployment.endpointPath} \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"Hello from AI Market Cap"}'`}
                      </code>
                      <div className="mt-3 flex flex-wrap gap-2">
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
                    </details>

                    <details className="rounded-xl border border-border/50 bg-card/40 p-4">
                      <summary className="cursor-pointer list-none">
                        <div>
                          <p className="text-sm font-medium text-white">Recent activity</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Open this when you want request history, charges, refunds, or recent failures.
                          </p>
                        </div>
                      </summary>
                      <div className="mt-3">
                        <DeploymentActivity deployment={deployment} />
                      </div>
                    </details>
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
