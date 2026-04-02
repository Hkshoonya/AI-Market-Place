"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  KeyRound,
  Maximize2,
  MessageSquare,
  Minimize2,
  Wallet,
  X,
} from "lucide-react";
import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SWR_TIERS } from "@/lib/swr/config";
import { cn } from "@/lib/utils";
import { resolveWorkspaceRuntimeExecution } from "@/lib/workspace/runtime-execution";
import { useOptionalWorkspace } from "./workspace-provider";

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
    deploymentKind: "managed_api" | "assistant_only";
    deploymentLabel: string | null;
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
}

export function DeployWorkspacePanel() {
  const [noteDraft, setNoteDraft] = useState("");
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [deploymentLoading, setDeploymentLoading] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [runtimeDraft, setRuntimeDraft] = useState("");
  const [runtimeResponse, setRuntimeResponse] = useState<{
    content: string;
    provider: string;
    model: string;
  } | null>(null);
  const { user } = useAuth();
  const workspace = useOptionalWorkspace();
  const { data: walletSnapshot } = useSWR<WorkspaceWalletSnapshot>(
    user && workspace?.session ? "/api/marketplace/wallet?limit=1" : null,
    { ...SWR_TIERS.MEDIUM }
  );
  const { data: apiKeysSnapshot } = useSWR<WorkspaceApiKeysSnapshot>(
    user && workspace?.session ? "/api/api-keys" : null,
    { ...SWR_TIERS.SLOW }
  );
  const { data: chatSnapshot, mutate: mutateChatSnapshot } = useSWR<WorkspaceChatSnapshot>(
    user && workspace?.session?.conversationId
      ? `/api/workspace/chat?conversation_id=${encodeURIComponent(workspace.session.conversationId)}`
      : null,
    { ...SWR_TIERS.MEDIUM }
  );
  const { data: deploymentSnapshot, mutate: mutateDeploymentSnapshot } =
    useSWR<WorkspaceDeploymentSnapshot>(
      user && workspace?.session?.modelSlug
        ? `/api/workspace/deployment?modelSlug=${encodeURIComponent(workspace.session.modelSlug)}`
        : null,
      { ...SWR_TIERS.MEDIUM }
    );

  if (!workspace?.session) return null;

  const { session, open, minimized, maximized, activePanel, persistenceStatus } = workspace;
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
  const deployment = deploymentSnapshot?.deployment ?? null;
  const deploymentExecution = session.modelSlug
    ? resolveWorkspaceRuntimeExecution(session.modelSlug)
    : null;
  const canCreateManagedDeployment = Boolean(deploymentExecution?.available);
  const hasManagedDeployment = Boolean(deployment?.execution.available);
  const isDeploymentPaused = deployment?.status === "paused";
  const budgetStatusTone =
    deployment?.billing.budgetStatus === "healthy"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : deployment?.billing.budgetStatus === "low"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
        : deployment?.billing.budgetStatus === "exhausted"
          ? "border-red-500/20 bg-red-500/10 text-red-300"
          : "border-border/50 bg-card/40";
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
      label: "Funding",
      done: events.some((event) => /wallet|deposit/i.test(`${event.title} ${event.detail}`)),
      detail: session.suggestedPack
        ? `Use ${session.suggestedPack} if you still need balance.`
        : "Open wallet funding only if this path still needs credits.",
    },
    {
      label: "API Access",
      done: events.some((event) => /api/i.test(`${event.title} ${event.detail}`)),
      detail: "Create account-side API keys without losing the workspace session.",
    },
    {
      label: "Deployment",
      done: hasManagedDeployment,
      detail: hasManagedDeployment
        ? "Use the managed in-site deployment endpoint for chat and API requests."
        : canCreateManagedDeployment
          ? "Create the managed in-site deployment after funding and API setup are ready."
          : "This model does not have a mapped in-site runtime yet, so use the verified provider path instead.",
    },
  ];

  const canAddNote = noteDraft.trim().length > 0;
  const canSendAssistant = assistantDraft.trim().length > 0 && !assistantLoading;

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

  const createDeployment = async () => {
    if (!session.modelSlug || !session.model || deploymentLoading) return;
    if (!canCreateManagedDeployment) {
      setDeploymentError(
        "Direct in-site deployment is not available for this model yet. Use the verified provider path instead."
      );
      return;
    }

    setDeploymentLoading(true);
    setDeploymentError(null);

    try {
      const response = await fetch("/api/workspace/deployment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelSlug: session.modelSlug,
          modelName: session.model,
          providerName: session.provider,
          conversationId: session.conversationId,
          creditsBudget: session.suggestedAmount,
          monthlyPriceEstimate: session.suggestedAmount,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create deployment");
      }

      workspace.addWorkspaceEvent(
        "Deployment created",
        session.model
          ? `Created a managed in-site deployment for ${session.model}.`
          : "Created a managed in-site deployment."
      );

      workspace.updateWorkspaceSession({
        runtimeId: payload.runtime?.id ?? null,
        runtimeEndpointPath: payload.runtime?.endpointPath ?? null,
        deploymentId: payload.deployment?.id ?? null,
        deploymentEndpointPath: payload.deployment?.endpointPath ?? null,
      });

      await mutateDeploymentSnapshot();
    } catch (error) {
      setDeploymentError(error instanceof Error ? error.message : "Failed to create deployment");
    } finally {
      setDeploymentLoading(false);
    }
  };

  const updateDeployment = async (action: "pause" | "resume") => {
    if (!session.modelSlug || deploymentLoading) return;
    setDeploymentLoading(true);
    setDeploymentError(null);

    try {
      const response = await fetch("/api/workspace/deployment", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelSlug: session.modelSlug,
          action,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update deployment");
      }

      workspace.addWorkspaceEvent("Deployment updated", payload.update?.message ?? "Deployment updated.");
      await mutateDeploymentSnapshot();
    } catch (error) {
      setDeploymentError(error instanceof Error ? error.message : "Failed to update deployment");
    } finally {
      setDeploymentLoading(false);
    }
  };

  const runDeployment = async () => {
    const trimmed = runtimeDraft.trim();
    if (!deployment?.endpointPath || !trimmed || deploymentLoading) return;

    workspace.addWorkspaceEvent("Deployment prompt", trimmed, "user");
    setDeploymentLoading(true);
    setDeploymentError(null);
    setRuntimeDraft("");

    try {
      const response = await fetch(deployment.endpointPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to run deployment");
      }

      if (payload.response?.content) {
        workspace.addWorkspaceEvent(
          session.model ? `${session.model} response` : "Model response",
          payload.response.content,
          "system"
        );
      }

      setRuntimeResponse(payload.response ?? null);
      await mutateDeploymentSnapshot();
    } catch (error) {
      setDeploymentError(error instanceof Error ? error.message : "Failed to run deployment");
    } finally {
      setDeploymentLoading(false);
    }
  };

  if (!open || minimized) {
    return (
      <div className="fixed right-4 bottom-4 z-[140]">
        <Button
          onClick={workspace.expandWorkspace}
          className="rounded-full bg-neon px-4 text-background hover:bg-neon/90"
        >
          {session.model ? `Resume ${session.model}` : "Resume Workspace"}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-[140]",
        maximized
          ? "inset-x-4 bottom-4 top-20"
          : "right-4 bottom-4 w-[min(26rem,calc(100vw-2rem))]"
      )}
    >
      <Card className="border-neon/20 bg-background/95 shadow-2xl backdrop-blur">
        <CardContent className={cn("p-0", maximized ? "flex h-full flex-col" : "")}>
          <div className="flex items-start justify-between gap-3 border-b border-border/50 p-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-neon/20 bg-neon/10 text-neon">
                  In-site Workspace
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-border/50 bg-card/40",
                    persistenceStatus === "saved" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
                    persistenceStatus === "saving" && "border-amber-500/20 bg-amber-500/10 text-amber-200",
                    persistenceStatus === "error" && "border-red-500/20 bg-red-500/10 text-red-300"
                  )}
                >
                  {persistenceStatus === "saved"
                    ? "Saved to account"
                    : persistenceStatus === "saving"
                      ? "Saving"
                      : persistenceStatus === "loading"
                        ? "Loading saved session"
                        : persistenceStatus === "error"
                          ? "Browser only"
                          : "Browser only"}
                </Badge>
                {session.suggestedPack ? (
                  <Badge variant="outline" className="border-border/50 bg-card/40">
                    {session.suggestedPack}
                  </Badge>
                ) : null}
              </div>
              <h3 className="text-sm font-semibold text-white">
                {session.model ? session.model : "Deploy workspace"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Persistent across pages. Minimize or maximize any time without losing session history.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={maximized ? workspace.restoreWorkspace : workspace.maximizeWorkspace}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={workspace.minimizeWorkspace}>
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={workspace.closeWorkspace}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="rounded-lg border border-border/50 bg-card/30 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Target outcome
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["Chat UI", "API access", "Usage tracking"].map((item) => (
                  <Badge key={item} variant="outline" className="border-neon/20 bg-neon/10 text-neon">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>

            <Tabs
              value={activePanel}
              onValueChange={(value) =>
                workspace.setActivePanel(value as "setup" | "assistant" | "usage")
              }
              className={cn(maximized ? "min-h-0 flex-1" : "")}
            >
              <TabsList variant="line" className="w-full">
                <TabsTrigger value="setup">Setup</TabsTrigger>
                <TabsTrigger value="assistant">Assistant</TabsTrigger>
                <TabsTrigger value="usage">Usage</TabsTrigger>
              </TabsList>

              <TabsContent
                value="setup"
                className={cn("space-y-4", maximized ? "min-h-0 overflow-y-auto pr-1" : "")}
              >
                <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">Progress</p>
                    <Badge variant="outline" className="border-border/50 bg-card/40">
                      {stepItems.filter((item) => item.done).length}/{stepItems.length} complete
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {stepItems.map((item) => (
                      <div
                        key={item.label}
                        className={cn(
                          "rounded-md border px-3 py-3",
                          item.done
                            ? "border-emerald-500/20 bg-emerald-500/10"
                            : "border-border/40 bg-card/30"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white">{item.label}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              item.done
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                : "border-border/50 bg-card/40 text-muted-foreground"
                            )}
                          >
                            {item.done ? "Done" : "Next"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button asChild variant="outline" className="sm:col-span-2">
                    <Link href="/workspace">
                      <MessageSquare className="h-4 w-4" />
                      Open Full Workspace
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="sm:col-span-2">
                    <Link href="/deployments">
                      <ArrowUpRight className="h-4 w-4" />
                      View Deployments
                    </Link>
                  </Button>
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
                  {canCreateManagedDeployment ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="sm:col-span-2"
                      onClick={createDeployment}
                      disabled={deploymentLoading}
                    >
                      {deploymentLoading
                        ? "Creating..."
                        : hasManagedDeployment
                          ? "Refresh Deployment"
                          : "Create Deployment"}
                    </Button>
                  ) : null}
                  {hasManagedDeployment ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="sm:col-span-2"
                      onClick={() => updateDeployment(isDeploymentPaused ? "resume" : "pause")}
                      disabled={deploymentLoading}
                    >
                      {deploymentLoading
                        ? "Updating..."
                        : isDeploymentPaused
                          ? "Resume Deployment"
                          : "Pause Deployment"}
                    </Button>
                  ) : null}
                  {session.nextUrl ? (
                    <Button asChild variant="outline" className="sm:col-span-2">
                      <a
                        href={session.nextUrl}
                        target="_blank"
                        rel={session.sponsored ? "noopener noreferrer sponsored nofollow" : "noopener noreferrer"}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        Continue to Provider
                      </a>
                    </Button>
                  ) : null}
                </div>

                <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                  <div className="mb-3 rounded-md border border-border/40 bg-background/40 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Deployment
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {hasManagedDeployment
                        ? deployment?.deploymentLabel ?? "Managed deployment"
                        : canCreateManagedDeployment
                          ? "Not created yet"
                          : "Direct deployment not available"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {hasManagedDeployment
                        ? deployment?.execution.summary
                        : canCreateManagedDeployment
                          ? "Create the managed in-site deployment to get a stable endpoint and tracked usage."
                          : deploymentExecution?.summary ??
                            "Use the verified provider path until a direct in-site runtime is mapped."}
                    </p>
                    {hasManagedDeployment && deployment?.endpointPath ? (
                      <code className="mt-2 block text-[11px] text-foreground">
                        {deployment.endpointPath}
                      </code>
                    ) : null}
                    {hasManagedDeployment ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-md border border-border/40 bg-card/30 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Per request
                          </p>
                          <p className="mt-1 text-xs font-medium text-white">
                            ${deployment?.billing.requestCharge.toFixed(2) ?? "0.00"}
                          </p>
                        </div>
                        <div className="rounded-md border border-border/40 bg-card/30 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Spend
                          </p>
                          <p className="mt-1 text-xs font-medium text-white">
                            ${deployment?.billing.estimatedSpend.toFixed(2) ?? "0.00"}
                          </p>
                        </div>
                        <div className="rounded-md border border-border/40 bg-card/30 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Budget left
                          </p>
                          <p className="mt-1 text-xs font-medium text-white">
                            {deployment?.billing.budgetRemaining != null
                              ? `$${deployment.billing.budgetRemaining.toFixed(2)}`
                              : "Not tracked"}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {hasManagedDeployment ? (
                      <Badge variant="outline" className={cn("mt-3", budgetStatusTone)}>
                        {deployment?.billing.budgetStatus ?? "untracked"}
                      </Badge>
                    ) : null}
                    {hasManagedDeployment ? (
                      <div className="mt-3 rounded-md border border-border/40 bg-card/30 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Next actions
                        </p>
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <li>Create a runtime-ready API key.</li>
                          <li>Send one short test request first.</li>
                          <li>Pause the deployment when idle.</li>
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-neon" />
                    <p className="text-sm font-medium text-white">Session note</p>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Keep short context here. It stays in the persistent workspace history for this session.
                  </p>
                  <div className="space-y-2">
                    <textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      rows={maximized ? 4 : 3}
                      placeholder="Add a note about what you want to do with this model or what happened in setup."
                      className="w-full resize-none rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:border-neon/30"
                    />
                    <div className="flex justify-end">
                      <Button type="button" variant="outline" disabled={!canAddNote} onClick={saveNote}>
                        Save Note
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="assistant"
                className={cn("space-y-4", maximized ? "min-h-0 overflow-y-auto pr-1" : "")}
              >
                <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                  {hasManagedDeployment ? (
                    <div className="mb-3 rounded-md border border-border/40 bg-background/40 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Run deployment
                      </p>
                      <textarea
                        value={runtimeDraft}
                        onChange={(event) => setRuntimeDraft(event.target.value)}
                        rows={maximized ? 3 : 2}
                        placeholder={`Example: Give me a short overview of ${session.model ?? "this model"}.`}
                        className="mt-2 w-full resize-none rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:border-neon/30"
                      />
                      <div className="mt-2 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            runtimeDraft.trim().length === 0 ||
                            deploymentLoading ||
                            isDeploymentPaused
                          }
                          onClick={runDeployment}
                        >
                          {deploymentLoading
                            ? "Running..."
                            : isDeploymentPaused
                              ? "Deployment Paused"
                              : "Run Model"}
                        </Button>
                      </div>
                      {isDeploymentPaused ? (
                        <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/80">
                          This deployment is paused. Resume it before sending more model requests.
                        </div>
                      ) : null}
                      {runtimeResponse ? (
                        <div className="mt-3 rounded-md border border-border/40 bg-card/30 px-3 py-2 text-xs text-muted-foreground">
                          <p className="font-medium text-white">
                            {runtimeResponse.provider} · {runtimeResponse.model}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">{runtimeResponse.content}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {!canCreateManagedDeployment ? (
                    <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-amber-300">
                        Direct deployment is unavailable
                      </p>
                      <p className="mt-1 text-xs text-amber-100/80">
                        {deploymentExecution?.summary}
                      </p>
                    </div>
                  ) : null}
                  <div className="mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-neon" />
                    <p className="text-sm font-medium text-white">Workspace assistant</p>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Ask what to do next for this model. The assistant stays attached to the same workspace session.
                  </p>
                  <div className="space-y-2">
                    <textarea
                      value={assistantDraft}
                      onChange={(event) => setAssistantDraft(event.target.value)}
                      rows={maximized ? 4 : 3}
                      placeholder="Example: What should I do first to start using this model here?"
                      className="w-full resize-none rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:border-neon/30"
                    />
                    <div className="flex flex-wrap gap-2">
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
                    {assistantError ? <p className="text-xs text-red-400">{assistantError}</p> : null}
                    {deploymentError ? <p className="text-xs text-red-400">{deploymentError}</p> : null}
                    <div className="flex justify-end">
                      <Button type="button" variant="outline" disabled={!canSendAssistant} onClick={askAssistant}>
                        {assistantLoading ? "Sending..." : "Ask Assistant"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-neon" />
                    <p className="text-sm font-medium text-white">Assistant transcript</p>
                  </div>
                  <div className={cn("space-y-2 overflow-y-auto pr-1", maximized ? "h-[20rem]" : "max-h-56")}>
                    {chatMessages.length > 0 ? (
                      chatMessages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "rounded-md border px-3 py-2 text-xs",
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
                      <div className="rounded-md border border-dashed border-border/40 px-3 py-4 text-xs text-muted-foreground">
                        No assistant transcript yet. Ask the workspace assistant to start one.
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="usage"
                className={cn("space-y-4", maximized ? "min-h-0 overflow-y-auto pr-1" : "")}
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Wallet
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {typeof walletSnapshot?.balance === "number"
                        ? `$${walletSnapshot.balance.toFixed(2)}`
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      API Keys
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">{activeApiKeys}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Deployment Status
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">{deployment?.status ?? "draft"}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Deployment Requests
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">{deployment?.totalRequests ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Tracked Tokens
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {deployment?.totalTokens ?? assistantUsage.totalTokens}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Session Events
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">{session.events.length}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Assistant Turns
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">{assistantUsage.turns}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-neon" />
                    <p className="text-sm font-medium text-white">Session history</p>
                  </div>
                  <div className={cn("space-y-2 overflow-y-auto pr-1", maximized ? "h-[20rem]" : "max-h-56")}>
                    {session.events.map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          "rounded-md border px-3 py-2 text-xs",
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
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
