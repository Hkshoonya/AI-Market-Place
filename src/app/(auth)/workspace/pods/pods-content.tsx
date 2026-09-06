"use client";

import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  RUNPOD_MODELS,
  RUNPOD_VOLUMES,
  type PublicRunpodPod,
  type RunpodGpu,
} from "@/lib/runpod/catalog";

const API = "/api/workspace/pods";
interface Snapshot {
  pods: PublicRunpodPod[];
  connections: Array<{ id: string; displayName: string }>;
  gpus: RunpodGpu[] | null;
  launchEnabled: boolean;
}
async function getSnapshot(url: string): Promise<Snapshot> {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Unable to load Pods");
  return body;
}
async function post(body: Record<string, unknown>) {
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Pod request failed");
  return result;
}
const money = (value: number) => `$${value.toFixed(3)}`;
const selectClass =
  "mt-2 w-full min-w-0 rounded-lg border border-border bg-background p-3 text-sm";

function PodCard({
  pod,
  enabled,
  refresh,
}: {
  pod: PublicRunpodPod;
  enabled: boolean;
  refresh: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const result = await post({ action, id: pod.id, ...extra });
      if (action === "reveal_key") setApiKey(result.apiKey);
      else {
        setApiKey(null);
        await refresh();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Pod operation failed",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!apiKey) return;
    const timer = window.setTimeout(() => setApiKey(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [apiKey]);
  const terminated = pod.status === "terminated";
  return (
    <Card className="min-w-0 border-border/50 bg-card/70">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{pod.modelName}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {pod.gpuName} / {pod.volumeGb} GB volume
            </p>
          </div>
          <Badge variant="outline">
            {pod.apiReady ? "Model API ready" : pod.status.replaceAll("_", " ")}
          </Badge>
        </div>
        <p className="text-sm">
          <span className="font-mono">
            {money(pod.estimatedGpuPricePerHour)}/hr
          </span>{" "}
          GPU estimate, plus storage and applicable charges. Runpod bills you
          directly.
        </p>
        {pod.observedPricePerHour != null && !terminated ? (
          <p className="text-xs text-muted-foreground">
            Last provider-reported rate: {money(pod.observedPricePerHour)}/hr.
            Not an invoice or spending cap.
          </p>
        ) : null}
        {pod.status === "running" && !pod.apiReady ? (
          <p className="text-sm text-amber-200">
            GPU allocated, but the model API is not ready yet. Loading or a
            startup error may be the cause; compute can still be billed. Check
            container logs in Runpod.
          </p>
        ) : null}
        {pod.status === "stopped" ? (
          <p className="text-sm text-amber-200">
            Stopped is not deleted. Volume storage can still be billed. Back up
            data before terminating.
          </p>
        ) : null}
        {pod.lastError ? (
          <p role="status" className="break-words text-sm text-amber-200">
            {pod.lastError}
          </p>
        ) : null}
        <p className="break-all text-xs text-muted-foreground">
          Runpod name: aimc-{pod.id}
        </p>
        {pod.endpointUrl && !terminated ? (
          <div className="min-w-0 space-y-2 rounded-lg border border-border/50 bg-background/50 p-3">
            <p className="text-xs font-medium">
              OpenAI-compatible API base URL
            </p>
            <code className="block break-all text-xs text-neon">
              {pod.endpointUrl}
            </code>
            <p className="text-xs text-muted-foreground">
              Model: {pod.modelKey}. Send the Pod API key as a Bearer token, not
              your Runpod account key.
            </p>
            {apiKey ? (
              <>
                <code
                  aria-label="Pod API key"
                  data-private="true"
                  className="ph-no-capture ph-sensitive block break-all text-xs"
                >
                  {apiKey}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setApiKey(null)}
                >
                  Hide key
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void act("reveal_key")}
              >
                <KeyRound className="h-3 w-3" />
                Reveal Pod API key for 60 seconds
              </Button>
            )}
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Example API request
              </summary>
              <pre className="mt-2 max-w-full overflow-x-auto text-xs">{`curl ${pod.endpointUrl}/chat/completions \\\n+  -H "Authorization: Bearer $POD_API_KEY" \\\n+  -H "Content-Type: application/json" \\\n+  -d '{"model":"${pod.modelKey}","messages":[{"role":"user","content":"Hello"}],"max_tokens":128}'`}</pre>
            </details>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {!terminated ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void act("refresh")}
            >
              <RefreshCw className="h-3 w-3" />
              Refresh status
            </Button>
          ) : null}
          {!terminated && pod.endpointUrl && pod.status !== "stopped" ? (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline" disabled={busy}>
                  Stop GPU
                </Button>
              }
              title="Stop this Pod?"
              description="Stopping interrupts requests and loses container-disk data. The volume remains and can still be billed. This does not delete your Pod."
              confirmLabel="Stop and retain volume"
              onConfirm={() => void act("stop", { acceptStorageCharges: true })}
            />
          ) : null}
          {pod.status === "stopped" ? (
            <ConfirmDialog
              trigger={
                <Button size="sm" disabled={busy || !enabled}>
                  Resume GPU
                </Button>
              }
              title="Resume paid GPU usage?"
              description={`Runpod will bill your account again. GPU estimate: ${money(pod.estimatedGpuPricePerHour)}/hr plus storage. Availability and actual charges can vary; this is not a hard cap.`}
              confirmLabel="Accept charges and resume"
              onConfirm={() =>
                void act("resume", {
                  acceptProviderCharges: true,
                  maxGpuPricePerHour: pod.estimatedGpuPricePerHour,
                })
              }
            />
          ) : null}
          {!terminated && pod.endpointUrl ? (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="destructive" disabled={busy}>
                  Terminate
                </Button>
              }
              title="Permanently delete this Pod and its data?"
              description="This deletes the Pod and its local container and volume data. Back up anything you need first. This action cannot be undone."
              variant="destructive"
              confirmLabel="Delete Pod and data"
              onConfirm={() =>
                void act("terminate", { confirmation: "DELETE POD AND DATA" })
              }
            />
          ) : null}
          <Button size="sm" variant="ghost" asChild>
            <a href={pod.consoleUrl} target="_blank" rel="noopener noreferrer">
              Runpod console <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Last checked:{" "}
          {pod.lastCheckedAt
            ? new Date(pod.lastCheckedAt).toLocaleString()
            : "Not yet confirmed"}
        </p>
      </CardContent>
    </Card>
  );
}

