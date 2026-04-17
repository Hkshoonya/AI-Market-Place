"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  KeyRound,
  MessageSquare,
  Minimize2,
  Wallet,
} from "lucide-react";
import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { WorkspaceStartRecommendation } from "@/components/workspace/workspace-start-recommendation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWalletTopUpPackForAmount } from "@/lib/constants/wallet";
import { SWR_TIERS } from "@/lib/swr/config";
import { cn } from "@/lib/utils";
import { resolveWorkspaceRuntimeExecution } from "@/lib/workspace/runtime-execution";
import { WORKSPACE_DEPLOYMENT_STARTED_EVENT } from "@/lib/workspace/session";

interface WorkspaceWalletSnapshot {
  balance: number;
}

interface WorkspaceApiKeysSnapshot {
  keys: Array<{ id: string; is_active: boolean }>;
}

interface WorkspaceChatMessage {
  id: string;
  sender_type: "agent" | "user";
  content: string;
  metadata?: {
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    } | null;
  } | null;
  created_at: string;
}

interface WorkspaceChatSnapshot {
  messages: WorkspaceChatMessage[];
}

interface WorkspaceRuntimeSnapshot {
  runtime: {
    id: string;
    modelSlug: string;
    modelName: string;
    providerName: string | null;
    status: "draft" | "ready" | "paused";
    endpointSlug: string;
    endpointPath: string;
    assistantPath: string;
    totalRequests: number;
    totalTokens: number;
    lastUsedAt: string | null;
    updatedAt: string;
    execution: {
      available: boolean;
      mode: "native_model" | "assistant_only";
      provider: string | null;
      model: string | null;
      label: string;
      summary: string;
    };
  } | null;
}

interface DeploymentListSnapshot {
  deployments: Array<{
    id: string;
    modelSlug: string;
    modelName: string;
    status: "provisioning" | "ready" | "paused" | "failed";
  }>;
}

interface WorkspaceDeploymentSnapshot {
  deployment: {
    id: string;
    runtimeId: string | null;
    modelSlug: string;
    modelName: string;
    providerName: string | null;
    status: "provisioning" | "ready" | "paused" | "failed";
    endpointSlug: string;
    endpointPath: string;
    deploymentKind: "managed_api" | "assistant_only" | "hosted_external";
    deploymentLabel: string | null;
    target: {
      platformSlug: string;
      provider: string;
      owner: string | null;
      name: string | null;
      modelRef: string | null;
      webUrl: string | null;
    } | null;
    creditsBudget: number | null;
    monthlyPriceEstimate: number | null;
    totalRequests: number;
    totalTokens: number;
    lastUsedAt: string | null;
    updatedAt: string;
    execution: {
      available: boolean;
      mode: "native_model" | "assistant_only";
      provider: string | null;
      model: string | null;
      label: string;
      summary: string;
    };
    billing: {
      requestCharge: number;
      estimatedSpend: number;
      budgetRemaining: number | null;
      budgetStatus: "untracked" | "healthy" | "low" | "exhausted";
    };
  } | null;
  runtime: WorkspaceRuntimeSnapshot["runtime"];
  provisioning: {
    canCreate: boolean;
    deploymentKind: "managed_api" | "assistant_only" | "hosted_external";
    label: string;
    summary: string;
    target: {
      platformSlug: string;
      provider: string;
      owner: string | null;
      name: string | null;
      modelRef: string | null;
      webUrl: string | null;
    } | null;
  } | null;
}

type WorkspaceTab = "runtime" | "assistant" | "usage";

