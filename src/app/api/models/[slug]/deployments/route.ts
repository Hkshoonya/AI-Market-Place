import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import {
  buildDeploymentCatalog,
  type DeploymentPlatform,
  type ModelDeployment,
} from "@/lib/models/deployments";
import { buildLaunchRadar, getNewsSignalType } from "@/lib/news/presentation";
import {
  compareDeploymentSignalSummaries,
  normalizeDeploymentSignalSummary,
} from "@/lib/homepage/deployments";

export const revalidate = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const supabase = await createClient();

    // Get model
    const { data: modelRaw } = await supabase
      .from("models")
      .select("id, name, slug, provider, is_open_weights")
      .eq("slug", slug)
      .single();

    if (!modelRaw) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    // Get deployments with platform info
    const { data: deployments } = await supabase
      .from("model_deployments")
      .select("*, deployment_platforms(*)")
      .eq("model_id", modelRaw.id)
      .eq("status", "available")
      .order("price_per_unit", { ascending: true });

    // Get all platforms for showing availability
    const { data: platforms } = await supabase
      .from("deployment_platforms")
      .select("*")
      .order("name");

    const { data: pricingRows } = await supabase
      .from("model_pricing")
      .select("provider_name")
      .eq("model_id", modelRaw.id);
    const newsFields =
      "id, title, summary, url, source, category, related_provider, related_model_ids, tags, metadata, published_at";
    const { data: modelNewsRaw } = await supabase
      .from("model_news")
      .select(newsFields)
      .contains("related_model_ids", [modelRaw.id])
      .order("published_at", { ascending: false })
      .limit(12);
    const { data: providerNewsRaw } = modelRaw.provider
      ? await supabase
          .from("model_news")
          .select(newsFields)
          .eq("related_provider", modelRaw.provider)
          .or("related_model_ids.is.null,related_model_ids.eq.{}")
          .order("published_at", { ascending: false })
          .limit(8)
      : { data: [] as typeof modelNewsRaw };

    const pricingProviderNames = Array.from(
      new Set((pricingRows ?? []).map((row) => row.provider_name).filter(Boolean))
    ) as string[];
    const seenNewsIds = new Set<string>();
    const deploymentEvidence = buildLaunchRadar(
      [...(modelNewsRaw ?? []), ...(providerNewsRaw ?? [])]
        .filter((item) => {
          if (!item.id || seenNewsIds.has(item.id)) return false;
          seenNewsIds.add(item.id);
          return true;
        })
        .filter((item) => {
          const signalType = getNewsSignalType(item);
          return signalType === "open_source" || signalType === "api";
        }),
      12
    )
      .map((item) =>
        normalizeDeploymentSignalSummary(
          {
            id: modelRaw.id,
            slug: modelRaw.slug,
            name: modelRaw.name,
            provider: modelRaw.provider,
          },
          item
        )
      )
      .sort(compareDeploymentSignalSummaries)
      .filter((item, index, items) => {
        const dedupeKey = `${item.signalType}::${item.title}`;
        return (
          items.findIndex((candidate) => `${candidate.signalType}::${candidate.title}` === dedupeKey) ===
          index
        );
      })
      .slice(0, 6);

    const typedDeployments: ModelDeployment[] = [];
    for (const deployment of deployments ?? []) {
      const platform = deployment.deployment_platforms as unknown as DeploymentPlatform | null;
      if (!platform) continue;

      typedDeployments.push({
        id: deployment.id,
        deploy_url: deployment.deploy_url,
        pricing_model: deployment.pricing_model as string | null,
        price_per_unit: deployment.price_per_unit,
        unit_description: deployment.unit_description,
        free_tier: deployment.free_tier,
        one_click: deployment.one_click,
        deployment_platforms: platform,
      });
    }

    const typedPlatforms: DeploymentPlatform[] = (platforms ?? []).map((platform) => {
      const platformRecord = platform as Record<string, unknown>;

      return {
        id: platform.id,
        slug: platform.slug,
        name: platform.name,
        type: platform.type,
        base_url: platform.base_url,
        has_affiliate: platform.has_affiliate,
        affiliate_url:
          typeof platformRecord.affiliate_url === "string"
            ? platformRecord.affiliate_url
            : platform.affiliate_url_template,
        affiliate_tag:
          typeof platformRecord.affiliate_tag === "string"
            ? platformRecord.affiliate_tag
            : null,
      };
    });

    const deploymentCatalog = buildDeploymentCatalog({
      model: {
        slug: modelRaw.slug,
        name: modelRaw.name,
        provider: modelRaw.provider,
        is_open_weights: modelRaw.is_open_weights,
      },
      deployments: typedDeployments,
      platforms: typedPlatforms,
      pricingProviderNames,
    });

    return NextResponse.json({
      model: {
        id: modelRaw.id,
        name: modelRaw.name,
        provider: modelRaw.provider,
        is_open_weights: modelRaw.is_open_weights,
      },
      deployments: deploymentCatalog.directDeployments,
      relatedPlatforms: deploymentCatalog.relatedPlatforms,
      deploymentEvidence,
    });
  } catch (err) {
    return handleApiError(err, "api/models/deployments");
  }
}
