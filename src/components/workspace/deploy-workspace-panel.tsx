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

  const { session, open, minimized } = workspace;
  const walletHref = `/wallet?intent=deploy&model=${encodeURIComponent(session.model ?? "")}&modelSlug=${encodeURIComponent(session.modelSlug ?? "")}&action=${encodeURIComponent(session.action ?? "")}&next=${encodeURIComponent(session.nextUrl ?? "")}${session.provider ? `&provider=${encodeURIComponent(session.provider)}` : ""}${session.suggestedAmount ? `&amount=${session.suggestedAmount}` : ""}${session.suggestedPack ? `&packLabel=${encodeURIComponent(session.suggestedPack)}` : ""}#deposit-addresses`;
  const apiHref = `/settings/api-keys`;

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
    <div className="fixed right-4 bottom-4 z-[140] w-[min(26rem,calc(100vw-2rem))]">
      <Card className="border-neon/20 bg-background/95 shadow-2xl backdrop-blur">
        <CardContent className="p-0">
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
                  <a href={session.nextUrl} target="_blank" rel="noopener noreferrer">
                    <ArrowUpRight className="h-4 w-4" />
                    Continue to Provider
                  </a>
                </Button>
              ) : null}
            </div>

            <div className="rounded-lg border border-border/50 bg-card/20 p-3">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-neon" />
                <p className="text-sm font-medium text-white">Session history</p>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
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
