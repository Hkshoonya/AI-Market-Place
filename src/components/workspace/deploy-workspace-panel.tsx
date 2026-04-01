"use client";

import Link from "next/link";
import { ArrowUpRight, Maximize2, Minimize2, Wallet, KeyRound, MessageSquare, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useOptionalWorkspace } from "./workspace-provider";

export function DeployWorkspacePanel() {
  const workspace = useOptionalWorkspace();
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
            </div>

            <div className="rounded-lg border border-border/50 bg-card/20 p-3">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-neon" />
                <p className="text-sm font-medium text-white">Session history</p>
              </div>
              <div className={cn("space-y-2 overflow-y-auto pr-1", maximized ? "h-[22rem]" : "max-h-56")}>
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
        </CardContent>
      </Card>
    </div>
  );
}
