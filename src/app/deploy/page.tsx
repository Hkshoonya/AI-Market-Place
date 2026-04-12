import type { Metadata } from "next";
import Link from "next/link";
import { Rocket, Server, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/models/pagination";
import { WorkspaceStartButton } from "@/components/workspace/workspace-start-button";
import { SITE_URL } from "@/lib/constants/site";
import { createPublicClient } from "@/lib/supabase/public-server";
import { parseQueryResultPartial } from "@/lib/schemas/parse";
import { ModelBaseSchema } from "@/lib/schemas/models";
import { z } from "zod";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";
import { resolveWorkspaceRuntimeExecution } from "@/lib/workspace/runtime-execution";
import {
  resolveWorkspaceProvisioningForModel,
  resolveWorkspaceProvisioningHint,
} from "@/lib/workspace/external-deployment";
import { getPublicPricingSummary } from "@/lib/models/pricing";
import { getSelfHostRequirements } from "@/lib/models/self-host-requirements";
import {
  getRecommendedWalletTopUpAmount,
  getWalletTopUpPackForAmount,
} from "@/lib/constants/wallet";

export const metadata: Metadata = {
  title: "Deploy AI Models on AI Market Cap",
  description:
    "Launch supported AI models on AI Market Cap with one click and keep chat, API access, and usage tracking in one place.",
  openGraph: {
    title: "Deploy AI Models on AI Market Cap",
    description:
      "Launch supported AI models on AI Market Cap with one click and keep chat, API access, and usage tracking in one place.",
    url: `${SITE_URL}/deploy`,
  },
  alternates: {
    canonical: `${SITE_URL}/deploy`,
  },
};

export const revalidate = 300;

const PAGE_SIZE = 24;
const MAX_DEPLOY_PROVISIONING_CANDIDATES = 120;
const DEPLOY_FOCUS_OPTIONS = ["all", "chat", "api", "open", "cost"] as const;
type DeployFocus = (typeof DEPLOY_FOCUS_OPTIONS)[number];

function getProvisioningBadgeLabel(kind: "managed_api" | "hosted_external" | "assistant_only") {
  if (kind === "managed_api") return "Runs here";
  if (kind === "hosted_external") return "Dedicated runtime";
  return "Guided setup";
}

function getHostedProviderLabel(entry: LaunchableEntry) {
  if (entry.provisioning.deploymentKind !== "hosted_external") {
    return "AI Market Cap";
  }

  return "AI Market Cap";
}

function buildWorkspaceStartDefaults(entry: LaunchableEntry) {
  const pricing = getPublicPricingSummary(entry.model);
  const suggestedAmount =
    pricing.compactPrice != null && pricing.compactPrice > 0
      ? getRecommendedWalletTopUpAmount(pricing.compactPrice)
      : null;
  const suggestedPack = suggestedAmount != null ? getWalletTopUpPackForAmount(suggestedAmount) : null;

  return {
    provider: getHostedProviderLabel(entry),
    action:
      entry.provisioning.deploymentKind === "hosted_external"
        ? "Deploy on AI Market Cap"
        : "Use on AI Market Cap",
    autoStartDeployment: true,
    suggestedAmount,
    suggestedPackSlug: suggestedPack?.slug ?? null,
    suggestedPack: suggestedPack?.label ?? null,
  };
}

type LaunchableEntry = {
  model: z.infer<typeof ModelBaseSchema> & {
    model_pricing?: Array<{
      provider_name?: string | null;
      input_price_per_million: number | null;
      source?: string | null;
      output_price_per_million?: number | null;
      currency?: string | null;
    }>;
  };
  provisioning: ReturnType<typeof resolveWorkspaceProvisioningHint>;
};

type LowestCostLaunchableEntry = LaunchableEntry & {
  pricing: ReturnType<typeof getPublicPricingSummary>;
};

export default async function DeployPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    focus?: string;
  }>;
}) {
  const { page: pageParam, focus: focusParam } = await searchParams;
  const focus = DEPLOY_FOCUS_OPTIONS.includes((focusParam ?? "all") as DeployFocus)
    ? ((focusParam ?? "all") as DeployFocus)
    : "all";
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;

  const supabase = createPublicClient();
  const response = await supabase
    .from("models")
    .select("*, model_pricing(*)")
    .eq("status", "active")
    .range(0, 1999)
    .order("overall_rank", { ascending: true, nullsFirst: false });

  const DeployPageSchema = ModelBaseSchema.extend({
    model_pricing: z
      .array(
        z.object({
          provider_name: z.string().nullable().optional(),
          input_price_per_million: z.number().nullable(),
          source: z.string().nullable().optional(),
          output_price_per_million: z.number().nullable().optional(),
          currency: z.string().nullable().optional(),
        })
      )
      .optional(),
  });

  const parsedModels = parseQueryResultPartial(response, DeployPageSchema, "DeployPage");
  const candidateModels = preferDefaultPublicSurfaceReady(
    dedupePublicModelFamilies(parsedModels),
    12
  );

  const provisioningCandidates = candidateModels.slice(0, MAX_DEPLOY_PROVISIONING_CANDIDATES);
  const launchableModels: LaunchableEntry[] = (
    await Promise.all(
      provisioningCandidates.map(async (model) => {
        const runtimeExecution = resolveWorkspaceRuntimeExecution(model.slug);
        const provisioning = runtimeExecution.available
          ? resolveWorkspaceProvisioningHint({
              modelSlug: model.slug,
              modelName: model.name,
              provider: model.provider,
              category: model.category,
              hfModelId: model.hf_model_id,
              runtimeExecution,
            })
          : await resolveWorkspaceProvisioningForModel({
              model: {
                slug: model.slug,
                name: model.name,
                provider: model.provider,
                category: model.category,
                parameter_count: model.parameter_count,
                hf_model_id: model.hf_model_id,
              },
              runtimeExecution,
            });

        return { model, provisioning };
      })
    )
  ).filter(({ provisioning }) => provisioning.canCreate);

  const managedRuntimeCount = launchableModels.filter(
    ({ provisioning }) => provisioning.deploymentKind === "managed_api"
  ).length;
  const hostedBackendCount = launchableModels.filter(
    ({ provisioning }) => provisioning.deploymentKind === "hosted_external"
  ).length;
  const sortedLaunchableModels = [...launchableModels].sort((left, right) => {
    const leftRank = left.model.overall_rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = right.model.overall_rank ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
  const chatStarts = sortedLaunchableModels
    .filter(({ model }) => model.category === "llm" || model.category === "multimodal")
    .slice(0, 3);
  const bestApiStarts = sortedLaunchableModels
    .filter(({ provisioning }) => provisioning.deploymentKind === "managed_api")
    .slice(0, 3);
  const lowestCostStarts: LowestCostLaunchableEntry[] = [...launchableModels]
    .map((entry) => ({
      ...entry,
      pricing: getPublicPricingSummary(entry.model),
    }))
    .filter((entry) => entry.pricing.compactPrice != null)
    .sort((left, right) => {
      if (left.pricing.compactPrice == null || right.pricing.compactPrice == null) {
        return 0;
      }
      return left.pricing.compactPrice - right.pricing.compactPrice;
    })
    .slice(0, 3);
  const openWeightDeployStarts = sortedLaunchableModels
    .filter(({ model }) => model.is_open_weights)
    .sort((left, right) => {
      const leftTier =
        getSelfHostRequirements({
          isOpenWeights: left.model.is_open_weights,
          parameterCount: left.model.parameter_count,
          contextWindow: left.model.context_window,
          category: left.model.category,
          name: left.model.name,
          slug: left.model.slug,
          modalities: left.model.modalities,
        })?.tier ?? "high_memory_cloud";
      const rightTier =
        getSelfHostRequirements({
          isOpenWeights: right.model.is_open_weights,
          parameterCount: right.model.parameter_count,
          contextWindow: right.model.context_window,
          category: right.model.category,
          name: right.model.name,
          slug: right.model.slug,
          modalities: right.model.modalities,
        })?.tier ?? "high_memory_cloud";
      const tierOrder = {
        personal: 0,
        desktop_gpu: 1,
        cloud_gpu: 2,
        high_memory_cloud: 3,
      } as const;
      return tierOrder[leftTier] - tierOrder[rightTier];
    })
    .slice(0, 3);
  const filteredLaunchableModels = (() => {
    switch (focus) {
      case "chat":
        return sortedLaunchableModels.filter(
          ({ model }) => model.category === "llm" || model.category === "multimodal"
        );
      case "api":
        return sortedLaunchableModels.filter(
          ({ provisioning }) => provisioning.deploymentKind === "managed_api"
        );
      case "open":
        return sortedLaunchableModels.filter(({ model }) => model.is_open_weights);
      case "cost":
        return lowestCostStarts.length > 0
          ? [
              ...lowestCostStarts,
              ...sortedLaunchableModels.filter(
                ({ model }) => !lowestCostStarts.some((entry) => entry.model.id === model.id)
              ),
            ]
          : sortedLaunchableModels;
      case "all":
      default:
        return sortedLaunchableModels;
    }
  })();
  const pagedModels = filteredLaunchableModels.slice(from, to);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="rounded-3xl border border-[#00d4aa]/20 bg-[radial-gradient(circle_at_top_left,rgba(0,212,170,0.12),transparent_45%),linear-gradient(180deg,rgba(12,18,16,0.94),rgba(10,12,16,0.94))] p-6 sm:p-8">
        <Badge variant="outline" className="border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]">
          One-click deploy
        </Badge>
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">
              Launch AI models on AI Market Cap
            </h1>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              These are the models AI Market Cap can launch for you today. Some run through our own
              in-site runtime. Others start in a dedicated runtime we launch for you while chat,
              API access, budgets, and usage history stay on AI Market Cap.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-neon text-background hover:bg-neon/90">
              <Link href="/workspace">Open Workspace</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/deployments">View Deployments</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/models?deployable=true">More Ways to Use Models</Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Card className="border-border/50 bg-card/60">
            <CardContent className="flex gap-3 p-4">
              <Rocket className="mt-0.5 h-5 w-5 text-[#00d4aa]" />
              <div>
                <p className="text-sm font-semibold text-white">Launch here</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {launchableModels.length} models can be launched from AI Market Cap right now.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="flex gap-3 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-neon" />
              <div>
                <p className="text-sm font-semibold text-white">Managed runtime</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {managedRuntimeCount} models can run directly on AI Market Cap.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="flex gap-3 p-4">
              <Server className="mt-0.5 h-5 w-5 text-neon" />
              <div>
                <p className="text-sm font-semibold text-white">Dedicated runtime</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hostedBackendCount} models use a dedicated runtime AI Market Cap launches for
                  you.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">What one click means here</p>
            <p className="mt-2">
              You start on AI Market Cap and keep using the model here through a stable endpoint,
              workspace, budget controls, and deployment history.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">What it does not mean</p>
            <p className="mt-2">
              Not every tracked model can be launched here yet. Models outside this list still show
              verified provider, cloud-server, or self-host paths instead.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">What you keep on-site</p>
            <p className="mt-2">
              Workspace chat, endpoint access, budget controls, request history, and deployment
              status all stay inside AI Market Cap.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filteredLaunchableModels.length}</span>{" "}
            models AI Market Cap can launch here
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/models?managed=true">
            <Sparkles className="h-4 w-4" />
            Open filter view
          </Link>
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { value: "all" as const, label: "All launches" },
          { value: "chat" as const, label: "Chat" },
          { value: "api" as const, label: "API" },
          { value: "open" as const, label: "Open-weight" },
          { value: "cost" as const, label: "Lowest cost" },
        ].map((option) => (
          <Button
            key={option.value}
            variant={focus === option.value ? "default" : "outline"}
            asChild
            className={
              focus === option.value
                ? "bg-neon text-background hover:bg-neon/90"
                : undefined
            }
          >
            <Link href={option.value === "all" ? "/deploy" : `/deploy?focus=${option.value}`}>
              {option.label}
            </Link>
          </Button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {[
          {
            kind: "standard" as const,
            title: "Best for chat",
            summary: "Strong starting points if you want a general-purpose model running quickly.",
            items: chatStarts,
          },
          {
            kind: "standard" as const,
            title: "Best for API",
            summary: "The smoothest picks if you want the cleanest AI Market Cap-managed API path.",
            items: bestApiStarts,
          },
          {
            kind: "lowest_cost" as const,
            title: "Lowest cost to start",
            summary: "Launchable models with the lightest verified starting price signals right now.",
            items: lowestCostStarts,
          },
          {
            kind: "standard" as const,
            title: "Best open-weight deploys",
            summary: "Open models AI Market Cap can launch here, with simpler hardware expectations where possible.",
            items: openWeightDeployStarts,
          },
        ].map((section) => (
          <Card key={section.title} className="border-border/50 bg-card/60">
            <CardContent className="p-5">
              <h2 className="text-base font-semibold text-white">{section.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{section.summary}</p>
              <div className="mt-4 space-y-3">
                {section.items.length === 0 ? (
                  <div className="rounded-xl border border-border/50 bg-card/40 p-4 text-sm text-muted-foreground">
                    No launchable models in this group yet.
                  </div>
                ) : (
                  section.items.map((entry) => {
                    const model = entry.model;
                    const provisioning = entry.provisioning;
                    const startDefaults = buildWorkspaceStartDefaults(entry);
                    const pricing =
                      section.kind === "lowest_cost"
                        ? (entry as LowestCostLaunchableEntry).pricing.compactDisplay
                        : null;
                    const selfHost =
                      section.title === "Best open-weight deploys"
                        ? getSelfHostRequirements({
                            isOpenWeights: model.is_open_weights,
                            parameterCount: model.parameter_count,
                            contextWindow: model.context_window,
                            category: model.category,
                            name: model.name,
                            slug: model.slug,
                            modalities: model.modalities,
                          })?.shortLabel ?? null
                        : null;

                    return (
                      <div
                        key={`${section.title}-${model.id}`}
                        className="rounded-xl border border-border/50 bg-card/40 p-4 transition-colors hover:border-neon/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{model.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{model.provider}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className="border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[10px] text-[#00d4aa]"
                          >
                            {getProvisioningBadgeLabel(provisioning.deploymentKind)}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">{provisioning.summary}</p>
                        {pricing ? (
                          <p className="mt-2 text-xs text-emerald-300">Verified starting price: {pricing}</p>
                        ) : null}
                        {selfHost ? (
                          <p className="mt-2 text-xs text-amber-200">{selfHost}</p>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <WorkspaceStartButton
                            label="Deploy Now"
                            size="sm"
                            className="bg-neon text-background hover:bg-neon/90"
                            model={model.name}
                            modelSlug={model.slug}
                            provider={startDefaults.provider}
                            action={startDefaults.action}
                            autoStartDeployment={startDefaults.autoStartDeployment}
                            nextUrl={`/models/${model.slug}?tab=deploy#model-tabs`}
                            suggestedAmount={startDefaults.suggestedAmount}
                            suggestedPackSlug={startDefaults.suggestedPackSlug}
                            suggestedPack={startDefaults.suggestedPack}
                          />
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/models/${model.slug}?tab=deploy#model-tabs`}>
                              Model Page
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pagedModels.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border/50 bg-card/60 p-8 text-center">
          <p className="text-lg font-medium text-white">No launchable models found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check back soon, or browse the wider model catalog for provider and self-host paths.
          </p>
          <div className="mt-4">
            <Button asChild className="bg-neon text-background hover:bg-neon/90">
              <Link href="/models">Browse full model directory</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pagedModels.map(({ model, provisioning }) => {
              const pricing = getPublicPricingSummary(model).compactDisplay;
              const startDefaults = buildWorkspaceStartDefaults({ model, provisioning });
              const selfHost = model.is_open_weights
                ? getSelfHostRequirements({
                    isOpenWeights: model.is_open_weights,
                    parameterCount: model.parameter_count,
                    contextWindow: model.context_window,
                    category: model.category,
                    name: model.name,
                    slug: model.slug,
                    modalities: model.modalities,
                  })?.shortLabel ?? null
                : null;

              return (
                <Card key={model.id} className="border-border/50 bg-card/70">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-white">{model.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{model.provider}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[10px] text-[#00d4aa]"
                      >
                        {getProvisioningBadgeLabel(provisioning.deploymentKind)}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{provisioning.summary}</p>
                    {pricing ? (
                      <p className="mt-2 text-xs text-emerald-300">Verified starting price: {pricing}</p>
                    ) : null}
                    {selfHost ? (
                      <p className="mt-2 text-xs text-amber-200">{selfHost}</p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <WorkspaceStartButton
                        label="Deploy Now"
                        size="sm"
                        className="bg-neon text-background hover:bg-neon/90"
                        model={model.name}
                        modelSlug={model.slug}
                        provider={startDefaults.provider}
                        action={startDefaults.action}
                        autoStartDeployment={startDefaults.autoStartDeployment}
                        nextUrl={`/models/${model.slug}?tab=deploy#model-tabs`}
                        suggestedAmount={startDefaults.suggestedAmount}
                        suggestedPackSlug={startDefaults.suggestedPackSlug}
                        suggestedPack={startDefaults.suggestedPack}
                      />
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/models/${model.slug}?tab=deploy#model-tabs`}>
                          Model Page
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination
            totalCount={filteredLaunchableModels.length}
            pageSize={PAGE_SIZE}
            basePath="/deploy"
          />
        </>
      )}
    </div>
  );
}
