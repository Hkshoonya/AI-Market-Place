"use client";

import { useState } from "react";
import useSWR from "swr";
import { SWR_TIERS } from "@/lib/swr/config";
import { cn } from "@/lib/utils";
import { ExternalLink, Copy, Check, Zap, DollarSign, Server, Monitor, Cloud, ShieldCheck } from "lucide-react";
import {
  getAccessOfferActionLabel,
  getPartnerDisclosure,
  inferAccessOfferKind,
} from "@/lib/models/access-offers";
import { getDeployStartPlan } from "@/lib/models/deploy-start";
import { getSelfHostRequirements } from "@/lib/models/self-host-requirements";
import type { LaunchRadarItem } from "@/lib/news/presentation";
import { resolveWorkspaceRuntimeExecution } from "@/lib/workspace/runtime-execution";
import { useWorkspace } from "@/components/workspace/workspace-provider";

interface Platform {
  id: string;
  slug: string;
  name: string;
  type: string;
  base_url: string;
  has_affiliate: boolean;
  affiliate_url: string | null;
  affiliate_tag: string | null;
}

interface Deployment {
  platform: Platform;
  reason: string;
  confidence: "direct" | "pricing_inferred" | "provider_family" | "open_weight_runtime";
  deployment?: {
    id: string;
    deploy_url: string | null;
    pricing_model: string | null;
    price_per_unit: number | null;
    unit_description: string | null;
    free_tier: string | null;
    one_click: boolean;
  };
}

interface DeployTabProps {
  modelSlug: string;
  modelName: string;
  isOpenWeights: boolean;
  parameterCount?: number | null;
  contextWindow?: number | null;
  modalities?: string[];
  category?: string | null;
}

interface WorkspaceProvisioning {
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
}

const UTM_PARAMS = "?ref=aimarketcap&utm_source=aimarketcap&utm_medium=deploy_tab";

/** Returns the best URL for a platform: affiliate_url if set, otherwise base_url + UTM */
function getPlatformUrl(platform: Platform, deployUrl?: string | null): string {
  if (platform.affiliate_url) return platform.affiliate_url;
  return `${deployUrl || platform.base_url}${UTM_PARAMS}`;
}

/** Returns proper rel attribute: sponsored for affiliate links */
function getLinkRel(platform: Platform): string {
  return platform.affiliate_url
    ? "noopener noreferrer sponsored nofollow"
    : "noopener noreferrer";
}

function getActionLabel(platform: Platform, freeTier: string | null): string {
  return getAccessOfferActionLabel(inferAccessOfferKind({ type: platform.type }), freeTier);
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  api: <Zap className="h-4 w-4" />,
  hosting: <Server className="h-4 w-4" />,
  subscription: <DollarSign className="h-4 w-4" />,
  "self-hosted": <Server className="h-4 w-4" />,
  local: <Monitor className="h-4 w-4" />,
};

const TYPE_LABELS: Record<string, string> = {
  api: "API Providers",
  hosting: "Cloud Hosting",
  subscription: "Subscriptions",
  "self-hosted": "Cloud servers you control",
  local: "On your computer",
};

const CONFIDENCE_LABELS: Record<Deployment["confidence"], string> = {
  direct: "Verified",
  pricing_inferred: "Pricing Observed",
  provider_family: "Related Access",
  open_weight_runtime: "Runtime Compatible",
};

const LOCAL_COMPUTER_SLUGS = new Set(["ollama", "llamacpp", "lm-studio"]);
const CLOUD_SERVER_SLUGS = new Set(["runpod", "vast-ai", "lambda-cloud", "modal", "gcp-vertex"]);
const HOSTED_RUNTIME_SLUGS = new Set(["ollama-cloud", "replicate", "hf-inference"]);

function getSetupModeLabel(item: Deployment) {
  if (LOCAL_COMPUTER_SLUGS.has(item.platform.slug) || item.platform.type === "local") {
    return "On your computer";
  }
  if (CLOUD_SERVER_SLUGS.has(item.platform.slug) || item.platform.type === "self-hosted") {
    return "Cloud server you control";
  }
  if (HOSTED_RUNTIME_SLUGS.has(item.platform.slug) || item.platform.type === "hosting") {
    return "Hosted for you";
  }
  return null;
}

