"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Maximize2, Minimize2, Wallet, KeyRound, MessageSquare, X } from "lucide-react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { SWR_TIERS } from "@/lib/swr/config";
import { cn } from "@/lib/utils";
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

export function DeployWorkspacePanel() {
  const [noteDraft, setNoteDraft] = useState("");
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
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

  if (!workspace?.session) return null;

  const { session, open, minimized, maximized } = workspace;
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
  const events = session.events;
  const hasWalletProgress = events.some((event) =>
    /wallet|deposit/i.test(`${event.title} ${event.detail}`)
  );
  const hasApiProgress = events.some((event) =>
    /api/i.test(`${event.title} ${event.detail}`)
  );
  const hasProviderProgress = events.some((event) =>
    /provider/i.test(`${event.title} ${event.detail}`)
  );
  const activeApiKeys = (apiKeysSnapshot?.keys ?? []).filter((key) => key.is_active).length;
  const chatMessages = chatSnapshot?.messages ?? [];
  const assistantUsage = chatMessages.reduce(
    (acc, message) => {
      const usage = message.metadata?.usage;
      acc.turns += message.sender_type === "agent" ? 1 : 0;
      acc.totalTokens += usage?.totalTokens ?? 0;
      return acc;
    },
    { turns: 0, totalTokens: 0 }
  );
  const stepItems = [
    {
      label: "Funding",
      done: hasWalletProgress,
      detail: session.suggestedPack
        ? `Use ${session.suggestedPack} if you still need balance.`
        : "Open wallet funding only if this path still needs credits.",
    },
    {
      label: "API Access",
      done: hasApiProgress,
      detail: "Create account-side API keys without losing the workspace session.",
    },
    {
      label: "Provider Path",
      done: hasProviderProgress,
      detail: "Continue only after funding and API setup are ready.",
    },
  ];
  const canAddNote = noteDraft.trim().length > 0;
  const canSendAssistant = assistantDraft.trim().length > 0 && !assistantLoading;

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
                Persistent across pages. Minimize it any time and continue later without losing session history.
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
          <div className={cn("space-y-4 p-4", maximized ? "grid flex-1 gap-4 overflow-hidden lg:grid-cols-[0.95fr_1.05fr]" : "")}>
            <div className={cn("space-y-4", maximized ? "min-h-0 overflow-y-auto pr-1" : "")}>
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

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Wallet
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {typeof walletSnapshot?.balance === "number" ? `$${walletSnapshot.balance.toFixed(2)}` : "—"}
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
                <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Tracked Tokens
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">{assistantUsage.totalTokens}</p>
                </div>
              </div>

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
                      rel={session.sponsored ? "noopener noreferrer sponsored nofollow" : "noopener noreferrer"}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      Continue to Provider
                    </a>
                  </Button>
                ) : null}
              </div>

              <div className="rounded-lg border border-border/50 bg-card/20 p-3">
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
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canAddNote}
                      onClick={() => {
                        const trimmed = noteDraft.trim();
                        if (!trimmed) return;
                        workspace.addWorkspaceEvent("Session note", trimmed, "user");
                        setNoteDraft("");
                      }}
                    >
                      Save Note
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-neon" />
                  <p className="text-sm font-medium text-white">Workspace assistant</p>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Ask the in-site assistant what to do next for this model. It stays attached to the same workspace session.
                </p>
                <div className="space-y-2">
                  <textarea
                    value={assistantDraft}
                    onChange={(event) => setAssistantDraft(event.target.value)}
                    rows={maximized ? 4 : 3}
                    placeholder="Example: What should I do first to start using this model here?"
                    className="w-full resize-none rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:border-neon/30"
                  />
                  {assistantError ? (
                    <p className="text-xs text-red-400">{assistantError}</p>
                  ) : null}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canSendAssistant}
                      onClick={async () => {
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
                              topic: session.model
                                ? `Deploy workspace for ${session.model}`
                                : "Deploy workspace",
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
                            workspace.addWorkspaceEvent(
                              "Assistant reply",
                              payload.response.content,
                              "system"
                            );
                          }
                          await mutateChatSnapshot();
                        } catch (error) {
                          setAssistantError(
                            error instanceof Error
                              ? error.message
                              : "Failed to contact workspace assistant"
                          );
                          workspace.addWorkspaceEvent(
                            "Assistant unavailable",
                            "The in-site workspace assistant could not answer right now."
                          );
                        } finally {
                          setAssistantLoading(false);
                        }
                      }}
                    >
                      {assistantLoading ? "Sending..." : "Ask Assistant"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                <div className="mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-neon" />
                  <p className="text-sm font-medium text-white">Assistant transcript</p>
                </div>
                <div className={cn("space-y-2 overflow-y-auto pr-1", maximized ? "h-[18rem]" : "max-h-48")}>
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

              <div className="rounded-lg border border-border/50 bg-card/20 p-3">
                <div className="mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-neon" />
                  <p className="text-sm font-medium text-white">Session history</p>
                </div>
                <div className={cn("space-y-2 overflow-y-auto pr-1", maximized ? "h-[18rem]" : "max-h-48")}>
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
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