export default function PodsContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<Snapshot>(
    user ? API : null,
    getSnapshot,
    { revalidateOnFocus: true },
  );
  const [modelKey, setModelKey] = useState<string>(RUNPOD_MODELS[0].key);
  const [gpuId, setGpuId] = useState("");
  const [volumeGb, setVolumeGb] = useState(30);
  const [gpus, setGpus] = useState<RunpodGpu[] | null>(null);
  const [quote, setQuote] = useState<PublicRunpodPod | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const connection = data?.connections[0];
  useEffect(() => {
    if (!loading && !user) router.replace("/login?redirect=/workspace/pods");
  }, [loading, user, router]);
  const poll = useEffectEvent(async () => {
    if (document.visibilityState !== "visible") return;
    for (const pod of data?.pods ?? []) {
      if (
        ![
          "creating",
          "unknown",
          "starting",
          "running",
          "stopping",
          "stopped",
          "terminating",
        ].includes(pod.status)
      )
        continue;
      try {
        await post({ action: "refresh", id: pod.id });
      } catch {
        /* Keep last confirmed state; manual refresh reports errors. */
      }
    }
    await mutate();
  });
  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => void poll(), 30_000);
    return () => window.clearInterval(timer);
  }, [user]);
  function resetQuote() {
    setQuote(null);
    setAccepted(false);
  }
  async function loadGpus() {
    if (!connection) return;
    setBusy(true);
    resetQuote();
    try {
      const snapshot = await getSnapshot(
        `${API}?connectionId=${connection.id}`,
      );
      setGpus(snapshot.gpus ?? []);
      setGpuId(snapshot.gpus?.[0]?.id ?? "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GPU lookup failed");
    } finally {
      setBusy(false);
    }
  }
  async function estimate() {
    if (!connection) return;
    setBusy(true);
    resetQuote();
    try {
      const result = await post({
        action: "quote",
        connectionId: connection.id,
        modelKey,
        gpuTypeId: gpuId,
        volumeGb,
      });
      setQuote(result.pod);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Estimate failed");
    } finally {
      setBusy(false);
    }
  }
  async function launch() {
    if (!quote || !accepted) return;
    setBusy(true);
    try {
      await post({
        action: "launch",
        id: quote.id,
        acceptProviderCharges: true,
      });
      resetQuote();
      await mutate();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Launch could not be confirmed",
      );
      await mutate();
    } finally {
      setBusy(false);
    }
  }
  if (loading || isLoading || !user)
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p role="status">Loading GPU workspace...</p>
      </div>
    );
  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-6 px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="outline" className="border-neon/30 text-neon">
            Your account. Your GPUs.
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold">GPU Pods</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Deploy reviewed open-weight models on Runpod, then use their API
            from your own apps. Runpod bills your account; no AI Market Cap
            wallet is used.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/deployments">API deployments</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings/providers">Provider connections</Link>
          </Button>
        </div>
      </div>
      {error ? (
        <div role="alert" className="rounded-xl border border-loss/40 p-4">
          <p>
            Pods could not be loaded. Do not launch again to work around an
            unconfirmed request.
          </p>
          <Button variant="outline" onClick={() => void mutate()}>
            Try again
          </Button>
        </div>
      ) : null}
      {data && !data.launchEnabled ? (
        <p
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100"
        >
          Launch preview: account connection and estimates are available.
          Creating and resuming paid Pods remain disabled until the live
          deployment check is complete. Stop and terminate controls remain
          available.
        </p>
      ) : null}
      {!connection && !error ? (
        <Card className="border-neon/20 bg-gradient-to-br from-neon/10 via-card to-card">
          <CardContent className="space-y-4 p-6">
            <Server className="h-7 w-7 text-neon" />
            <h2 className="text-xl font-semibold">
              Connect Runpod to get started
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Create and fund your Runpod account, then connect a dedicated API
              key. Connecting an account does not launch a GPU.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/settings/providers">Connect Runpod</Link>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href="/go/runpod?source=workspace-pods"
                  target="_blank"
                  rel="noopener noreferrer sponsored nofollow"
                >
                  Create Runpod account <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Referral link: AI Market Cap may earn Runpod credits on eligible
              new-account usage. Referral eligibility is determined by Runpod.
            </p>
          </CardContent>
        </Card>
      ) : connection && !error ? (
        <Card className="border-border/50 bg-gradient-to-br from-neon/5 via-card to-card">
          <CardContent className="space-y-5 p-5 md:p-6">
            <div>
              <h2 className="text-lg font-semibold">Configure one GPU</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Secure Cloud, pinned model revisions, key-protected vLLM API, 8K
                context. These are starter models, not a claim that every
                catalog model is deployable.
              </p>
            </div>
            <div className="grid min-w-0 gap-4 md:grid-cols-3">
              <label className="min-w-0 text-sm">
                Model
                <select
                  className={selectClass}
                  value={modelKey}
                  disabled={busy}
                  onChange={(e) => {
                    setModelKey(e.target.value);
                    resetQuote();
                  }}
                >
                  {RUNPOD_MODELS.map((model) => (
                    <option key={model.key} value={model.key}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-sm">
                GPU
                <select
                  className={selectClass}
                  value={gpuId}
                  disabled={busy || !gpus?.length}
                  onChange={(e) => {
                    setGpuId(e.target.value);
                    resetQuote();
                  }}
                >
                  <option value="">Load live GPU availability</option>
                  {gpus?.map((gpu) => (
                    <option key={gpu.id} value={gpu.id}>
                      {gpu.name} / {gpu.memoryGb} GB / {money(gpu.pricePerHour)}
                      /hr
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-sm">
                Persistent Pod volume
                <select
                  className={selectClass}
                  value={volumeGb}
                  disabled={busy}
                  onChange={(e) => {
                    setVolumeGb(Number(e.target.value));
                    resetQuote();
                  }}
                >
                  {RUNPOD_VOLUMES.map((size) => (
                    <option key={size} value={size}>
                      {size} GB
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Plus a 30 GB container disk. Pod volume survives a stop, but both
              disks are deleted on termination. No SSH or Jupyter port is
              exposed.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void loadGpus()}
              >
                <RefreshCw className="h-4 w-4" />
                Load current GPUs
              </Button>
              <Button disabled={busy || !gpuId} onClick={() => void estimate()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Review estimate
              </Button>
            </div>
            {gpus?.length === 0 ? (
              <p role="status" className="text-sm text-amber-200">
                No supported single-GPU configuration is available right now.
                Try later; no resources were created.
              </p>
            ) : null}
            {quote ? (
              <div className="space-y-4 rounded-xl border border-neon/30 bg-background/60 p-5">
                <h3 className="font-semibold">Review before launching</h3>
                <p className="text-sm">
                  {quote.modelName} on {quote.gpuName}, {quote.volumeGb} GB
                  volume.
                </p>
                <p className="text-2xl font-semibold text-neon">
                  {money(quote.estimatedGpuPricePerHour)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / GPU hour + storage
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  24 continuous GPU hours: about{" "}
                  {money(quote.estimatedGpuPricePerHour * 24)}, excluding
                  storage, taxes and other provider charges. This is an
                  estimate, not a spending cap. Valid until{" "}
                  {new Date(quote.quoteExpiresAt).toLocaleTimeString()}.
                </p>
                <a
                  className="inline-block text-sm text-neon underline"
                  href="https://docs.runpod.io/pods/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Review Runpod compute and storage pricing
                </a>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={accepted}
                    disabled={busy}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-emerald-400"
                  />
                  <span>
                    I authorize Runpod to bill my connected account. GPUs can be
                    billed during model loading and while idle. Stopping can
                    leave storage charges; terminating deletes data. There is no
                    automatic idle shutdown or hard spending cap in this
                    version.
                  </span>
                </label>
                <Button
                  disabled={busy || !accepted || !data?.launchEnabled}
                  onClick={() => void launch()}
                >
                  Accept charges and launch Pod
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Your Pods</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only Pods launched here are shown. Active status refreshes while
            this page is visible. Use Runpod directly if this site is
            unavailable.
          </p>
        </div>
        {data?.pods.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No Pods launched from AI Market Cap yet.
          </p>
        ) : null}
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {data?.pods.map((pod) => (
            <PodCard
              key={pod.id}
              pod={pod}
              enabled={data.launchEnabled}
              refresh={mutate}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
