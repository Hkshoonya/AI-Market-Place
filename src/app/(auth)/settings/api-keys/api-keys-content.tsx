"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  Key,
  Copy,
  Trash2,
  Plus,
  Shield,
  Clock,
  Check,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { SWR_TIERS } from "@/lib/swr/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface ApiKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_per_minute: number;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface ApiKeysResponse {
  keys: ApiKeyRecord[];
}

const AVAILABLE_SCOPES = [
  {
    value: "read",
    label: "Read",
    description: "Query models, rankings, marketplace",
  },
  {
    value: "write",
    label: "Write",
    description: "Create orders, submit reviews",
  },
  {
    value: "agent",
    label: "Agent",
    description: "Chat with agents, manage conversations",
  },
  {
    value: "mcp",
    label: "MCP",
    description: "Access MCP server protocol",
  },
  {
    value: "marketplace",
    label: "Marketplace",
    description: "Manage listings and marketplace automation",
  },
  {
    value: "withdraw",
    label: "Withdraw",
    description: "Transfer seller funds to a wallet address",
  },
];

export default function ApiKeysContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openWorkspace, addWorkspaceEvent } = useWorkspace();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["read"]);
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deployIntent = searchParams.get("intent");
  const starterModel = searchParams.get("model");
  const starterModelSlug = searchParams.get("modelSlug");
  const starterProvider = searchParams.get("provider");
  const starterAction = searchParams.get("action");
  const starterNext = searchParams.get("next");
  const starterSponsored = searchParams.get("sponsored") === "1";
  const starterPackSlug = searchParams.get("pack");
  const starterPackLabel = searchParams.get("packLabel");
  const starterAmountRaw = searchParams.get("amount");
  const starterAmount =
    starterAmountRaw && Number.isFinite(Number(starterAmountRaw))
      ? Number(starterAmountRaw)
      : null;

  const { data, isLoading, mutate } = useSWR<ApiKeysResponse>(
    user ? "/api/api-keys" : null,
    { ...SWR_TIERS.SLOW }
  );

  const keys = data?.keys ?? [];

  useEffect(() => {
    if (!loading && !user) {
      const queryString = searchParams.toString();
      const redirectTarget = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
    }
  }, [loading, pathname, router, searchParams, user]);

  useEffect(() => {
    if (!user || deployIntent !== "deploy") return;
    openWorkspace({
      model: starterModel,
      modelSlug: starterModelSlug,
      provider: starterProvider,
      action: starterAction,
      nextUrl: starterNext,
      sponsored: starterSponsored,
      suggestedPackSlug: starterPackSlug,
      suggestedPack: starterPackLabel,
      suggestedAmount: starterAmount,
    });
    addWorkspaceEvent(
      "API keys step opened",
      starterModel
        ? `Opened API access setup for ${starterModel} without losing the active deploy session.`
        : "Opened API access setup without losing the active deploy session."
    );
  }, [
    addWorkspaceEvent,
    deployIntent,
    openWorkspace,
    starterAction,
    starterAmount,
    starterModel,
    starterModelSlug,
    starterNext,
    starterPackLabel,
    starterPackSlug,
    starterProvider,
    starterSponsored,
    user,
  ]);

  const createKey = async () => {
    setError(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          scopes: newKeyScopes,
          expires_in_days: newKeyExpiry ? parseInt(newKeyExpiry) : undefined,
        }),
      });

      const respData = await res.json();
      if (!res.ok) {
        setError(respData.error);
        return;
      }

      setCreatedKey(respData.plaintext_key);
      setShowCreate(false);
      setNewKeyName("");
      setNewKeyScopes(["read"]);
      setNewKeyExpiry("");
      toast.success("API key created");
      addWorkspaceEvent(
        "API key created",
        newKeyName
          ? `Created API key "${newKeyName}" while continuing the deploy workspace.`
          : "Created an API key while continuing the deploy workspace."
      );
      mutate();
    } catch {
      setError("Failed to create API key");
      toast.error("Failed to create API key");
    }
  };

  const revokeKey = async (id: string) => {
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("API key revoked");
      mutate();
    } catch {
      toast.error("Failed to revoke API key");
    }
  };

  const copyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );
  };

  if (loading || isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-secondary" />
          <div className="h-64 rounded-xl bg-secondary" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {deployIntent === "deploy" && starterModel ? (
        <Card className="mb-6 border-neon/20 bg-neon/5">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-neon/20 bg-neon/10 text-neon">
                  Deploy Workspace
                </Badge>
                {starterPackLabel ? (
                  <Badge variant="outline" className="border-border/50 bg-card/40">
                    {starterPackLabel}
                  </Badge>
                ) : null}
              </div>
              <h2 className="text-base font-semibold">Keep API setup tied to {starterModel}</h2>
              <p className="text-sm text-muted-foreground">
                Create the account-side API key here, then continue the same in-site deploy session
                without losing history or wallet context.
              </p>
            </div>
            {starterModelSlug ? (
              <Button variant="outline" asChild>
                <Link href={`/models/${starterModelSlug}?tab=deploy#model-tabs`}>
                  Back to Model
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neon/10">
            <Key className="h-5 w-5 text-neon" />
          </div>
          <div>
            <h1 className="text-xl font-bold">API Keys</h1>
            <p className="text-xs text-muted-foreground">
              Manage keys for bot access, MCP protocol, and marketplace API
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-neon px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neon/90"
        >
          <Plus className="h-4 w-4" />
          Create Key
        </button>
      </div>

      {/* Created key banner - show once */}
      {createdKey && (
        <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
            <div className="flex-1">
              <p className="mb-2 text-sm font-medium text-yellow-500">
                Store this key securely — it won&apos;t be shown again
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-secondary px-3 py-2 font-mono text-sm text-foreground">
                  {createdKey}
                </code>
                <button
                  onClick={copyKey}
                  className="shrink-0 rounded-lg bg-secondary px-3 py-2 transition-colors hover:bg-secondary/80"
                  aria-label={copied ? "Copied to clipboard" : "Copy API key to clipboard"}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-neon" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create key form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Create New API Key</h2>
          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
          <div className="space-y-4">
            <div>
              <label htmlFor="api-key-name" className="mb-1 block text-sm font-medium text-muted-foreground">
                Key Name
              </label>
              <input
                id="api-key-name"
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., My Trading Bot"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:border-neon focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Scopes
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <button
                    key={scope.value}
                    onClick={() => toggleScope(scope.value)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      newKeyScopes.includes(scope.value)
                        ? "border-neon/50 bg-neon/5 text-foreground"
                        : "border-border bg-secondary text-muted-foreground hover:border-border/80"
                    }`}
                  >
                    <Shield
                      className={`h-3.5 w-3.5 ${newKeyScopes.includes(scope.value) ? "text-neon" : ""}`}
                    />
                    <div>
                      <span className="font-medium">{scope.label}</span>
                      <p className="text-xs text-muted-foreground">
                        {scope.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="api-key-expiry" className="mb-1 block text-sm font-medium text-muted-foreground">
                Expiration (optional)
              </label>
              <select
                id="api-key-expiry"
                value={newKeyExpiry}
                onChange={(e) => setNewKeyExpiry(e.target.value)}
                className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:border-neon focus:outline-none"
              >
                <option value="">Never expires</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={createKey}
                disabled={!newKeyName || newKeyScopes.length === 0}
                className="rounded-lg bg-neon px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neon/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create Key
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setError(null);
                }}
                className="rounded-lg bg-secondary px-4 py-2 text-sm transition-colors hover:bg-secondary/80"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keys list */}
      <div className="space-y-3">
        {keys.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Key className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No API keys yet. Create one to access the platform via API or MCP.
            </p>
          </div>
        ) : (
          keys.map((apiKey) => (
            <div
              key={apiKey.id}
              className={`rounded-xl border bg-card p-4 ${
                apiKey.is_active
                  ? "border-border"
                  : "border-border/50 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-medium">{apiKey.name}</span>
                    {!apiKey.is_active && (
                      <span className="rounded bg-red-400/10 px-2 py-0.5 text-xs text-red-400">
                        Revoked
                      </span>
                    )}
                  </div>
                  <code className="font-mono text-xs text-muted-foreground">
                    {apiKey.key_prefix}...
                  </code>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {apiKey.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {apiKey.last_used_at
                        ? `Used ${new Date(apiKey.last_used_at).toLocaleDateString()}`
                        : "Never used"}
                    </div>
                    {apiKey.expires_at && (
                      <div className="mt-0.5">
                        Expires{" "}
                        {new Date(apiKey.expires_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  {apiKey.is_active && (
                    <button
                      onClick={() => revokeKey(apiKey.id)}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-400/10 hover:text-red-400"
                      title="Revoke key"
                      aria-label={`Revoke API key ${apiKey.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
