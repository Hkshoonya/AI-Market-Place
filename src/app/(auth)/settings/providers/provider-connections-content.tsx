"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Plug, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Provider = "openrouter" | "replicate" | "huggingface" | "runpod";

interface ProviderConnection {
  id: string;
  provider: Provider;
  displayName: string;
  secretHint: string;
  externalAccountName: string | null;
  capabilities: string[];
  status: "active" | "invalid" | "revoked";
  lastValidatedAt: string | null;
}

const PROVIDERS: Array<{
  id: Provider;
  name: string;
  description: string;
  tokenUrl: string;
  tokenHint: string;
}> = [
  {
    id: "runpod",
    name: "Runpod",
    description: "Launch and manage supported open-weight models on GPUs in your own Runpod account. Runpod bills compute and storage directly.",
    tokenUrl: "https://console.runpod.io/user/settings",
    tokenHint: "Dedicated Runpod API key",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Use models routed through OpenRouter and let OpenRouter bill your account directly.",
    tokenUrl: "https://openrouter.ai/settings/keys",
    tokenHint: "sk-or-v1-...",
  },
  {
    id: "replicate",
    name: "Replicate",
    description: "Run hosted predictions and create dedicated deployments in your Replicate account.",
    tokenUrl: "https://replicate.com/account/api-tokens",
    tokenHint: "r8_...",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    description: "Use routed inference and models your Hugging Face account is allowed to access.",
    tokenUrl: "https://huggingface.co/settings/tokens",
    tokenHint: "hf_...",
  },
];

export default function ProviderConnectionsContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { data, error: loadError, isLoading, mutate } = useSWR<{ connections: ProviderConnection[] }>(
    user ? "/api/provider-connections" : null
  );
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login?redirect=/settings/providers");
  }, [loading, router, user]);

  async function connect(provider: Provider) {
    if (!token.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/provider-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, token }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Provider connection failed");
      setToken("");
      setEditingProvider(null);
      await mutate();
      toast.success(`${PROVIDERS.find((item) => item.id === provider)?.name} connected`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider connection failed");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect(connection: ProviderConnection) {
    const response = await fetch(`/api/provider-connections/${connection.id}`, {
      method: "DELETE",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error ?? "Could not disconnect provider");
      return;
    }
    await mutate();
    toast.success("Provider disconnected");
  }

  if (loading || isLoading || !user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="h-72 animate-pulse rounded-2xl bg-secondary" />
      </div>
    );
  }

  const connections = data?.connections ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/settings"
        className="mb-7 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Account settings
      </Link>

      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-neon/10">
          <Plug className="h-5 w-5 text-neon" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Provider connections</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Connect accounts you already pay for. Provider usage is billed by that provider, while
            AI Market Cap keeps deployment state, endpoints, and usage history together.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100/90">
        Credentials are validated first, encrypted at rest, and never shown again. Use a scoped key
        created only for AI Market Cap and rotate it if needed. Use provider spending controls where
        available; an estimate on this site is not a hard spending cap.
      </div>

      {loadError ? <p role="alert" className="mb-4 text-loss">Provider connections could not be loaded. Refresh before changing credentials.</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {PROVIDERS.map((provider) => {
          const connection = connections.find((item) => item.provider === provider.id);
          const isEditing = editingProvider === provider.id;
          return (
            <Card key={provider.id} className="border-border/50 bg-card/70">
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-white">{provider.name}</h2>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {provider.description}
                    </p>
                  </div>
                  {connection ? (
                    <Badge variant="outline" className={connection.status === "active" ? "border-emerald-500/20 text-emerald-300" : "border-amber-500/20 text-amber-300"}>
                      {connection.status === "active" ? "Connected" : "Needs attention"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not connected</Badge>
                  )}
                </div>

                {provider.id === "runpod" ? (
                  <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                    <p>Use a dedicated key with Pod management read/write and account read access. Account validation does not prove launch permission.</p>
                    <a href="/go/runpod?source=provider-connections" target="_blank" rel="noopener noreferrer sponsored nofollow" className="block text-neon underline">New to Runpod? Create an account</a>
                    <p>Referral link: AI Market Cap may earn Runpod credits on eligible usage. Existing accounts are not new referrals.</p>
                    {connection?.status === "active" ? <Link href="/workspace/pods" className="block text-neon underline">Open GPU Pods</Link> : null}
                  </div>
                ) : null}

                {connection ? (
                  <div className="mt-5 space-y-3 rounded-lg border border-border/40 bg-background/40 p-3">
                    <div className="flex items-center gap-2 text-sm text-white">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      {connection.externalAccountName ?? connection.displayName}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">
                      Credential {connection.secretHint}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {connection.capabilities.map((capability) => (
                        <Badge key={capability} variant="outline" className="text-[10px]">
                          {capability.replaceAll("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {isEditing ? (
                  <div className="mt-5 space-y-3">
                    <label className="text-xs font-medium text-muted-foreground">
                      Provider API token
                    </label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      placeholder={provider.tokenHint}
                      aria-label={`${provider.name} API token`}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => void connect(provider.id)}
                        disabled={saving || token.trim().length < 8}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                        Validate and connect
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingProvider(null);
                          setToken("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    <Button
                      size="sm"
                      variant={connection ? "outline" : "default"}
                      onClick={() => setEditingProvider(provider.id)}
                    >
                      {connection ? "Replace key" : "Connect"}
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={provider.tokenUrl} target="_blank" rel="noopener noreferrer">
                        Create scoped key
                      </a>
                    </Button>
                    {connection ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-loss"
                        onClick={() => void disconnect(connection)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Disconnect
                      </Button>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
