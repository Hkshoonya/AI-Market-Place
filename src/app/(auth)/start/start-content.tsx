"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, KeyRound, Wallet, ExternalLink, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspace } from "@/components/workspace/workspace-provider";

function buildWalletHref(params: URLSearchParams) {
  return `/wallet?${params.toString()}#deposit-addresses`;
}

function buildApiKeysHref(params: URLSearchParams) {
  return `/settings/api-keys?${params.toString()}`;
}

export default function StartContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { openWorkspace, addWorkspaceEvent } = useWorkspace();

  const starterModel = searchParams.get("model");
  const starterModelSlug = searchParams.get("modelSlug");
  const starterProvider = searchParams.get("provider");
  const starterAction = searchParams.get("action");
  const starterNext = searchParams.get("next");
  const starterAmount = searchParams.get("amount");
  const starterPackLabel = searchParams.get("packLabel");
  const starterSponsored = searchParams.get("sponsored") === "1";

  useEffect(() => {
    if (!loading && !user) {
      const queryString = searchParams.toString();
      const redirectTarget = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
    }
  }, [loading, pathname, router, searchParams, user]);

  const preservedParams = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  useEffect(() => {
    if (!user) return;
    openWorkspace({
      model: starterModel,
      modelSlug: starterModelSlug,
      provider: starterProvider,
      action: starterAction,
      nextUrl: starterNext,
      suggestedPack: starterPackLabel,
      suggestedAmount:
        starterAmount && Number.isFinite(Number(starterAmount)) ? Number(starterAmount) : null,
    });
  }, [
    user,
    openWorkspace,
    starterAction,
    starterAmount,
    starterModel,
    starterModelSlug,
    starterNext,
    starterPackLabel,
    starterProvider,
  ]);

  if (loading || !user) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-neon/20 bg-neon/10 text-neon">
            Deploy Start
          </Badge>
          {starterPackLabel ? (
            <Badge variant="outline" className="border-border/50 bg-card/40">
              {starterPackLabel}
            </Badge>
          ) : null}
          {starterProvider ? (
            <span className="text-sm text-muted-foreground">via {starterProvider}</span>
          ) : null}
        </div>
        <h1 className="text-3xl font-bold">
          {starterModel ? `Start ${starterModel}` : "Start this model"}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          This is the first-party handoff from the model page. Use it to fund access, prepare API access,
          and continue into the verified provider path from one place.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card className="border-neon/20 bg-neon/5">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold">What this start flow is for</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The goal is to move from a model page into a usable model experience. Today that means
                the flow can fund access, preserve deploy intent, prepare API access, and send the user
                into the verified provider path without losing context.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Chat UI", "API access", "Usage tracking"].map((item) => (
                  <Badge key={item} variant="outline" className="border-neon/20 bg-neon/10 text-neon">
                    {item}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/50 bg-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-neon" />
                  <h3 className="font-semibold">1. Fund Credits</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add credits once, then reuse them across paid starts, subscriptions, and future metered usage.
                </p>
                {starterAmount ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Recommended balance for this path: ${starterAmount}.
                  </p>
                ) : null}
                <Button asChild className="mt-4 w-full bg-neon text-background hover:bg-neon/90">
                  <Link
                    href={buildWalletHref(preservedParams)}
                    onClick={() =>
                      addWorkspaceEvent(
                        "Wallet opened",
                        "Moved into the wallet funding step from the in-site workspace."
                      )
                    }
                  >
                    Open Wallet
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-neon" />
                  <h3 className="font-semibold">2. Prepare API Access</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create API keys for the account-side access layer while the runtime path is being prepared.
                </p>
                <Button asChild variant="outline" className="mt-4 w-full">
                  <Link
                    href={buildApiKeysHref(preservedParams)}
                    onClick={() =>
                      addWorkspaceEvent(
                        "API access prepared",
                        "Opened API key setup from the in-site workspace."
                      )
                    }
                  >
                    API Keys
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-neon" />
                  <h3 className="font-semibold">3. Continue to Provider</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use the verified provider path for the model after funding and setup are ready.
                </p>
                {starterNext ? (
                  <Button asChild variant="outline" className="mt-4 w-full">
                    <a
                      href={starterNext}
                      target="_blank"
                      rel={
                        starterSponsored
                          ? "noopener noreferrer sponsored nofollow"
                          : "noopener noreferrer"
                      }
                      onClick={() =>
                        addWorkspaceEvent(
                          "Provider path opened",
                          "Continued from the in-site workspace into the verified provider destination."
                        )
                      }
                    >
                      {starterAction ?? "Continue"}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="mt-4 w-full">
                    <Link href={starterModelSlug ? `/models/${starterModelSlug}?tab=deploy#model-tabs` : "/"}>
                      Back to Deploy Tab
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50 bg-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-neon" />
                <h2 className="text-lg font-semibold">Tracking status</h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                This flow is being built toward a single deployed experience with chat, API access, and
                usage visibility from AI Market Cap. Right now, the strongest tracking surfaces already
                available in-product are wallet funding state, API key creation, and account-side activity.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Wallet: credit balance and purchase funding state</li>
                <li>API Keys: account-side access provisioning</li>
                <li>Future managed runtime: request and usage metering on AI Market Cap paths</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold">Current model context</h2>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {starterModel ? <p><span className="text-foreground">Model:</span> {starterModel}</p> : null}
                {starterProvider ? <p><span className="text-foreground">Path:</span> {starterProvider}</p> : null}
                {starterAction ? <p><span className="text-foreground">Action:</span> {starterAction}</p> : null}
                {starterPackLabel ? <p><span className="text-foreground">Suggested pack:</span> {starterPackLabel}</p> : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