export default function WorkspaceContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const workspace = useWorkspace();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("runtime");
  const [noteDraft, setNoteDraft] = useState("");
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [runtimeDraft, setRuntimeDraft] = useState("");
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [workflowGuideCollapsed, setWorkflowGuideCollapsed] = useState(false);
  const [runtimeResponse, setRuntimeResponse] = useState<{
    content: string;
    provider: string;
    model: string;
    usage: { totalTokens: number | null } | null;
  } | null>(null);

  const jumpToWorkspaceSection = (tab: WorkspaceTab, sectionId?: string) => {
    setActiveTab(tab);
    if (!sectionId) {
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [loading, pathname, router, user]);

  const { data: deploymentsSnapshot } = useSWR<DeploymentListSnapshot>(
    user ? "/api/workspace/deployments" : null,
    { ...SWR_TIERS.MEDIUM }
  );
  const { data: walletSnapshot } = useSWR<WorkspaceWalletSnapshot>(
    user && workspace.session ? "/api/marketplace/wallet?limit=1" : null,
    { ...SWR_TIERS.MEDIUM }
  );
  const { data: apiKeysSnapshot } = useSWR<WorkspaceApiKeysSnapshot>(
    user && workspace.session ? "/api/api-keys" : null,
    { ...SWR_TIERS.SLOW }
  );
  const { data: chatSnapshot, mutate: mutateChatSnapshot } = useSWR<WorkspaceChatSnapshot>(
    user && workspace.session?.conversationId
      ? `/api/workspace/chat?conversation_id=${encodeURIComponent(workspace.session.conversationId)}`
      : null,
    { ...SWR_TIERS.MEDIUM }
  );
  const { data: runtimeSnapshot, mutate: mutateRuntimeSnapshot } = useSWR<WorkspaceRuntimeSnapshot>(
    user && workspace.session?.modelSlug
      ? `/api/workspace/runtime?modelSlug=${encodeURIComponent(workspace.session.modelSlug)}`
      : null,
    { ...SWR_TIERS.MEDIUM }
  );
  const { data: deploymentSnapshot, mutate: mutateDeploymentSnapshot } =
    useSWR<WorkspaceDeploymentSnapshot>(
      user && workspace.session?.modelSlug
        ? `/api/workspace/deployment?modelSlug=${encodeURIComponent(workspace.session.modelSlug)}`
        : null,
      { ...SWR_TIERS.MEDIUM }
    );
  const session = workspace.session;
  const savedDeployments = deploymentsSnapshot?.deployments ?? [];
  const savedDeploymentCount = savedDeployments.length;
  const hasSavedDeployments = savedDeploymentCount > 0;
  const readyDeploymentCount = savedDeployments.filter((item) => item.status === "ready").length;
  const pausedDeploymentCount = savedDeployments.filter((item) => item.status === "paused").length;
  const attentionDeploymentCount = savedDeployments.filter((item) => item.status === "failed").length;
  const provisioningDeploymentCount = savedDeployments.filter(
    (item) => item.status === "provisioning"
  ).length;
  const currentSavedDeployment = session?.modelSlug
    ? savedDeployments.find((item) => item.modelSlug === session.modelSlug) ?? null
    : null;
  const otherDeploymentCount = currentSavedDeployment
    ? Math.max(savedDeploymentCount - 1, 0)
    : savedDeploymentCount;
  const showProviderLabel = Boolean(session?.provider && !session.provider.includes("AI Market Cap"));
  const runtime = deploymentSnapshot?.runtime ?? runtimeSnapshot?.runtime ?? null;
  const deployment = deploymentSnapshot?.deployment ?? null;
  const provisioning = deploymentSnapshot?.provisioning ?? null;
  const deploymentExecution = workspace.session?.modelSlug
    ? resolveWorkspaceRuntimeExecution(workspace.session.modelSlug)
    : null;
  const canCreateManagedDeployment = Boolean(provisioning?.canCreate);
  const hasManagedDeployment = Boolean(deployment);
  const deploymentModeLabel = deployment?.deploymentLabel ?? provisioning?.label ?? "Deployment";
  const deploymentId = deployment?.id ?? null;
  const deploymentCreditsBudget = deployment?.creditsBudget ?? null;
  const isDeploymentPaused = deployment?.status === "paused";
  const budgetStatusTone =
    deployment?.billing.budgetStatus === "healthy"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : deployment?.billing.budgetStatus === "low"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
        : deployment?.billing.budgetStatus === "exhausted"
          ? "border-red-500/20 bg-red-500/10 text-red-300"
          : "border-border/50 bg-card/40";

  const updateSuggestedAmount = (nextAmount: number | null) => {
    const nextPack = getWalletTopUpPackForAmount(nextAmount);
    workspace.updateWorkspaceSession({
      suggestedAmount: nextAmount,
      suggestedPackSlug: nextPack?.slug ?? null,
      suggestedPack: nextPack?.label ?? null,
    });
  };

  useEffect(() => {
    if (!session || !runtime?.id) return;
    if (session.runtimeId === runtime.id && session.runtimeEndpointPath === runtime.endpointPath) {
      return;
    }
    workspace.updateWorkspaceSession({
      runtimeId: runtime.id,
      runtimeEndpointPath: runtime.endpointPath,
    });
  }, [runtime?.endpointPath, runtime?.id, session, workspace]);

  useEffect(() => {
    if (!session || !deployment?.id) return;
    if (
      session.deploymentId === deployment.id &&
      session.deploymentEndpointPath === deployment.endpointPath
    ) {
      return;
    }
    workspace.updateWorkspaceSession({
      deploymentId: deployment.id,
      deploymentEndpointPath: deployment.endpointPath,
    });
  }, [deployment?.endpointPath, deployment?.id, session, workspace]);

  useEffect(() => {
    if (!user || !workspace.session?.modelSlug) {
      return;
    }

    const handleDeploymentStarted = (event: Event) => {
      const detail = (event as CustomEvent<{ modelSlug?: string | null }>).detail;
      if (detail?.modelSlug !== workspace.session?.modelSlug) {
        return;
      }

      void Promise.all([mutateDeploymentSnapshot(), mutateRuntimeSnapshot()]);
    };

    window.addEventListener(WORKSPACE_DEPLOYMENT_STARTED_EVENT, handleDeploymentStarted);
    return () => {
      window.removeEventListener(WORKSPACE_DEPLOYMENT_STARTED_EVENT, handleDeploymentStarted);
    };
  }, [
    mutateDeploymentSnapshot,
    mutateRuntimeSnapshot,
    user,
    workspace.session?.modelSlug,
  ]);

  useEffect(() => {
    if (!deploymentId) {
      setBudgetDraft("");
      return;
    }
    setBudgetDraft(deploymentCreditsBudget != null ? String(deploymentCreditsBudget) : "");
  }, [deploymentCreditsBudget, deploymentId]);

  useEffect(() => {
    if (hasManagedDeployment) {
      setWorkflowGuideCollapsed(true);
    }
  }, [hasManagedDeployment]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-56 rounded bg-secondary" />
          <div className="h-48 rounded-2xl bg-secondary" />
          <div className="h-80 rounded-2xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (!session) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Card className="border-border/50 bg-card">
          <CardContent className="space-y-4 p-8 text-center">
            <Badge variant="outline" className="border-neon/20 bg-neon/10 text-neon">
              Workspace
            </Badge>
            <h1 className="text-2xl font-semibold text-white">
              {hasSavedDeployments ? "You already have saved deployments" : "No active workspace yet"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {hasSavedDeployments
                ? `You already have ${savedDeploymentCount} managed deployment${savedDeploymentCount === 1 ? "" : "s"} attached to your account. Open deployments to run a quick test, resume paused traffic, or jump back into a specific model workflow.`
                : "Start with a model this site can run here, or browse the wider set of models with verified provider and self-host paths. Once you start, your workspace stays attached to your account."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasSavedDeployments ? (
                <Button asChild className="bg-neon text-background hover:bg-neon/90">
                  <Link href="/deployments">Go to Deployments</Link>
                </Button>
              ) : (
                <Button asChild className="bg-neon text-background hover:bg-neon/90">
                  <Link href="/deploy">Start guided setup</Link>
                </Button>
              )}
              {hasSavedDeployments ? (
                <Button variant="outline" asChild>
                  <Link href="/deploy">Start another guided setup</Link>
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/deployments">View Deployments</Link>
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link href="/models?deployable=true">Browse deployable models</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/marketplace">Open Marketplace</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const params = new URLSearchParams({
    intent: "deploy",
    model: session.model ?? "",
    modelSlug: session.modelSlug ?? "",
    action: session.action ?? "",
    next: session.nextUrl ?? "",
  });
  if (session.provider) params.set("provider", session.provider);
  if (session.suggestedAmount) params.set("amount", String(session.suggestedAmount));
  if (session.suggestedPackSlug) params.set("pack", session.suggestedPackSlug);
  if (session.suggestedPack) params.set("packLabel", session.suggestedPack);
  if (session.sponsored) params.set("sponsored", "1");

  const walletHref = `/wallet?${params.toString()}#deposit-addresses`;
  const apiHref = `/settings/api-keys?${params.toString()}`;
  const isSponsoredSession = session.sponsored === true;
  const events = session.events;
  const activeApiKeys = (apiKeysSnapshot?.keys ?? []).filter((key) => key.is_active).length;
  const chatMessages = chatSnapshot?.messages ?? [];
  const assistantUsage = chatMessages.reduce(
    (acc, message) => {
      const usage = message.metadata?.usage;
      if (message.sender_type === "agent") acc.turns += 1;
      acc.totalTokens += usage?.totalTokens ?? 0;
      return acc;
    },
    { turns: 0, totalTokens: 0 }
  );
  const stepItems = [
    {
      label: "Fund credits",
      done: events.some((event) => /wallet|deposit/i.test(`${event.title} ${event.detail}`)),
      detail: session.suggestedPack
        ? `Use ${session.suggestedPack} if this path still needs balance.`
        : "Top up the wallet only if this access path is paid.",
      ctaLabel: "Open wallet",
      href: walletHref,
      external: false,
    },
    {
      label: "Prepare API access",
      done: events.some((event) => /api/i.test(`${event.title} ${event.detail}`)),
      detail: "Create account-side API keys and keep them attached to the same workspace.",
      ctaLabel: "Open API keys",
      href: apiHref,
      external: false,
    },
    {
      label: canCreateManagedDeployment ? "Start on this site" : "Use provider path",
      done: canCreateManagedDeployment ? hasManagedDeployment : false,
      detail: canCreateManagedDeployment
        ? hasManagedDeployment
          ? "Your saved in-site setup is ready. Keep using the site endpoint below for chat and API requests."
          : "Create one saved site setup so budget, usage, and requests stay attached to this workspace."
        : provisioning?.summary ??
          "This model still needs its verified provider/runtime path instead of a direct in-site launch.",
      ctaLabel: canCreateManagedDeployment
        ? hasManagedDeployment
          ? "Refresh site setup"
          : "Create site setup"
        : session.nextUrl
          ? "Open provider"
          : undefined,
      href: canCreateManagedDeployment ? undefined : session.nextUrl ?? undefined,
      external: !canCreateManagedDeployment,
      onClick: canCreateManagedDeployment ? createDeployment : undefined,
    },
  ];
  const nextStepIndex = stepItems.findIndex((item) => !item.done);

  const saveNote = () => {
    const trimmed = noteDraft.trim();
    if (!trimmed) return;
    workspace.addWorkspaceEvent("Session note", trimmed, "user");
    setNoteDraft("");
  };

  const askAssistant = async () => {
    const trimmed = assistantDraft.trim();
    if (!trimmed || assistantLoading) return;

    workspace.addWorkspaceEvent("Workspace question", trimmed, "user");
    setAssistantLoading(true);
    setAssistantError(null);
    setAssistantDraft("");

    try {
      const response = await fetch("/api/workspace/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          conversation_id: session.conversationId ?? undefined,
          runtime_id: session.runtimeId ?? undefined,
          topic: session.model ? `Deploy workspace for ${session.model}` : "Deploy workspace",
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to contact workspace assistant");
      }

      if (payload.conversation_id) {
        workspace.updateWorkspaceSession({
          conversationId: payload.conversation_id,
        });
      }

      if (payload.response?.content) {
        workspace.addWorkspaceEvent("Assistant reply", payload.response.content, "system");
      }

      await mutateChatSnapshot();
    } catch (error) {
      setAssistantError(
        error instanceof Error ? error.message : "Failed to contact workspace assistant"
      );
      workspace.addWorkspaceEvent(
        "Assistant unavailable",
        "The in-site workspace assistant could not answer right now."
      );
    } finally {
      setAssistantLoading(false);
    }
  };

  const activateRuntime = async () => {
    if (!session.modelSlug || !session.model) return;
    setRuntimeLoading(true);
    setRuntimeError(null);

    try {
      const response = await fetch("/api/workspace/runtime", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelSlug: session.modelSlug,
          modelName: session.model,
          providerName: session.provider,
          conversationId: session.conversationId,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to prepare runtime");
      }

      workspace.addWorkspaceEvent(
        "Runtime prepared",
        session.model
          ? `Prepared a stable in-site runtime record for ${session.model}.`
          : "Prepared a stable in-site runtime record."
      );
      if (payload.runtime?.id) {
        workspace.updateWorkspaceSession({
          runtimeId: payload.runtime.id,
          runtimeEndpointPath: payload.runtime.endpointPath ?? null,
        });
      }
      await mutateRuntimeSnapshot();
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "Failed to prepare runtime");
    } finally {
      setRuntimeLoading(false);
    }
  };

  async function createDeployment() {
    const activeSession = session;
    if (!activeSession || !activeSession.modelSlug || !activeSession.model) return;
    if (!canCreateManagedDeployment) {
      setRuntimeError(
        provisioning?.summary ??
          "A one-click deployment is not available for this model yet. Use the verified provider path instead."
      );
      return;
    }
    setRuntimeLoading(true);
    setRuntimeError(null);

    try {
      const response = await fetch("/api/workspace/deployment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelSlug: activeSession.modelSlug,
          modelName: activeSession.model,
          providerName: activeSession.provider,
          conversationId: activeSession.conversationId,
          creditsBudget: activeSession.suggestedAmount,
          monthlyPriceEstimate: activeSession.suggestedAmount,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create deployment");
      }

      workspace.addWorkspaceEvent(
        "Deployment created",
        payload.activation?.message ??
          (activeSession.model
            ? `Created a deployment for ${activeSession.model}.`
            : "Created a deployment.")
      );

      workspace.updateWorkspaceSession({
        runtimeId: payload.runtime?.id ?? null,
        runtimeEndpointPath: payload.runtime?.endpointPath ?? null,
        deploymentId: payload.deployment?.id ?? null,
        deploymentEndpointPath: payload.deployment?.endpointPath ?? null,
      });

      await Promise.all([mutateRuntimeSnapshot(), mutateDeploymentSnapshot()]);
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "Failed to create deployment");
    } finally {
      setRuntimeLoading(false);
    }
  }

  const updateDeployment = async (input: {
    action: "pause" | "resume" | "set_budget";
    creditsBudget?: number | null;
  }) => {
    if (!session.modelSlug || runtimeLoading) return;
    setRuntimeLoading(true);
    setRuntimeError(null);

    try {
      const response = await fetch("/api/workspace/deployment", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelSlug: session.modelSlug,
          action: input.action,
          creditsBudget: input.creditsBudget,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update deployment");
      }

      workspace.addWorkspaceEvent("Deployment updated", payload.update?.message ?? "Deployment updated.");
      await mutateDeploymentSnapshot();
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "Failed to update deployment");
    } finally {
      setRuntimeLoading(false);
    }
  };

  const runSelectedModel = async () => {
    const trimmed = runtimeDraft.trim();
    if (!deployment?.endpointPath || !trimmed || runtimeLoading) return;

    workspace.addWorkspaceEvent("Runtime prompt", trimmed, "user");
    setRuntimeLoading(true);
    setRuntimeError(null);
    setRuntimeDraft("");

    try {
      const response = await fetch(deployment.endpointPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to run selected model");
      }

      if (payload.response?.content) {
        workspace.addWorkspaceEvent(
          session.model ? `${session.model} response` : "Model response",
          payload.response.content,
          "system"
        );
      }

      setRuntimeResponse(payload.response ?? null);
      await Promise.all([mutateRuntimeSnapshot(), mutateDeploymentSnapshot()]);
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "Failed to run selected model");
    } finally {
      setRuntimeLoading(false);
    }
  };

  const workflowGuideCard = (
    <Card id="workspace-workflow-guide" className="border-border/50 bg-card/60">
      <CardContent className="p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Workflow Guide
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Setup is where you take action. Assistant is where you ask questions. Usage is where you confirm spend and activity.
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Green means already done. Blue means do this now. Amber means the next step happens on an external provider path.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setWorkflowGuideCollapsed((current) => !current)}
          >
            {workflowGuideCollapsed ? (
              <>
                <ChevronDown className="h-4 w-4" />
                Show workflow guide
              </>
            ) : (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide workflow guide
              </>
            )}
          </Button>
        </div>
        {!workflowGuideCollapsed ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge className="bg-cyan-500/10 text-cyan-100">Do now</Badge>
            <Badge className="bg-emerald-500/10 text-emerald-200">Done</Badge>
            <Badge className="bg-amber-500/10 text-amber-100">Provider step</Badge>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  const quickTestCard = (
    <Card id="workspace-quick-test" className="border-border/50 bg-card/60">
      <CardContent className="p-5">
        {hasManagedDeployment ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-neon" />
              <h2 className="text-lg font-semibold text-white">Run selected model</h2>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Send a real prompt through the prepared in-site runtime for this selected model.
            </p>
            {isDeploymentPaused ? (
              <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/80">
                This deployment is paused. Resume it before sending more model requests.
              </div>
            ) : null}
            <textarea
              value={runtimeDraft}
              onChange={(event) => setRuntimeDraft(event.target.value)}
              rows={4}
              placeholder={`Example: Give me a short overview of ${session.model ?? "this model"}.`}
              className="w-full resize-none rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-neon/30"
            />
            {runtimeError ? <p className="mt-3 text-xs text-red-400">{runtimeError}</p> : null}
            <div className="mt-3 flex justify-end">
              <Button
                variant="outline"
                disabled={runtimeDraft.trim().length === 0 || runtimeLoading || isDeploymentPaused}
                onClick={runSelectedModel}
              >
                {runtimeLoading ? "Running..." : isDeploymentPaused ? "Deployment Paused" : "Run Model"}
              </Button>
            </div>
            {runtimeResponse ? (
              <div className="mt-4 rounded-lg border border-border/40 bg-card/30 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">
                    {session.model ?? "Model"} response
                  </p>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    AI Market Cap · {runtimeResponse.model}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {runtimeResponse.content}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-lg border border-border/40 bg-card/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-neon" />
              <h2 className="text-lg font-semibold text-white">
                {canCreateManagedDeployment
                  ? provisioning?.deploymentKind === "hosted_external"
                    ? "Create a hosted deployment to run this model here"
                    : "Create a deployment to run this model here"
                  : "Model runtime not mapped yet"}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {hasManagedDeployment
                ? deployment?.deploymentKind === "hosted_external"
                  ? "This model is routed through a hosted deployment target and remains usable from AI Market Cap."
                  : deployment?.execution.summary
                : canCreateManagedDeployment
                  ? provisioning?.summary ??
                    "This model supports a managed deployment path, but you need to create the deployment first."
                  : deploymentExecution?.summary ??
                    "This workspace is still using the assistant/setup path until a direct in-site runtime route is mapped for the selected model."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-neon/20 bg-neon/10 text-neon">
              In-site Workspace
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "border-border/50 bg-card/40",
                workspace.persistenceStatus === "saved" &&
                  "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
                workspace.persistenceStatus === "saving" &&
                  "border-amber-500/20 bg-amber-500/10 text-amber-200",
                workspace.persistenceStatus === "error" &&
                  "border-red-500/20 bg-red-500/10 text-red-300"
              )}
            >
              {workspace.persistenceStatus === "saved"
                ? "Saved to account"
                : workspace.persistenceStatus === "saving"
                  ? "Saving"
                  : workspace.persistenceStatus === "loading"
                    ? "Loading saved session"
                    : "Browser only"}
            </Badge>
            {session.suggestedPack ? (
              <Badge variant="outline" className="border-border/50 bg-card/40">
                {session.suggestedPack}
              </Badge>
            ) : null}
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-white">
              {session.model ? `${session.model} workspace` : "Model workspace"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Stay inside AI Market Cap while you fund, prepare access, chat through the setup,
              and keep a usable history of what happened for this model.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Chat UI", "API access", "Usage tracking"].map((item) => (
              <Badge key={item} variant="outline" className="border-neon/20 bg-neon/10 text-neon">
                {item}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/deployments">Deployments</Link>
          </Button>
          <Button variant="outline" onClick={workspace.minimizeWorkspace}>
            <Minimize2 className="h-4 w-4" />
            Hide Floating Console
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              workspace.maximizeWorkspace();
              workspace.setActivePanel("setup");
            }}
          >
            Open Floating Console
          </Button>
          {session.modelSlug ? (
            <Button variant="outline" asChild>
              <Link href={`/models/${session.modelSlug}?tab=deploy#model-tabs`}>Back to Model</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Wallet</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {typeof walletSnapshot?.balance === "number" ? `$${walletSnapshot.balance.toFixed(2)}` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">API Keys</p>
            <p className="mt-1 text-xl font-semibold text-white">{activeApiKeys}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Assistant Turns</p>
            <p className="mt-1 text-xl font-semibold text-white">{assistantUsage.turns}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Tracked Tokens</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {runtime?.totalTokens ?? assistantUsage.totalTokens}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Deployment Requests</p>
              <p className="mt-1 text-xl font-semibold text-white">{deployment?.totalRequests ?? runtime?.totalRequests ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {hasSavedDeployments ? (
        <Card className="mt-6 border-cyan-500/30 bg-cyan-500/10">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/80">
                Deployment portfolio
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                This workspace is part of your broader deployment account.
              </p>
              <p className="mt-2 max-w-3xl text-sm text-cyan-50/80">
                {currentSavedDeployment
                  ? `${session.model ?? currentSavedDeployment.modelName} already has a saved deployment with status ${currentSavedDeployment.status}. Use Deployments to run a quick test, resume traffic, or switch to another model workflow.`
                  : `You already have ${savedDeploymentCount} saved deployment${savedDeploymentCount === 1 ? "" : "s"} on this account. Use Deployments to run quick tests, pause traffic, adjust budgets, or jump into another model workflow.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="bg-emerald-500/10 text-emerald-200">
                  {readyDeploymentCount} ready
                </Badge>
                <Badge className="bg-amber-500/10 text-amber-100">
                  {pausedDeploymentCount} paused
                </Badge>
                <Badge className="bg-red-500/10 text-red-200">
                  {attentionDeploymentCount} need attention
                </Badge>
                {provisioningDeploymentCount > 0 ? (
                  <Badge className="bg-cyan-500/10 text-cyan-100">
                    {provisioningDeploymentCount} provisioning
                  </Badge>
                ) : null}
                {otherDeploymentCount > 0 ? (
                  <Badge variant="outline" className="border-cyan-300/20 bg-card/40 text-cyan-50">
                    {otherDeploymentCount} other workflow{otherDeploymentCount === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="bg-neon text-background hover:bg-neon/90">
                <Link href="/deployments">Go to Deployments</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/deploy">Start another guided setup</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6 border-border/50 bg-card/60">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Workspace navigator
              </p>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Jump straight to setup, assistant, or usage instead of scanning the full page.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-border/50 bg-card/40">
                {activeTab === "runtime" ? "Setup view" : activeTab === "assistant" ? "Assistant view" : "Usage view"}
              </Badge>
              <Button type="button" variant="outline" onClick={workspace.minimizeWorkspace}>
                <Minimize2 className="h-4 w-4" />
                Minimize Floating Console
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => jumpToWorkspaceSection("runtime", "workspace-workflow-guide")}>
              Workflow guide
            </Button>
            {hasManagedDeployment ? (
              <Button type="button" variant="outline" onClick={() => jumpToWorkspaceSection("runtime", "workspace-live-controls")}>
                Live controls
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => jumpToWorkspaceSection("runtime", "workspace-runtime-record")}>
              Runtime record
            </Button>
            {hasManagedDeployment ? (
              <Button type="button" variant="outline" onClick={() => jumpToWorkspaceSection("runtime", "workspace-budget-billing")}>
                Budget
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => jumpToWorkspaceSection("runtime", "workspace-quick-test")}>
              Quick test
            </Button>
            <Button type="button" variant="outline" onClick={() => jumpToWorkspaceSection("assistant", "workspace-assistant")}>
              Open assistant view
            </Button>
            <Button type="button" variant="outline" onClick={() => jumpToWorkspaceSection("usage", "workspace-usage-history")}>
              Open usage history
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkspaceTab)} className="mt-6">
        <TabsList variant="line" className="w-full rounded-xl border border-border/50 bg-card/40 p-1">
          <TabsTrigger
            value="runtime"
            className="rounded-lg data-[state=active]:border-cyan-500/30 data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-100"
          >
            <span className="flex flex-col items-start leading-tight">
              <span>Setup</span>
              <span className="text-[10px] text-muted-foreground">Fund, connect, launch</span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="assistant"
            className="rounded-lg data-[state=active]:border-neon/30 data-[state=active]:bg-neon/10 data-[state=active]:text-neon"
          >
            <span className="flex flex-col items-start leading-tight">
              <span>Assistant</span>
              <span className="text-[10px] text-muted-foreground">Ask what to do next</span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="usage"
            className="rounded-lg data-[state=active]:border-emerald-500/30 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-200"
          >
            <span className="flex flex-col items-start leading-tight">
              <span>Usage</span>
              <span className="text-[10px] text-muted-foreground">Spend, tokens, requests</span>
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent forceMount value="runtime" className="mt-6 space-y-6">
          {!hasManagedDeployment ? workflowGuideCard : null}

          {hasManagedDeployment ? (
            <Card id="workspace-live-controls" className="border-cyan-500/30 bg-cyan-500/10">
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/80">
                      Live deployment controls
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-white">
                      Endpoint, quick test, budget, and traffic controls are active.
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm text-cyan-50/80">
                      Use these direct actions first when this workspace is already live. You do not need to scroll through the full setup flow every time.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-emerald-500/10 text-emerald-200">{deployment?.status}</Badge>
                    <Badge variant="outline" className="border-cyan-300/20 bg-card/40 text-cyan-50">
                      {deploymentModeLabel}
                    </Badge>
                    <Badge variant="outline" className={budgetStatusTone}>
                      {deployment?.billing.budgetRemaining != null
                        ? `$${deployment.billing.budgetRemaining.toFixed(2)} left`
                        : "No budget cap"}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-md border border-cyan-300/20 bg-background/50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Live endpoint
                  </p>
                  <code className="mt-1 block text-xs text-foreground">{deployment?.endpointPath}</code>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="bg-neon text-background hover:bg-neon/90">
                    <a href="#workspace-quick-test">Run quick test</a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="#workspace-budget-billing">Manage budget</a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => updateDeployment({ action: isDeploymentPaused ? "resume" : "pause" })}
                    disabled={runtimeLoading}
                  >
                    {runtimeLoading
                      ? "Updating..."
                      : isDeploymentPaused
                        ? "Resume deployment now"
                        : "Pause deployment now"}
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/deployments">Open deployments</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {hasManagedDeployment ? quickTestCard : null}

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="order-2 border-border/50 bg-card/60 lg:order-1">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Actionable workflow</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Each step opens the exact action you need next.
                    </p>
                  </div>
                  <Badge variant="outline" className="border-border/50 bg-card/40">
                    {stepItems.filter((item) => item.done).length}/{stepItems.length} complete
                  </Badge>
                </div>
                <div className="space-y-3">
                  {stepItems.map((item, index) => {
                    const isCurrent = !item.done && nextStepIndex === index;
                    const isProviderStep = Boolean(item.external && !item.done);
                    const toneClass = item.done
                      ? "border-emerald-500/20 bg-emerald-500/10"
                      : isProviderStep
                        ? "border-amber-500/30 bg-amber-500/10"
                        : isCurrent
                          ? "border-cyan-500/30 bg-cyan-500/10"
                          : "border-border/40 bg-card/30";
                    const badgeClass = item.done
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      : isProviderStep
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-100"
                        : isCurrent
                          ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-100"
                          : "border-border/50 bg-card/40 text-muted-foreground";
                    const actionClassName = cn(
                      "w-full justify-between",
                      item.done
                        ? "border-border/50 bg-card/30 text-muted-foreground"
                        : isProviderStep
                          ? "border-amber-500/30 bg-amber-500/15 text-amber-50 hover:bg-amber-500/20"
                          : isCurrent
                            ? "bg-cyan-500 text-background hover:bg-cyan-400"
                            : "border-border/50 bg-card/30"
                    );

                    return (
                      <div key={item.label} className={cn("rounded-xl border px-4 py-4", toneClass)}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                              Step {index + 1}
                            </p>
                            <p className="text-sm font-medium text-white">{item.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.done ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : null}
                            <Badge variant="outline" className={badgeClass}>
                              {item.done
                                ? "Done"
                                : isProviderStep
                                  ? "Provider step"
                                  : isCurrent
                                    ? "Do now"
                                    : "Later"}
                            </Badge>
                          </div>
                        </div>
                        {item.href ? (
                          <div className="mt-3">
                            {item.external ? (
                              <Button type="button" asChild variant="outline" className={actionClassName}>
                                <a
                                  href={item.href}
                                  target="_blank"
                                  rel={
                                    isSponsoredSession
                                      ? "noopener noreferrer sponsored nofollow"
                                      : "noopener noreferrer"
                                  }
                                >
                                  <ArrowUpRight className="h-4 w-4" />
                                  {item.ctaLabel}
                                </a>
                              </Button>
                            ) : (
                              <Button type="button" asChild variant="outline" className={actionClassName}>
                                <Link href={item.href}>{item.ctaLabel}</Link>
                              </Button>
                            )}
                          </div>
                        ) : item.onClick && item.ctaLabel ? (
                          <div className="mt-3">
                            <Button
                              type="button"
                              variant={isCurrent ? "default" : "outline"}
                              className={actionClassName}
                              onClick={item.onClick}
                              disabled={runtimeLoading}
                            >
                              {runtimeLoading && isCurrent ? "Working..." : item.ctaLabel}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="order-1 border-border/50 bg-card/60 lg:order-2">
              <CardContent className="space-y-4 p-5">
                {hasManagedDeployment ? (
                  <div className="rounded-lg border border-border/40 bg-background/40 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Live operations
                        </p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          Use this workspace as the control surface for the live deployment.
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Runtime status, budget, testing, and API access are all attached to this saved deployment.
                        </p>
                      </div>
                      <Badge variant="outline" className="border-border/50 bg-card/40">
                        {deploymentModeLabel}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-md border border-border/40 bg-card/30 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Requests
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">
                          {deployment?.totalRequests ?? runtime?.totalRequests ?? 0}
                        </p>
                      </div>
                      <div className="rounded-md border border-border/40 bg-card/30 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Tokens
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">
                          {deployment?.totalTokens ?? runtime?.totalTokens ?? 0}
                        </p>
                      </div>
                      <div className="rounded-md border border-border/40 bg-card/30 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Budget left
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">
                          {deployment?.billing.budgetRemaining != null
                            ? `$${deployment.billing.budgetRemaining.toFixed(2)}`
                            : "Not tracked"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Best path right now
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {session.action ?? "Continue setup"}
                      </p>
                      {showProviderLabel ? (
                        <p className="text-sm text-muted-foreground">via {session.provider}</p>
                      ) : null}
                    </div>

                    <WorkspaceStartRecommendation
                      action={session.action}
                      provider={session.provider}
                      suggestedAmount={session.suggestedAmount}
                      suggestedPack={session.suggestedPack}
                      suggestedPackSlug={session.suggestedPackSlug}
                      onSuggestedAmountChange={updateSuggestedAmount}
                    />
                  </>
                )}

                <div id="workspace-runtime-record" className="rounded-lg border border-border/40 bg-card/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Runtime record
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        {hasManagedDeployment
                          ? deployment?.deploymentKind === "hosted_external"
                            ? "Dedicated runtime connected"
                            : "Runtime created inside AI Market Cap"
                          : canCreateManagedDeployment
                            ? "Not deployed yet"
                            : "Direct deployment not available"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {hasManagedDeployment
                          ? deployment?.deploymentKind === "hosted_external"
                            ? "AI Market Cap is routing this deployment through a dedicated runtime while keeping the endpoint, usage, and workflow in one place."
                            : "This deployment runs directly on AI Market Cap, with usage and access attached to the same record."
                          : canCreateManagedDeployment
                            ? provisioning?.summary ?? "Create the in-site deployment before deeper chat and API usage starts here."
                            : provisioning?.summary ??
                              "This model does not have a mapped in-site runtime yet, so keep using the verified provider path for real usage."}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        hasManagedDeployment
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                          : "border-border/50 bg-card/40"
                      )}
                    >
                      {hasManagedDeployment ? deployment?.status : canCreateManagedDeployment ? "draft" : "external"}
                    </Badge>
                  </div>
                  {hasManagedDeployment ? (
                    <div className="mt-3 rounded-md border border-border/40 bg-background/50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Deployment mode
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        {deploymentModeLabel}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {deployment?.deploymentKind === "hosted_external"
                          ? "This endpoint is routed through a dedicated runtime and can still be used entirely from AI Market Cap."
                          : deployment?.execution.summary}
                      </p>
                    </div>
                  ) : null}
                  {!canCreateManagedDeployment && (provisioning || deploymentExecution) ? (
                    <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-amber-300">
                        Why deployment is hidden
                      </p>
                      <p className="mt-1 text-xs text-amber-100/80">
                        {provisioning?.summary ?? deploymentExecution?.summary}
                      </p>
                    </div>
                  ) : null}
                  {deployment?.deploymentKind === "hosted_external" ? (
                    <div className="mt-3 rounded-md border border-border/40 bg-background/50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Hosted connection
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        AI Market Cap is managing the connected runtime for this deployment. You
                        keep using the AI Market Cap endpoint below for chat and API access.
                      </p>
                    </div>
                  ) : null}
                  {(hasManagedDeployment || runtime) ? (
                    <details className="mt-3 rounded-md border border-border/40 bg-background/50 px-3 py-3">
                      <summary className="cursor-pointer list-none text-sm font-medium text-white">
                        Technical details
                      </summary>
                      {hasManagedDeployment ? (
                        <div className="mt-3 rounded-md border border-border/40 bg-card/30 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Deployment status endpoint
                          </p>
                          <code className="mt-1 block text-xs text-foreground">{deployment?.endpointPath}</code>
                        </div>
                      ) : null}
                      {runtime ? (
                        <div className="mt-3 rounded-md border border-border/40 bg-card/30 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Runtime record endpoint
                          </p>
                          <code className="mt-1 block text-xs text-foreground">{runtime.endpointPath}</code>
                        </div>
                      ) : null}
                      {runtime ? (
                        <div className="mt-3 rounded-md border border-border/40 bg-card/30 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Assistant API endpoint
                          </p>
                          <code className="mt-1 block text-xs text-foreground">{runtime.assistantPath}</code>
                        </div>
                      ) : null}
                      {hasManagedDeployment ? (
                        <div className="mt-3 rounded-md border border-border/40 bg-card/30 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Example request
                          </p>
                          <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-foreground">
{`curl -X POST ${deployment?.endpointPath} \\
  -H "Authorization: Bearer aimk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"message":"Say hello from AI Market Cap"}'`}
                          </pre>
                        </div>
                      ) : null}
                    </details>
                  ) : null}
                  {runtimeError ? <p className="mt-3 text-xs text-red-400">{runtimeError}</p> : null}
                  <div className="mt-3">
                    <Button variant="outline" onClick={activateRuntime} disabled={runtimeLoading}>
                      {runtimeLoading
                        ? "Preparing..."
                        : runtime
                          ? "Refresh Runtime Setup"
                          : "Activate Runtime"}
                    </Button>
                    {canCreateManagedDeployment ? (
                      <Button variant="outline" onClick={createDeployment} disabled={runtimeLoading}>
                        {runtimeLoading
                          ? "Creating..."
                          : hasManagedDeployment
                            ? "Refresh Deployment"
                            : deployment?.deploymentKind === "hosted_external" ||
                                provisioning?.deploymentKind === "hosted_external"
                              ? "Create Hosted Deployment"
                              : "Create Deployment"}
                      </Button>
                    ) : null}
                    {hasManagedDeployment ? (
                      <Button
                        variant="outline"
                        onClick={() =>
                          updateDeployment({ action: isDeploymentPaused ? "resume" : "pause" })
                        }
                        disabled={runtimeLoading}
                      >
                        {runtimeLoading
                          ? "Updating..."
                          : isDeploymentPaused
                            ? "Resume Deployment"
                            : "Pause Deployment"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {hasManagedDeployment ? (
                  <div id="workspace-budget-billing" className="rounded-lg border border-border/40 bg-card/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Budget and billing
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">
                          {deployment?.billing.budgetRemaining != null
                            ? `$${deployment.billing.budgetRemaining.toFixed(2)} left`
                            : "No budget cap set"}
                        </p>
                      </div>
                      <Badge variant="outline" className={budgetStatusTone}>
                        {deployment?.billing.budgetStatus ?? "untracked"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-md border border-border/40 bg-background/40 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Per request
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">
                          ${deployment?.billing.requestCharge.toFixed(2) ?? "0.00"}
                        </p>
                      </div>
                      <div className="rounded-md border border-border/40 bg-background/40 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Estimated spend
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">
                          ${deployment?.billing.estimatedSpend.toFixed(2) ?? "0.00"}
                        </p>
                      </div>
                      <div className="rounded-md border border-border/40 bg-background/40 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Budget cap
                        </p>
                        <p className="mt-1 text-sm font-medium text-white">
                          {deployment?.creditsBudget != null
                            ? `$${deployment.creditsBudget.toFixed(2)}`
                            : "Not set"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <label className="min-w-[12rem] flex-1">
                        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Update budget cap
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={budgetDraft}
                          onChange={(event) => setBudgetDraft(event.target.value)}
                          className="mt-1 w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground outline-none focus:border-neon/30"
                        />
                      </label>
                      <Button
                        variant="outline"
                        disabled={runtimeLoading}
                        onClick={() =>
                          updateDeployment({
                            action: "set_budget",
                            creditsBudget:
                              budgetDraft.trim().length > 0 ? Number(budgetDraft) : null,
                          })
                        }
                      >
                        Save Budget
                      </Button>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      API requests are metered. Heavy usage can outgrow flat subscription pricing,
                      so keep an explicit budget on managed deployments.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild className="bg-neon text-background hover:bg-neon/90">
                        <Link href={apiHref}>
                          <KeyRound className="h-4 w-4" />
                          Open API Keys
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href={walletHref}>
                          <Wallet className="h-4 w-4" />
                          Open Wallet
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/deployments">Open Deployments</Link>
                      </Button>
                    </div>
                  </div>
                ) : null}

                {!hasManagedDeployment ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button asChild className="bg-neon text-background hover:bg-neon/90">
                      <Link href={walletHref}>
                        <Wallet className="h-4 w-4" />
                        Wallet
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={apiHref}>
                        <KeyRound className="h-4 w-4" />
                        API Keys
                      </Link>
                    </Button>
                    {session.nextUrl ? (
                      <Button asChild variant="outline" className="sm:col-span-2">
                        <a
                          href={session.nextUrl}
                          target="_blank"
                          rel={isSponsoredSession ? "noopener noreferrer sponsored nofollow" : "noopener noreferrer"}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                          Continue to Provider
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {hasManagedDeployment ? workflowGuideCard : null}
          {!hasManagedDeployment ? quickTestCard : null}

          <Card className="border-border/50 bg-card/60">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-neon" />
                <h2 className="text-lg font-semibold text-white">Session note</h2>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                Keep brief context here. It stays attached to this saved workspace session and
                remains visible in the full history.
              </p>
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={4}
                placeholder="Add a note about what you want to do with this model or what happened during setup."
                className="w-full resize-none rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-neon/30"
              />
              <div className="mt-3 flex justify-end">
                <Button variant="outline" disabled={noteDraft.trim().length === 0} onClick={saveNote}>
                  Save Note
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent forceMount value="assistant" className="mt-6 space-y-6">
          <Card id="workspace-assistant" className="border-border/50 bg-card/60">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-neon" />
                <h2 className="text-lg font-semibold text-white">Workspace assistant</h2>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                Ask what to do next for this model. The assistant stays tied to the same workspace
                conversation and transcript.
              </p>
              <textarea
                value={assistantDraft}
                onChange={(event) => setAssistantDraft(event.target.value)}
                rows={4}
                placeholder="Example: What should I do next to start using this model here?"
                className="w-full resize-none rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-neon/30"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  "What should I do first?",
                  "Do I need credits for this path?",
                  "How do I prepare API access?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setAssistantDraft(prompt)}
                    className="rounded-full border border-border/50 bg-card/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-neon/30 hover:text-foreground"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              {assistantError ? <p className="mt-3 text-xs text-red-400">{assistantError}</p> : null}
              <div className="mt-3 flex justify-end">
                <Button variant="outline" disabled={assistantDraft.trim().length === 0 || assistantLoading} onClick={askAssistant}>
                  {assistantLoading ? "Sending..." : "Ask Assistant"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card id="workspace-usage-history" className="border-border/50 bg-card/60">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-neon" />
                <h2 className="text-lg font-semibold text-white">Transcript</h2>
              </div>
              <div className="space-y-3">
                {chatMessages.length > 0 ? (
                  chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "rounded-lg border px-4 py-3 text-sm",
                        message.sender_type === "agent"
                          ? "border-border/40 bg-card/30 text-muted-foreground"
                          : "border-neon/20 bg-neon/10 text-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-white">
                          {message.sender_type === "agent" ? "Assistant" : "You"}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide opacity-70">
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border/40 px-4 py-6 text-sm text-muted-foreground">
                    No assistant transcript yet. Ask a question to start the workspace conversation.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent forceMount value="usage" className="mt-6">
          <Card className="border-border/50 bg-card/60">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-neon" />
                <h2 className="text-lg font-semibold text-white">Session history</h2>
              </div>
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border/40 bg-card/30 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Deployment status</p>
                  <p className="mt-1 text-sm font-medium text-white">{deployment?.status ?? runtime?.status ?? "draft"}</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-card/30 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Per request</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    ${deployment?.billing.requestCharge.toFixed(2) ?? "0.00"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-card/30 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Budget left</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {deployment?.billing.budgetRemaining != null
                      ? `$${deployment.billing.budgetRemaining.toFixed(2)}`
                      : "Not tracked"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-card/30 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Estimated spend</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    ${deployment?.billing.estimatedSpend.toFixed(2) ?? "0.00"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-card/30 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Updated</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {deployment?.updatedAt || runtime?.updatedAt
                      ? new Date(deployment?.updatedAt ?? runtime?.updatedAt ?? "").toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                          : "Not prepared"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-card/30 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Session events</p>
                  <p className="mt-1 text-sm font-medium text-white">{session.events.length}</p>
                </div>
              </div>
              <div className="space-y-3">
                {session.events.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-sm",
                      event.type === "system"
                        ? "border-border/40 bg-card/30 text-muted-foreground"
                        : "border-neon/20 bg-neon/10 text-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-white">{event.title}</span>
                      <span className="text-[10px] uppercase tracking-wide opacity-70">
                        {new Date(event.createdAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1">{event.detail}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
