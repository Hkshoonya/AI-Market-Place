import type { Metadata } from "next";
import Link from "next/link";
import { Rocket, Server, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ModelsGrid } from "@/components/models/models-grid";
import { Pagination } from "@/components/models/pagination";
import { SITE_URL } from "@/lib/constants/site";
import { createPublicClient } from "@/lib/supabase/public-server";
import { parseQueryResultPartial } from "@/lib/schemas/parse";
import { ModelBaseSchema } from "@/lib/schemas/models";
import { z } from "zod";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";
import { resolveWorkspaceRuntimeExecution } from "@/lib/workspace/runtime-execution";
import { resolveWorkspaceProvisioningHint } from "@/lib/workspace/external-deployment";

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

function getProvisioningBadgeLabel(kind: "managed_api" | "hosted_external" | "assistant_only") {
  if (kind === "managed_api") return "Managed runtime";
  if (kind === "hosted_external") return "Hosted backend";
  return "Assistant only";
}

export default async function DeployPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
  }>;
}) {
  const { page: pageParam } = await searchParams;
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

  const launchableModels = candidateModels
    .map((model) => {
      const provisioning = resolveWorkspaceProvisioningHint({
        modelSlug: model.slug,
        modelName: model.name,
        provider: model.provider,
        category: model.category,
        hfModelId: model.hf_model_id,
        runtimeExecution: resolveWorkspaceRuntimeExecution(model.slug),
      });
      return { model, provisioning };
    })
    .filter(({ provisioning }) => provisioning.canCreate);

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
  const openModelStarts = sortedLaunchableModels
    .filter(({ model }) => model.is_open_weights)
    .slice(0, 3);
  const fastestSetupStarts = sortedLaunchableModels
    .filter(({ provisioning }) => provisioning.deploymentKind === "managed_api")
    .slice(0, 3);
  const pagedModels = launchableModels.slice(from, to);

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
              managed runtime. Others use a hosted backend we provision and keep connected to your
              on-site chat, API, budgets, and usage history.
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
                  {managedRuntimeCount} models run through AI Market Cap-managed execution.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="flex gap-3 p-4">
              <Server className="mt-0.5 h-5 w-5 text-neon" />
              <div>
                <p className="text-sm font-semibold text-white">Hosted backend</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hostedBackendCount} models use a hosted backend that AI Market Cap provisions for
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
              You start the deployment on AI Market Cap, then keep using the model here through a
              stable endpoint, workspace, and deployment history.
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
            Showing <span className="font-medium text-foreground">{launchableModels.length}</span>{" "}
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

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {[
          {
            title: "Best for chat",
            summary: "Strong starting points if you want a general-purpose model running quickly.",
            items: chatStarts,
          },
          {
            title: "Best open models",
            summary: "Open-weight models AI Market Cap can still launch here for you today.",
            items: openModelStarts,
          },
          {
            title: "Fastest setup",
            summary: "Models already on the smoothest AI Market Cap-managed runtime path.",
            items: fastestSetupStarts,
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
                  section.items.map(({ model, provisioning }) => (
                    <Link
                      key={`${section.title}-${model.id}`}
                      href={`/models/${model.slug}`}
                      className="block rounded-xl border border-border/50 bg-card/40 p-4 transition-colors hover:border-neon/30"
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
                    </Link>
                  ))
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
          <ModelsGrid
            models={pagedModels.map(({ model }) => ({
              ...model,
              access_offer: null,
              managed_deployment_available: true,
              usage_mode_labels: ["Hosted for you"],
              self_host_requirement_label: null,
              recent_signal: null,
              model_pricing: model.model_pricing,
            }))}
          />
          <Pagination
            totalCount={launchableModels.length}
            pageSize={PAGE_SIZE}
            basePath="/deploy"
          />
        </>
      )}
    </div>
  );
}