function getDeploymentModeLabel(item: Deployment, isOpenWeights: boolean) {
  const setupMode = getSetupModeLabel(item);
  if (setupMode) return setupMode;
  if (item.platform.type === "subscription") return "Provider plan";
  if (item.platform.type === "api") return "Provider account";
  if (item.confidence === "open_weight_runtime" && isOpenWeights) return "Self-host it";
  if (item.deployment?.one_click) return "One-click start";
  return "Usage option";
}

function getQuickStartSummary(item: Deployment, isOpenWeights: boolean) {
  const actionLabel = getActionLabel(item.platform, item.deployment?.free_tier ?? null);
  const modeLabel = getDeploymentModeLabel(item, isOpenWeights);
  const hasFreeTier = Boolean(item.deployment?.free_tier);

  let bestFor = "getting started quickly";
  if (item.platform.slug === "ollama-cloud") bestFor = "using the model without setting up your own stack";
  else if (item.platform.type === "subscription") bestFor = "using the model inside a paid plan";
  else if (item.platform.type === "api") bestFor = "building with the model through an API";
  else if (modeLabel === "On your computer" || modeLabel === "Cloud server you control" || modeLabel === "Self-host it") {
    bestFor = "running the model with more control";
  }

  return {
    actionLabel,
    modeLabel,
    bestFor,
    priceLabel:
      item.deployment?.pricing_model === "free"
        ? "Free"
        : item.deployment?.price_per_unit
          ? `$${item.deployment.price_per_unit}/${item.deployment.unit_description || "unit"}`
          : null,
    hasFreeTier,
  };
}

// Ollama/llama.cpp commands for open-weight models
function getLocalCommand(platformSlug: string, modelName: string): string | null {
  const sanitized = modelName.toLowerCase().replace(/\s+/g, "-");
  if (platformSlug === "ollama") return `ollama pull ${sanitized}`;
  if (platformSlug === "llamacpp") return `# Download GGUF from HuggingFace and run:\n./llama-server -m ${sanitized}.gguf --port 8080`;
  if (platformSlug === "lm-studio") return `# Search "${modelName}" in LM Studio model browser`;
  return null;
}

export function DeployTab({
  modelSlug,
  modelName,
  isOpenWeights,
  parameterCount = null,
  contextWindow = null,
  modalities = [],
  category = null,
}: DeployTabProps) {
  const { openWorkspace } = useWorkspace();
  const { data, error, isLoading } = useSWR<{
    deployments: Deployment[];
    relatedPlatforms: Deployment[];
    deploymentEvidence?: LaunchRadarItem[];
    provisioning?: WorkspaceProvisioning | null;
  }>(
    `/api/models/${modelSlug}/deployments`,
    { ...SWR_TIERS.SLOW }
  );
  const deployments = data?.deployments ?? [];
  const relatedPlatforms = data?.relatedPlatforms ?? [];
  const deploymentEvidence = data?.deploymentEvidence ?? [];
  const provisioning = data?.provisioning ?? null;
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-card/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500 p-4">{error?.message || "Failed to load deployment options"}</p>;
  }

  const grouped = new Map<string, Deployment[]>();
  for (const item of relatedPlatforms) {
    if (!grouped.has(item.platform.type)) grouped.set(item.platform.type, []);
    grouped.get(item.platform.type)!.push(item);
  }
  const primaryDeployment = deployments[0] ?? null;
  const runtimeExecution = resolveWorkspaceRuntimeExecution(modelSlug);
  const quickStart = primaryDeployment
    ? getQuickStartSummary(primaryDeployment, isOpenWeights)
    : null;
  const startPlan = primaryDeployment
    ? getDeployStartPlan({
        modelSlug,
        modelName,
        isOpenWeights,
        allowInSiteWorkspace: provisioning?.canCreate ?? runtimeExecution.available,
        offer: {
          actionLabel: quickStart?.actionLabel,
          actionUrl: getPlatformUrl(
            primaryDeployment.platform,
            primaryDeployment.deployment?.deploy_url
          ),
          monthlyPrice: primaryDeployment.deployment?.price_per_unit ?? null,
          freeTier: primaryDeployment.deployment?.free_tier ?? null,
          partnerDisclosure: getPartnerDisclosure(primaryDeployment.platform),
          platform: {
            slug: primaryDeployment.platform.slug,
            name: primaryDeployment.platform.name,
            type: primaryDeployment.platform.type,
          },
        },
      })
    : null;
  const aiMarketCapPlan = provisioning?.canCreate
    ? {
        label:
          provisioning.deploymentKind === "hosted_external"
            ? "Deploy on AI Market Cap"
            : "Use on AI Market Cap",
        summary: provisioning.summary,
        modeLabel:
          provisioning.deploymentKind === "hosted_external" ? "Hosted for you" : "Hosted for you",
        providerLabel: "AI Market Cap",
      }
    : null;
  const primaryPlatformType = primaryDeployment?.platform.type ?? null;
  const showApiCostWarning = primaryPlatformType === "api";
  const showSubscriptionCostHint = primaryPlatformType === "subscription";
  const selfHostRequirements = getSelfHostRequirements({
    isOpenWeights,
    parameterCount,
    contextWindow,
    modalities,
    category,
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/50 bg-card/20 p-4">
        <h3 className="mb-2 text-sm font-semibold text-white">What deployment means here</h3>
        <p className="text-sm text-muted-foreground">
          On this page, deployment means the real way you can start using this model. That might
          mean a hosted service, a provider plan, your own computer, or a cloud server you rent
          and manage yourself. When a model has open weights, we also estimate the usual hardware
          needed so you can tell whether it belongs on your computer or on a rented GPU server.
          Start with the verified rows first because they are the clearest model-specific options.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border/40 bg-card/30 p-3">
            <p className="text-xs font-semibold text-white">Hosted for you</p>
            <p className="mt-1 text-xs text-muted-foreground">
              You can start without setting up your own server.
            </p>
          </div>
          <div className="rounded-md border border-border/40 bg-card/30 p-3">
            <p className="text-xs font-semibold text-white">Cloud server you control</p>
            <p className="mt-1 text-xs text-muted-foreground">
              You rent the machine and manage the setup yourself.
            </p>
          </div>
          <div className="rounded-md border border-border/40 bg-card/30 p-3">
            <p className="text-xs font-semibold text-white">On your computer</p>
            <p className="mt-1 text-xs text-muted-foreground">
              It runs locally, but larger models may still need a strong GPU.
            </p>
          </div>
        </div>
      </div>

      {primaryDeployment && quickStart && (
        <div className="rounded-lg border border-[#00d4aa]/20 bg-[#00d4aa]/5 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#00d4aa]" />
                <h3 className="text-sm font-semibold text-white">Best way to start</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                If you just want the fastest verified path, start with{" "}
                <span className="font-medium text-white">{primaryDeployment.platform.name}</span>.
                This is best for {quickStart.bestFor}.
              </p>
              {startPlan?.recommendedPackReason ? (
                <p className="text-xs text-muted-foreground">{startPlan.recommendedPackReason}</p>
              ) : null}
              {!runtimeExecution.available ? (
                <p className="text-xs text-amber-300">
                  {provisioning?.canCreate
                    ? provisioning.summary
                    : "AI Market Cap cannot run this model directly yet. Use the verified provider path below instead."}
                </p>
              ) : null}
            </div>
            {startPlan ? (
              startPlan.external ? (
                <a
                  href={startPlan.href}
                  target="_blank"
                  rel={
                    startPlan.sponsored
                      ? "noopener noreferrer sponsored nofollow"
                      : getLinkRel(primaryDeployment.platform)
                  }
                  className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md bg-[#00d4aa]/15 px-3 py-2 text-sm font-medium text-[#00d4aa] transition-colors hover:bg-[#00d4aa]/25"
                >
                  {startPlan.label} on {primaryDeployment.platform.name}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!startPlan.workspace) return;
                    openWorkspace({
                      model: startPlan.workspace.model,
                      modelSlug: startPlan.workspace.modelSlug,
                      provider: startPlan.workspace.provider,
                      action: startPlan.workspace.action,
                      autoStartDeployment: true,
                      nextUrl: startPlan.workspace.nextUrl,
                      sponsored: startPlan.workspace.sponsored,
                      suggestedPackSlug: startPlan.workspace.suggestedPackSlug,
                      suggestedPack: startPlan.workspace.suggestedPack,
                      suggestedAmount: startPlan.workspace.suggestedAmount,
                    });
                  }}
                  className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md bg-[#00d4aa]/15 px-3 py-2 text-sm font-medium text-[#00d4aa] transition-colors hover:bg-[#00d4aa]/25"
                >
                  {startPlan.label}
                </button>
              )
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border/40 bg-card/30 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Use it as</p>
              <p className="mt-1 text-sm font-medium text-white">{quickStart.modeLabel}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-card/30 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Price</p>
              <p className="mt-1 text-sm font-medium text-white">{quickStart.priceLabel ?? "Check platform"}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-card/30 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Free Tier</p>
              <p className="mt-1 text-sm font-medium text-white">{quickStart.hasFreeTier ? "Available" : "Not listed"}</p>
            </div>
          </div>
          {startPlan?.needsWallet && startPlan.recommendedAmount ? (
            <p className="mt-3 text-xs text-muted-foreground">
                AI Market Cap will first guide you to{" "}
              {startPlan.recommendedPack ? startPlan.recommendedPack.label : "a wallet top-up"}{" "}
              for about ${startPlan.recommendedAmount}, then continue to the verified path for this model.
            </p>
          ) : null}
          {showApiCostWarning ? (
            <p className="mt-3 text-xs text-amber-300">
              This is metered API access. Heavy usage can cost more than a flat subscription, so
              check the provider rate before using it as the default path.
            </p>
          ) : null}
          {showSubscriptionCostHint ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Subscription pricing is usually easier to predict than metered API usage. Use API
              access only when you need programmatic requests.
            </p>
          ) : null}
          {startPlan ? (
            <div className="mt-4 rounded-md border border-border/40 bg-card/30 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                What you get
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {startPlan.experience.destinationLabel}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {startPlan.experience.destinationSummary}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {startPlan.experience.unlocks.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-border/40 bg-background/40 px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {aiMarketCapPlan ? (
        <div className="rounded-lg border border-neon/20 bg-neon/5 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-neon" />
                <h3 className="text-sm font-semibold text-white">Deploy on AI Market Cap</h3>
              </div>
              <p className="text-sm text-muted-foreground">{aiMarketCapPlan.summary}</p>
              <p className="text-xs text-muted-foreground">
                This keeps deployment, chat, API access, and usage tracking on this site.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                openWorkspace({
                  model: modelName,
                  modelSlug,
                  action: aiMarketCapPlan.label,
                  provider: aiMarketCapPlan.providerLabel,
                  autoStartDeployment: true,
                  nextUrl: `/models/${modelSlug}?tab=deploy#model-tabs`,
                  sponsored: false,
                  suggestedPackSlug: startPlan?.recommendedPack?.slug ?? null,
                  suggestedPack: startPlan?.recommendedPack?.label ?? null,
                  suggestedAmount: startPlan?.recommendedAmount ?? primaryDeployment?.deployment?.price_per_unit ?? 20,
                });
              }}
              className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md bg-neon/15 px-3 py-2 text-sm font-medium text-neon transition-colors hover:bg-neon/25"
            >
              {aiMarketCapPlan.label}
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border/40 bg-card/30 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Use it as</p>
              <p className="mt-1 text-sm font-medium text-white">{aiMarketCapPlan.modeLabel}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-card/30 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">What you get</p>
              <p className="mt-1 text-sm font-medium text-white">Chat, API, usage tracking</p>
            </div>
            <div className="rounded-md border border-border/40 bg-card/30 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Delivery</p>
              <p className="mt-1 text-sm font-medium text-white">
                {provisioning?.deploymentKind === "hosted_external"
                  ? "AI Market Cap dedicated runtime"
                  : "AI Market Cap in-site runtime"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Pricing Comparison Table */}
      {deployments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[#00d4aa]" />
            Choose how to use this model
          </h3>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-card/50">
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Platform</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Use it as</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Price</th>
                  <th className="text-center px-4 py-2 text-muted-foreground font-medium">Free Tier</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((d, i) => {
                  const platform = d.platform;
                  const deployment = d.deployment;
                  return (
                    <tr key={platform.id} className={cn("border-b border-border/20", i === 0 && "bg-[#00d4aa]/5")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {TYPE_ICONS[platform.type]}
                          <span className="font-medium text-white">{platform.name}</span>
                          {i === 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00d4aa]/20 text-[#00d4aa] font-semibold">
                              BEST VALUE
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                            {CONFIDENCE_LABELS[d.confidence]}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00d4aa]/10 text-[#00d4aa]">
                            {getDeploymentModeLabel(d, isOpenWeights)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{getDeploymentModeLabel(d, isOpenWeights)}</td>
                      <td className="px-4 py-3 text-right font-mono text-white">
                        {deployment?.pricing_model === "free" ? (
                          <span className="text-green-400">Free</span>
                        ) : deployment?.price_per_unit ? (
                          `$${deployment.price_per_unit}/${deployment.unit_description || "unit"}`
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {deployment?.free_tier ? (
                          <span className="text-green-400 text-xs">{deployment.free_tier}</span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={getPlatformUrl(platform, deployment?.deploy_url)}
                          target="_blank"
                          rel={getLinkRel(platform)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded bg-[#00d4aa]/10 text-[#00d4aa] hover:bg-[#00d4aa]/20 transition-colors"
                        >
                          {getActionLabel(platform, deployment?.free_tier ?? null)} <ExternalLink className="h-3 w-3" />
                        </a>
                        {getPartnerDisclosure(platform) && (
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {getPartnerDisclosure(platform)}
                          </div>
                        )}
                        {platform.type === "api" ? (
                          <div className="mt-1 text-[10px] text-amber-300">
                            Metered usage can cost more than subscriptions.
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deploymentEvidence.length > 0 && (
        <div className="rounded-lg border border-border/50 p-4 bg-card/20">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-[#00d4aa]" />
            Official availability updates
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            These are official updates confirming new ways this model can be used, such as direct
            provider access, AI Market Cap hosting support, or self-host support.
          </p>
          <div className="space-y-3">
            {deploymentEvidence.map((item, index) => (
              <div
                key={item.id ?? item.url ?? `${item.title}-${index}`}
                className="rounded-lg border border-border/40 p-3"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-white">{item.title ?? "Deployment update"}</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
                    {item.signalLabel}
                  </span>
                  {item.source ? (
                    <span className="text-[11px] text-muted-foreground">{item.source}</span>
                  ) : null}
                </div>
                {item.summary ? (
                  <p className="text-xs leading-5 text-muted-foreground">{item.summary}</p>
                ) : null}
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-[#00d4aa] hover:text-[#00d4aa]/80"
                  >
                    Read source <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {selfHostRequirements ? (
        <div className="rounded-lg border border-border/50 p-4 bg-card/20">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <Server className="h-4 w-4 text-[#00d4aa]" />
            What you need to run it yourself
          </h3>
          <p className="text-sm text-muted-foreground">
            This model has open weights, so you can run it privately. Here is the simplest way to think about the setup before you choose a local tool or rented server.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border/40 bg-card/30 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Best fit</p>
              <p className="mt-1 text-sm font-medium text-white">
                {selfHostRequirements.bestFitLabel}
              </p>
            </div>
            <div className="rounded-md border border-border/40 bg-card/30 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Typical GPU memory
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {selfHostRequirements.gpuMemoryLabel}
              </p>
            </div>
            <div className="rounded-md border border-border/40 bg-card/30 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Model size</p>
              <p className="mt-1 text-sm font-medium text-white">
                {selfHostRequirements.sizeLabel ?? "Check model card"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{selfHostRequirements.setup}</p>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            <li>• {selfHostRequirements.hardware}</li>
            {selfHostRequirements.notes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {relatedPlatforms.length > 0 && (
        <p className="text-xs text-muted-foreground">
          The options below are broader paths that may fit this model family. Use the verified
          section above first when you want the clearest starting point.
        </p>
      )}

      {/* Related platform categories */}
      {Array.from(grouped.entries()).map(([type, typePlatforms]) => (
        <div key={type}>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            {TYPE_ICONS[type]}
            {TYPE_LABELS[type] || type} <span className="text-xs text-muted-foreground font-normal">Related options</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {typePlatforms.map((item) => {
              const platform = item.platform;
              const localCmd = isOpenWeights ? getLocalCommand(platform.slug, modelName) : null;

              return (
                <div
                  key={platform.id}
                  className="rounded-lg border border-border/30 p-3 bg-card/20 hover:border-border/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-white">{platform.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                        {CONFIDENCE_LABELS[item.confidence]}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00d4aa]/10 text-[#00d4aa]">
                        {getDeploymentModeLabel(item, isOpenWeights)}
                      </span>
                    </div>
                  </div>
                  {item.deployment?.price_per_unit && (
                    <p className="text-xs text-muted-foreground mb-2 font-mono">
                      ${item.deployment.price_per_unit}/{item.deployment.unit_description || "unit"}
                    </p>
                  )}
                  <p className="mb-2 text-xs text-muted-foreground leading-relaxed">
                    {item.reason}
                  </p>
                  {localCmd && (
                    <div className="mb-2">
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-black/50 rounded px-2 py-1 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground font-mono">
                          {localCmd.split("\n")[0]}
                        </code>
                        <button
                          onClick={() => copyToClipboard(localCmd, platform.id)}
                          className="p-1 text-muted-foreground hover:text-white"
                        >
                          {copiedId === platform.id ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                  )}
                  <a
                    href={getPlatformUrl(platform, item.deployment?.deploy_url)}
                    target="_blank"
                    rel={getLinkRel(platform)}
                    className="inline-flex items-center gap-1 text-xs text-[#00d4aa] hover:text-[#00d4aa]/80 transition-colors"
                  >
                    {item.deployment
                      ? getActionLabel(platform, item.deployment?.free_tier ?? null)
                      : getActionLabel(platform, null)}{" "}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {getPartnerDisclosure(platform) && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {getPartnerDisclosure(platform)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Self-Hosting Guide for Open-Weight Models */}
      {isOpenWeights && (
        <div className="rounded-lg border border-border/50 p-4 bg-card/20">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Server className="h-4 w-4 text-[#00d4aa]" />
            Common self-host options
          </h3>
          <div className="space-y-3 text-xs text-muted-foreground">
            <p className="text-sm text-muted-foreground">
              This model has open weights. That usually means you can run it privately if you have
              the right hardware. If you want an API-style setup, use a server runtime. If you
              want the simplest private setup, use a local runner on your own computer. The examples
              below are starting points, not the only valid tools.
            </p>
            <div>
              <p className="font-medium text-white mb-1">Server runtime example</p>
              <p className="mb-1 text-[11px] text-muted-foreground">Example server-runtime command</p>
              <div className="flex items-center gap-1">
                <code className="bg-black/50 rounded px-2 py-1 flex-1 overflow-auto font-mono">
                  docker run --gpus all -p 8000:8000 vllm/vllm-openai --model {modelName.toLowerCase().replace(/\s+/g, "-")}
                </code>
                <button
                  onClick={() => copyToClipboard(`docker run --gpus all -p 8000:8000 vllm/vllm-openai --model ${modelName.toLowerCase().replace(/\s+/g, "-")}`, "vllm")}
                  className="p-1 text-muted-foreground hover:text-white shrink-0"
                >
                  {copiedId === "vllm" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
            <div>
              <p className="font-medium text-white mb-1">Local runner example</p>
              <p className="mb-1 text-[11px] text-muted-foreground">Example local-runner command</p>
              <div className="flex items-center gap-1">
                <code className="bg-black/50 rounded px-2 py-1 flex-1 font-mono">
                  ollama pull {modelName.toLowerCase().replace(/\s+/g, "-")}
                </code>
                <button
                  onClick={() => copyToClipboard(`ollama pull ${modelName.toLowerCase().replace(/\s+/g, "-")}`, "ollama-cmd")}
                  className="p-1 text-muted-foreground hover:text-white shrink-0"
                >
                  {copiedId === "ollama-cmd" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deployments.length === 0 && relatedPlatforms.length === 0 && deploymentEvidence.length === 0 && (
        <div className="rounded-lg border border-border/50 p-4 bg-card/20">
          <div className="flex items-start gap-3">
            <Cloud className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-white">No verified deployment path yet</p>
              <p className="text-sm text-muted-foreground">
                This usually means we have not confirmed a direct API, subscription, local runtime, or official self-host
                path for this model yet. The page will update as new provider and runtime sources sync.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
